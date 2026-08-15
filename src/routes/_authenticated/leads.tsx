import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { LeadDrawer } from "@/components/back-office/LeadDrawer";
import { Plus, Search, Users, Upload, Download, Trash2, ListPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyPanel, SkeletonRows } from "@/components/back-office/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";
import { toCsv, downloadCsv, stampedName } from "@/lib/csv";
import { formatPhone, phoneKey } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/leads")({
  validateSearch: (s: Record<string, unknown>): { q?: string; lead?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    lead: typeof s.lead === "string" ? s.lead : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Leads — Master Closer" },
      { name: "description", content: "Manage every lead in your pipeline: statuses, consent, notes, and call history." },
      { property: "og:title", content: "Leads — Master Closer" },
      { property: "og:description", content: "Manage every lead in your pipeline: statuses, consent, notes, and call history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-700",
  unqualified: "bg-gray-100 text-gray-600",
  customer: "bg-[#CC0000]/10 text-[#CC0000]",
};

const STATUSES = ["new", "contacted", "qualified", "unqualified", "customer"];

function parseCsv(raw: string) {
  const rows: { name: string; phone: string | null; email: string | null; company: string | null }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const cols = t.split(",").map((c) => c.trim());
    if (/^name\b/i.test(cols[0] ?? "")) continue; // header row
    const [name, phone, email, company] = cols;
    if (!name) continue;
    rows.push({ name, phone: phone || null, email: email || null, company: company || null });
  }
  return rows;
}

function LeadsPage() {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const { q: qParam, lead: leadParam } = Route.useSearch();
  const [search, setSearch] = useState(qParam ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", status: "new" });
  const [picked, setPicked] = useState<string[]>([]);
  const [listTarget, setListTarget] = useState("");
  const emit = useServerFn(emitOrgEvent);

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads")
        .select("*").eq("workspace_id", wsId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      // Scope owners to this workspace — an org can hold several workspaces.
      const { data: rows, error: mErr } = await supabase
        .from("workspace_members").select("user_id").eq("workspace_id", wsId!);
      if (mErr) throw mErr;
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Deep link from global search: prefill the filter and open the matching lead. */
  useEffect(() => {
    if (qParam !== undefined) setSearch(qParam);
  }, [qParam]);
  useEffect(() => {
    if (!leadParam || !leads) return;
    const hit = leads.find((l: any) => l.id === leadParam);
    if (hit) setSelected(hit);
  }, [leadParam, leads]);



  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({ ...form, status: form.status as never, org_id: prof.org_id, workspace_id: prof.active_workspace_id })
        .select("id, name")
        .single();
      if (error) throw error;
      // Family event vocabulary: notify the hub / webhooks about the new lead.
      try {
        await emit({ data: { event_type: "leads.new", payload: { kind: "leads.new", lead_id: lead.id, name: lead.name } } });
      } catch {
        // Never block lead creation on hub availability.
      }
    },
    onSuccess: () => {
      toast.success("Lead created.");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", company: "", status: "new" });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importLeads = useMutation({
    mutationFn: async () => {
      const rows = parseCsv(csv);
      if (rows.length === 0) throw new Error("No valid rows found.");
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      const workspaceId = prof?.active_workspace_id;
      if (!workspaceId) throw new Error("No active workspace");
      const { error } = await supabase
        .from("leads")
        .insert(rows.map((r) => ({ ...r, status: "new" as never, org_id: prof!.org_id, workspace_id: workspaceId })));
      if (error) throw error;
      try {
        await emit({ data: { event_type: "leads.imported", payload: { kind: "leads.imported", count: rows.length } } });
      } catch {
        // Never block the import on hub availability.
      }
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} lead${n === 1 ? "" : "s"}.`);
      setImportOpen(false);
      setCsv("");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* Call lists are the dialer's queue source — bulk-push leads straight into one. */
  const { data: lists } = useQuery({
    queryKey: ["call-lists-min", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_lists")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  /* Do Not Call keys for this workspace — used to flag opted-out leads inline. */
  const { data: dncKeys } = useQuery({
    queryKey: ["leads-dnc-keys", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dnc_list")
        .select("phone")
        .eq("workspace_id", wsId!);
      if (error) throw error;
      return new Set((data ?? []).map((d: any) => phoneKey(d.phone)).filter(Boolean));
    },
  });
  const isDnc = (phone?: string | null) => {
    const k = phoneKey(phone);
    return !!k && !!dncKeys?.has(k);
  };

  const bulkStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("leads").update({ status: status as never }).in("id", picked);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Updated ${picked.length} lead${picked.length === 1 ? "" : "s"}.`);
      setPicked([]);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().in("id", picked);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leads deleted.");
      setPicked([]);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkToList = useMutation({
    mutationFn: async () => {
      if (!listTarget) throw new Error("Pick a call list first.");
      const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
      const workspaceId = prof?.active_workspace_id;
      if (!workspaceId) throw new Error("No active workspace");
      const pickedWithPhone = (leads ?? []).filter((l: any) => picked.includes(l.id) && l.phone);
      const skipped = pickedWithPhone.filter((l: any) => isDnc(l.phone)).length;
      const rows = pickedWithPhone
        .filter((l: any) => !isDnc(l.phone))
        .map((l: any) => ({
          list_id: listTarget,
          workspace_id: workspaceId,
          name: l.name,
          phone: l.phone as string,
          email: l.email,
          consent: (l.consent ?? "unknown") as never,
        }));
      if (rows.length === 0) throw new Error("None of the selected leads have a phone number.");
      const { error } = await supabase.from("list_contacts").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Added ${n} contact${n === 1 ? "" : "s"} to the call list.`);
      setPicked([]);
      setListTarget("");
      qc.invalidateQueries({ queryKey: ["list-contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allTags = Array.from(
    new Set((leads ?? []).flatMap((l: any) => (Array.isArray(l.tags) ? l.tags : []))),
  ).sort() as string[];

  const filtered = (leads ?? []).filter((l: any) => {
    const q = search.toLowerCase();
    const matches =
      !search ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.company?.toLowerCase().includes(q);
    const ownerOk =
      ownerFilter === "all" ||
      (ownerFilter === "unassigned" ? !l.owner_id : l.owner_id === ownerFilter);
    const tagOk = tagFilter === "all" || (Array.isArray(l.tags) && l.tags.includes(tagFilter));
    return matches && (statusFilter === "all" || l.status === statusFilter) && ownerOk && tagOk;
  });

  const allShownPicked = filtered.length > 0 && filtered.every((l: any) => picked.includes(l.id));

  function exportCsv() {
    const rows = picked.length > 0 ? filtered.filter((l: any) => picked.includes(l.id)) : filtered;
    if (rows.length === 0) return toast.error("Nothing to export.");
    const csvOut = toCsv(
      ["Name", "Company", "Email", "Phone", "Status", "Consent", "Created"],
      rows.map((l: any) => [l.name, l.company, l.email, l.phone, l.status, l.consent, l.created_at]),
    );
    downloadCsv(stampedName("leads"), csvOut);
    toast.success(`Exported ${rows.length} Lead${rows.length === 1 ? "" : "s"}.`);
  }


  return (
    <div>
      <PageHeader
        title="Leads"
        description="Everyone in the pipeline. Add, tag, and route."
        tabs={TAB_GROUPS.leads}
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Leads</DialogTitle>
                  <DialogDescription>
                    One lead per line: <code>name, phone, email, company</code>. A header row is skipped automatically.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={10}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder={"Jane Doe, +15551230000, jane@acme.com, Acme Roofing"}
                  className="font-mono text-xs"
                />
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => importLeads.mutate()}
                    disabled={!csv.trim() || importLeads.isPending}
                    className="bg-[#CC0000] hover:bg-[#A30000]"
                  >
                    Import {parseCsv(csv).length || ""} leads
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> New Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => create.mutate()}
                    disabled={!form.name || create.isPending}
                    className="bg-[#CC0000] hover:bg-[#A30000]"
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B76]" />
            <Input placeholder="Search by name, email, phone, or company" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(members ?? []).map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name || m.email || "Teammate"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || ownerFilter !== "all" || tagFilter !== "all") && (
            <Button
              variant="ghost"
              className="h-9"
              onClick={() => { setStatusFilter("all"); setOwnerFilter("all"); setTagFilter("all"); }}
            >
              Clear Filters
            </Button>
          )}
          <span className="text-sm text-[#6B6B76] whitespace-nowrap">{filtered.length} Shown</span>
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 rounded-xl border border-[#E7E7EC] bg-[#F4F4F6]/70 px-3 py-2">
            <span className="text-sm font-medium">{picked.length} Selected</span>
            <Select onValueChange={(v) => bulkStatus.mutate(v)}>
              <SelectTrigger className="w-[170px] h-9 bg-white"><SelectValue placeholder="Set Status" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={listTarget} onValueChange={setListTarget}>
              <SelectTrigger className="w-[190px] h-9 bg-white"><SelectValue placeholder="Add To Call List" /></SelectTrigger>
              <SelectContent>
                {(lists ?? []).length === 0 ? (
                  <SelectItem value="none" disabled>No Call Lists Yet</SelectItem>
                ) : (
                  (lists ?? []).map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-9"
              disabled={!listTarget || bulkToList.isPending}
              onClick={() => bulkToList.mutate()}
            >
              <ListPlus className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button type="button" variant="outline" className="rounded-xl h-9" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export Selected
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-9 text-[#CC0000] border-[#CC0000]/30 hover:bg-[#CC0000]/5"
              disabled={bulkDelete.isPending}
              onClick={() => bulkDelete.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button type="button" variant="ghost" className="rounded-xl h-9" onClick={() => setPicked([])}>
              Clear
            </Button>
          </div>
        )}

        {leadsLoading ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            icon={Users}
            title="No Leads Yet"
            hint="Add a lead by hand or import a CSV to start filling your pipeline."
            action={
              <>
                <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]" onClick={() => setOpen(true)}>
                  Add Lead
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setImportOpen(true)}>
                  Import CSV
                </Button>
              </>
            }
          />
        ) : (
          <div className="mc-tablewrap"><table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2 w-8">
                  <Checkbox
                    checked={allShownPicked}
                    onCheckedChange={(v) =>
                      setPicked(v ? filtered.map((l: any) => l.id) : [])
                    }
                    aria-label="Select all shown leads"
                  />
                </th>
                <th className="py-2">{t("Name")}</th><th className="py-2">{t("Company")}</th>
                <th className="py-2">{t("Email")}</th><th className="py-2">{t("Phone")}</th>
                <th className="py-2">{t("Consent")}</th><th className="py-2">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/70 cursor-pointer"
                >
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={picked.includes(l.id)}
                      onCheckedChange={(v) =>
                        setPicked((p) => (v ? [...p, l.id] : p.filter((x) => x !== l.id)))
                      }
                      aria-label={`Select ${l.name}`}
                    />
                  </td>
                  <td className="py-3 font-medium">{l.name}</td>
                  <td className="py-3 text-[#6B6B76]">{l.company ?? "—"}</td>
                  <td className="py-3 text-[#6B6B76]">{l.email ?? "—"}</td>
                  <td className="py-3 text-[#6B6B76]">{formatPhone(l.phone)}</td>
                  <td className="py-3 text-[#6B6B76] capitalize">{(l.consent ?? "unknown").replace("_", " ")}</td>
                  <td className="py-3">
                    <Badge className={`${STATUS_COLORS[l.status] ?? ""} capitalize border-0`}>{l.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}

      </Card>

      <LeadDrawer lead={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
