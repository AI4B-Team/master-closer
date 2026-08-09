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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";

export const Route = createFileRoute("/_authenticated/leads")({
  validateSearch: (s: Record<string, unknown>) => ({
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
  const qc = useQueryClient();
  const { q: qParam, lead: leadParam } = Route.useSearch();
  const [search, setSearch] = useState(qParam ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", status: "new" });
  const [picked, setPicked] = useState<string[]>([]);
  const [listTarget, setListTarget] = useState("");
  const emit = useServerFn(emitOrgEvent);

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads")
        .select("*").order("created_at", { ascending: false });
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
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({ ...form, status: form.status as never, org_id: prof.org_id })
        .select("id, name")
        .single();
      if (error) throw error;
      // Family event vocabulary: notify the hub / webhooks about the new lead.
      try {
        await emit({ data: { event_type: "leads.new", payload: { lead_id: lead.id, name: lead.name } } });
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
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const { error } = await supabase
        .from("leads")
        .insert(rows.map((r) => ({ ...r, status: "new" as never, org_id: prof.org_id })));
      if (error) throw error;
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

  const filtered = (leads ?? []).filter((l) => {
    const q = search.toLowerCase();
    const matches =
      !search ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.company?.toLowerCase().includes(q);
    return matches && (statusFilter === "all" || l.status === statusFilter);
  });

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Everyone in the pipeline. Add, tag, and route."
        tabs={TAB_GROUPS.leads}
        action={
          <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B76]" />
            <Input placeholder="Search by name, email, phone, or company" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-[#6B6B76] whitespace-nowrap">{filtered.length} Shown</span>
        </div>

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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Name</th><th className="py-2">Company</th>
                <th className="py-2">Email</th><th className="py-2">Phone</th>
                <th className="py-2">Consent</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/70 cursor-pointer"
                >
                  <td className="py-3 font-medium">{l.name}</td>
                  <td className="py-3 text-[#6B6B76]">{l.company ?? "—"}</td>
                  <td className="py-3 text-[#6B6B76]">{l.email ?? "—"}</td>
                  <td className="py-3 text-[#6B6B76]">{l.phone ?? "—"}</td>
                  <td className="py-3 text-[#6B6B76] capitalize">{(l.consent ?? "unknown").replace("_", " ")}</td>
                  <td className="py-3">
                    <Badge className={`${STATUS_COLORS[l.status] ?? ""} capitalize border-0`}>{l.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <LeadDrawer lead={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
