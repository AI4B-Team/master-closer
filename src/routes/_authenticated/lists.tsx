import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonRows, StatusPill, titleCase, toneForStatus } from "@/components/back-office/ui";
import { Download, ListOrdered, Pencil, Plus, Search, ShieldOff, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  return raw
    .split("\n")
    .map((line) => line.split(",").map((p) => p.trim()))
    .filter((parts) => parts[0] && parts[1])
    .map((parts) => ({ name: parts[0]!, phone: parts[1]!, email: parts[2] || null }));
}

function ListsPage() {
  const qc = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState("");

  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ["call_lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_lists")
        .select("*, list_contacts(id, name, phone, email, attempts, last_outcome, consent)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = (lists ?? []).find((l: any) => l.id === selected) ?? (lists ?? [])[0];

  const createList = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const { data, error } = await supabase
        .from("call_lists")
        .insert({ org_id: prof.org_id, name: listName })
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
      const { error } = await supabase
        .from("list_contacts")
        .insert(rows.map((r) => ({ ...r, list_id: active.id })));
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} Contacts Imported.`);
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
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl" disabled={!active}>
                  <Upload className="h-4 w-4 mr-1" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Into {active?.name ?? "List"}</DialogTitle>
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

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
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
                <div className="text-xs text-[#6B6B76]">{l.list_contacts?.length ?? 0} contacts</div>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                  <th className="py-2">Name</th><th className="py-2">Phone</th>
                  <th className="py-2">Email</th><th className="py-2">Attempts</th>
                  <th className="py-2">Last Outcome</th><th className="py-2">Consent</th>
                </tr>
              </thead>
              <tbody>
                {(active.list_contacts ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 font-mono text-xs">{c.phone}</td>
                    <td className="py-3 text-[#6B6B76]">{c.email ?? "—"}</td>
                    <td className="py-3 font-mono">{c.attempts}</td>
                    <td className="py-3">
                      {c.last_outcome
                        ? <StatusPill label={titleCase(c.last_outcome)} tone={toneForStatus(c.last_outcome)} />
                        : <span className="text-[#6B6B76]">—</span>}
                    </td>
                    <td className="py-3 capitalize text-[#6B6B76]">{c.consent?.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
