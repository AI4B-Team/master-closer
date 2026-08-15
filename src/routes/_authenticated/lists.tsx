import { createFileRoute } from "@tanstack/react-router";
import { parseCsvRows } from "@/lib/csv";
import { useWorkspace } from "@/hooks/use-workspace";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogDescription, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonRows, StatusPill, titleCase, toneForStatus } from "@/components/back-office/ui";
import { Download, ListOrdered, Pencil, Plus, Search, ShieldOff, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhone, phoneKey } from "@/lib/phone";
import { suppressContactsForPhones, fetchBlockedPhoneKeys } from "@/lib/dnc";
import { screenEmails, createCoreSuppression } from "@/lib/core/policy.functions";
import { useServerFn } from "@tanstack/react-start";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/lists")({
  head: () => ({
    meta: [
      { title: "Calling Lists — Master Closer" },
      { name: "description", content: "Build and manage the calling lists your outbound campaigns dial through." },
      { property: "og:title", content: "Calling Lists — Master Closer" },
      { property: "og:description", content: "Build and manage the calling lists your outbound campaigns dial through." },
    ],
  }),
  component: ListsPage,
});

/** Accepts "Name, Phone, Email" per line — the format reps already paste. */
function parseContacts(raw: string) {
  return parseCsvRows(raw)
    .filter((parts) => parts[0] && parts[1] && !/^(name|full ?name)$/i.test(parts[0]))
    .map((parts) => ({ name: parts[0]!, phone: parts[1]!, email: parts[2] || null }));
}

function ListsPage() {
  const qc = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [search, setSearch] = useState("");

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const coreSuppress = useServerFn(createCoreSuppression);

  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ["call_lists", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_lists")
        .select("*, list_contacts(id, name, phone, email, attempts, last_outcome, consent)")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dnc } = useQuery({
    queryKey: ["dnc-phones", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("dnc_list").select("phone").eq("workspace_id", wsId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppressed } = useQuery({
    queryKey: ["suppressed-phones", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("phone")
        .eq("workspace_id", wsId!)
        .eq("suppressed", true);
      if (error) return [];
      return data ?? [];
    },
  });

  const active = (lists ?? []).find((l: any) => l.id === selected) ?? (lists ?? [])[0];
  const digits = phoneKey;
  const dncSet = new Set(
    [...(dnc ?? []), ...(suppressed ?? [])].map((d: any) => phoneKey(d.phone)).filter(Boolean),
  );

  const isBlocked = (c: any) => c?.consent === "opt_out" || dncSet.has(phoneKey(c?.phone) as any);
  const dialableCount = (l: any) => ((l?.list_contacts ?? []) as any[]).filter((c) => !isBlocked(c)).length;
  const blockedCount = (l: any) => ((l?.list_contacts ?? []) as any[]).filter((c) => isBlocked(c)).length;

  const contacts = ((active?.list_contacts ?? []) as any[]).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.phone, c.email].some((v: string | null) => (v ?? "").toLowerCase().includes(q));
  });


  const renameList = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("No list selected.");
      const { error } = await supabase.from("call_lists").update({ name: renameValue }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List Renamed.");
      setRenameOpen(false);
      qc.invalidateQueries({ queryKey: ["call_lists"] });
      qc.invalidateQueries({ queryKey: ["lists-min"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteList = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("No list selected.");
      await supabase.from("list_contacts").delete().eq("list_id", active.id);
      const { error } = await supabase.from("call_lists").delete().eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List Deleted.");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["call_lists"] });
      qc.invalidateQueries({ queryKey: ["lists-min"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact Removed.");
      qc.invalidateQueries({ queryKey: ["call_lists"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addToDnc = useMutation({
    mutationFn: async (contact: any) => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const reason = `Added from list ${active?.name ?? ""}`.trim();
      const { error } = await supabase
        .from("dnc_list")
        .insert({ org_id: prof.org_id, workspace_id: prof.active_workspace_id, phone: contact.phone, reason });
      if (error) throw error;
      await supabase.from("list_contacts").update({ consent: "opt_out" }).eq("id", contact.id);
      // Keep the contact record in step so nominations never resurface this number.
      await suppressContactsForPhones(prof.active_workspace_id, [contact.phone]);
      // Surface the opt-out in the Activity Log / webhook fan-out like every other path.
      void logActivity("lead.flagged_dnc", { phone: contact.phone, channel: "voice", reason });
      // Push it to Core so every app in the family stops contacting this number.
      let coreFailed = false;
      try {
        const res = await coreSuppress({
          data: { phone: contact.phone, reason: "opt_out", notes: reason, channel: "voice" },
        });
        coreFailed = res.status === "error";
      } catch {
        coreFailed = true;
      }
      return { coreFailed };
    },
    onSuccess: ({ coreFailed }) => {
      toast.success("Added To Do Not Call.");
      if (coreFailed) {
        toast.warning("Could not send this opt-out to Core — other apps in the family may still contact them.");
      }
      qc.invalidateQueries({ queryKey: ["dnc-phones"] });
      qc.invalidateQueries({ queryKey: ["call_lists"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportCsv() {
    if (!active) return;
    const header = ["Name", "Phone", "Email", "Attempts", "Last Outcome", "Consent"];
    const rows = contacts.map((c) => [c.name, c.phone, c.email ?? "", c.attempts, c.last_outcome ?? "", c.consent ?? ""]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, "-").toLowerCase()}-contacts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const createList = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { data, error } = await supabase
        .from("call_lists")
        .insert({ org_id: prof.org_id, workspace_id: prof.active_workspace_id, name: listName })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success("List Created.");
      setListOpen(false);
      setListName("");
      setSelected(d.id);
      qc.invalidateQueries({ queryKey: ["call_lists"] });
      qc.invalidateQueries({ queryKey: ["lists-min"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importContacts = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Create a list first.");
      const rows = parseContacts(raw);
      if (!rows.length) throw new Error("No valid rows. Use: Name, Phone, Email");
      const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
      const workspaceId = prof?.active_workspace_id;
      if (!workspaceId) throw new Error("No active workspace");

      // Screen the import against local Do Not Call and Core family-wide suppressions.
      const blocked = await fetchBlockedPhoneKeys(workspaceId);

      // Imported email addresses are screened against the family-wide opt-out
      // list too, so nothing in this list gets emailed after an opt-out.
      const emails = rows.map((r) => r.email ?? "").filter(Boolean);
      let emailBlocked = new Set<string>();
      let emailScreenUnavailable = false;
      if (emails.length) {
        const screen = await screenEmails({ data: { emails } });
        emailBlocked = new Set(screen.suppressed);
        emailScreenUnavailable = screen.unavailable;
      }

      const payload = rows.map((r) => {
        const k = phoneKey(r.phone);
        const isBlocked = !!k && blocked.has(k);
        return {
          ...r,
          workspace_id: workspaceId,
          list_id: active.id,
          consent: (isBlocked ? "opt_out" : "unknown") as "opt_out" | "unknown",
        };
      });
      const { error } = await supabase.from("list_contacts").insert(payload);
      if (error) throw error;
      const emailOptOuts = rows.filter(
        (r) => r.email && emailBlocked.has(r.email.trim().toLowerCase()),
      ).length;
      return {
        total: rows.length,
        blocked: payload.filter((p) => p.consent === "opt_out").length,
        emailOptOuts,
        emailScreenUnavailable,
      };
    },
    onSuccess: ({ total, blocked, emailOptOuts, emailScreenUnavailable }) => {
      toast.success(`${total} Contacts Imported.`);
      if (blocked > 0) {
        toast.warning(
          `${blocked} ${blocked === 1 ? "Contact Is" : "Contacts Are"} Opted Out And Won't Be Dialed.`,
        );
      }
      if (emailScreenUnavailable) {
        toast.warning("Email Opt-Out Check Unavailable — Treat Every Imported Address As Do Not Email.");
      } else if (emailOptOuts > 0) {
        toast.warning(
          `${emailOptOuts} Email ${emailOptOuts === 1 ? "Address Is" : "Addresses Are"} On The Family-Wide Opt-Out List.`,
        );
      }
      setImportOpen(false);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["call_lists"] });
    },
    onError: (e: any) => toast.error(e.message),

  });

  return (
    <div>
      <PageHeader
        title="Calling Lists"
        description="The contacts your campaigns dial through, with attempts and outcomes."
        tabs={TAB_GROUPS.campaigns}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" disabled={!active} onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>

            <Dialog open={renameOpen} onOpenChange={(o) => { setRenameOpen(o); if (o) setRenameValue(active?.name ?? ""); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl" disabled={!active}>
                  <Pencil className="h-4 w-4 mr-1" /> Rename
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Rename List</DialogTitle></DialogHeader>
                <DialogDescription className="sr-only">Give this calling list a new name.</DialogDescription>
                <div>
                  <Label>List Name</Label>
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                </div>
                <DialogFooter className="justify-between">
                  <Button
                    variant="outline"
                    className="rounded-xl text-[#CC0000] border-[#CC0000]/30 hover:bg-[#CC0000]/5"
                    disabled={deleteList.isPending}
                    onClick={() => {
                      if (confirm("Delete this list and all of its contacts?")) {
                        deleteList.mutate();
                        setRenameOpen(false);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete List
                  </Button>
                  <Button
                    className="bg-[#CC0000] hover:bg-[#A30000]"
                    disabled={!renameValue.trim() || renameList.isPending}
                    onClick={() => renameList.mutate()}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl" disabled={!active}>
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Into {active?.name ?? "List"}</DialogTitle>
                  <DialogDescription className="sr-only">Upload a CSV to add contacts to this list.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>One Contact Per Line — Name, Phone, Email</Label>
                  <Textarea
                    rows={8}
                    placeholder={"Dana Reyes, +1 555 0142, dana@acme.com\nSam Patel, +1 555 0188"}
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button
                    className="bg-[#CC0000] hover:bg-[#A30000]"
                    disabled={!raw.trim() || importContacts.isPending}
                    onClick={() => importContacts.mutate()}
                  >
                    Import Contacts
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={listOpen} onOpenChange={setListOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                  <Plus className="h-4 w-4 mr-1" /> New List
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Calling List</DialogTitle></DialogHeader>
                <DialogDescription className="sr-only">Name a new calling list to group contacts.</DialogDescription>
                <div>
                  <Label>List Name</Label>
                  <Input value={listName} onChange={(e) => setListName(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button
                    className="bg-[#CC0000] hover:bg-[#A30000]"
                    disabled={!listName || createList.isPending}
                    onClick={() => createList.mutate()}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3 rounded-2xl border-[#E7E7EC] shadow-none h-fit">
          <div className="text-xs uppercase tracking-wider text-[#6B6B76] px-2 pb-2">Lists</div>
          {(lists ?? []).length === 0 ? (
            <p className="px-2 py-4 text-sm text-[#6B6B76]">No lists yet.</p>
          ) : (
            (lists ?? []).map((l: any) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(l.id)}
                className={
                  "w-full text-left rounded-xl px-3 py-2 text-sm transition-colors " +
                  (active?.id === l.id ? "bg-[#CC0000]/10 text-[#CC0000] font-medium" : "hover:bg-[#F4F4F6]")
                }
              >
                <div>{l.name}</div>
                <div className="text-xs text-[#6B6B76]">
                  {dialableCount(l)} dialable
                  {blockedCount(l) > 0 ? ` · ${blockedCount(l)} opted out` : ""}
                </div>

              </button>
            ))
          )}
        </Card>

        <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
          {listsLoading ? (
            <SkeletonRows rows={5} />
          ) : !active || (active.list_contacts ?? []).length === 0 ? (
            <EmptyPanel
              icon={ListOrdered}
              title={active ? "No Contacts In This List" : "Pick Or Create A List"}
              hint="Paste rows as name, phone, email — one contact per line."
              action={
                active ? (
                  <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]" onClick={() => setImportOpen(true)}>
                    Import Contacts
                  </Button>
                ) : (
                  <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]" onClick={() => setListOpen(true)}>
                    New List
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="relative mb-3 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B76]" />
                <Input
                  className="pl-9 rounded-xl"
                  placeholder="Search Contacts"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mc-tablewrap">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                      <th className="py-2">Name</th><th className="py-2">Phone</th>
                      <th className="py-2">Email</th><th className="py-2">Attempts</th>
                      <th className="py-2">Last Outcome</th><th className="py-2">Consent</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-[#6B6B76]">No Contacts Match That Search.</td></tr>
                    ) : contacts.map((c: any) => {
                      const onDnc = dncSet.has(digits(c.phone));
                      return (
                        <tr key={c.id} className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50">
                          <td className="py-3 font-medium">{c.name}</td>
                          <td className="py-3 font-mono text-xs">
                            {formatPhone(c.phone)}
                            {onDnc ? <span className="ml-2 align-middle"><StatusPill label="DNC" tone="red" /></span> : null}
                          </td>
                          <td className="py-3 text-[#6B6B76]">{c.email ?? "—"}</td>
                          <td className="py-3 font-mono">{c.attempts}</td>
                          <td className="py-3">
                            {c.last_outcome
                              ? <StatusPill label={titleCase(c.last_outcome)} tone={toneForStatus(c.last_outcome)} />
                              : <span className="text-[#6B6B76]">—</span>}
                          </td>
                          <td className="py-3 capitalize text-[#6B6B76]">{c.consent?.replace("_", " ")}</td>
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="rounded-lg"
                                title="Add To Do Not Call"
                                disabled={onDnc || addToDnc.isPending}
                                onClick={() => addToDnc.mutate(c)}
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-[#CC0000]"
                                title="Remove Contact"
                                onClick={() => { if (confirm(`Remove ${c.name} from this list?`)) deleteContact.mutate(c.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </Card>
      </div>
    </div>
  );
}
