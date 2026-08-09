import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonRows, Kpi, KPI_TINTS, StatusPill, toneForStatus } from "@/components/back-office/ui";
import { Megaphone, Pause, Play, Plus, PhoneOutgoing, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Master Closer" },
      { name: "description", content: "Outbound campaigns tied to calling lists, AI closers, and autonomy modes." },
      { property: "og:title", content: "Campaigns — Master Closer" },
      { property: "og:description", content: "Outbound campaigns tied to calling lists, AI closers, and autonomy modes." },
    ],
  }),
  component: CampaignsPage,
});

const MODES = [
  { value: "full_ai", label: "AI" },
  { value: "hybrid", label: "Hybrid" },
  { value: "copilot", label: "Copilot" },
] as const;

const MODE_LABEL: Record<string, string> = { full_ai: "AI", hybrid: "Hybrid", copilot: "Copilot" };

function CampaignsPage() {
  const qc = useQueryClient();
  const emit = useServerFn(emitOrgEvent);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", mode: "copilot", agent_id: "", list_id: "", goal: "", daily_cap: "100",
  });

  const emptyForm = { name: "", mode: "copilot", agent_id: "", list_id: "", goal: "", daily_cap: "100" };

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, agents(name), call_lists(name, list_contacts(id))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-min"],
    queryFn: async () => (await supabase.from("agents").select("id, name").order("name")).data ?? [],
  });

  const { data: lists } = useQuery({
    queryKey: ["lists-min"],
    queryFn: async () =>
      (await supabase.from("call_lists").select("id, name, list_contacts(id)").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const { data: callStats } = useQuery({
    queryKey: ["campaign-call-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("campaign_id, dial_outcome").limit(2000);
      return data ?? [];
    },
  });

  const statsFor = (id: string) => {
    const rows = (callStats ?? []).filter((c: any) => c.campaign_id === id);
    return { dialed: rows.length, connects: rows.filter((c: any) => c.dial_outcome === "connected").length };
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          org_id: prof.org_id,
          name: form.name,
          mode: form.mode as any,
          agent_id: form.agent_id || null,
          list_id: form.list_id || null,
          goal: form.goal || null,
          daily_cap: Number(form.daily_cap) || 100,
          status: "draft",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Campaign Created.");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase
        .from("campaigns")
        .update({
          name: form.name,
          mode: form.mode as any,
          agent_id: form.agent_id || null,
          list_id: form.list_id || null,
          goal: form.goal || null,
          daily_cap: Number(form.daily_cap) || 100,
        })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign Updated.");
      setEditId(null);
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign Deleted.");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function startEdit(c: any) {
    setEditId(c.id);
    setForm({
      name: c.name ?? "",
      mode: c.mode ?? "copilot",
      agent_id: c.agent_id ?? "",
      list_id: c.list_id ?? "",
      goal: c.goal ?? "",
      daily_cap: String(c.daily_cap ?? 100),
    });
    setOpen(true);
  }


  const setStatus = useMutation({
    mutationFn: async ({ id, status, name, mode }: { id: string; status: string; name: string; mode: string }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "active") {
        try {
          await emit({ data: { event_type: "campaign.launched", payload: { campaign_id: id, name, mode } } });
        } catch {
          // Never block the launch on hub availability.
        }
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "active" ? "Campaign Launched." : "Campaign Paused.");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const all = campaigns ?? [];
  const active = all.filter((c: any) => c.status === "active").length;
  const contactsQueued = all.reduce(
    (n: number, c: any) => n + (c.call_lists?.list_contacts?.length ?? 0),
    0,
  );
  const totalDialed = (callStats ?? []).length;

  const term = search.trim().toLowerCase();
  const visible = all.filter((c: any) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (term) {
      const hay = [c.name, c.goal ?? "", c.agents?.name ?? "", c.call_lists?.name ?? ""].join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Outbound campaigns tied to lists, closers, and autonomy modes."
        tabs={TAB_GROUPS.campaigns}
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) { setEditId(null); setForm(emptyForm); }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit Campaign" : "New Campaign"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mode</Label>
                    <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Daily Cap</Label>
                    <Input
                      type="number"
                      value={form.daily_cap}
                      onChange={(e) => setForm({ ...form, daily_cap: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>AI Closer</Label>
                  <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {(agents ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Calling List</Label>
                  <Select value={form.list_id} onValueChange={(v) => setForm({ ...form, list_id: v })}>
                    <SelectTrigger><SelectValue placeholder="No list attached" /></SelectTrigger>
                    <SelectContent>
                      {(lists ?? []).map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} · {l.list_contacts?.length ?? 0} contacts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Goal</Label>
                  <Textarea
                    rows={2}
                    placeholder="Book demos with revenue teams over 20 reps."
                    value={form.goal}
                    onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => (editId ? save.mutate() : create.mutate())}
                  disabled={!form.name || create.isPending || save.isPending}
                  className="bg-[#CC0000] hover:bg-[#A30000]"
                >
                  {editId ? "Save Changes" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="kpis">
        <Kpi label="Active Campaigns" value={String(active)} icon={Megaphone} {...KPI_TINTS.red} />
        <Kpi label="Contacts Queued" value={String(contactsQueued)} icon={Users} {...KPI_TINTS.blue} />
        <Kpi label="Calls Dialed" value={String(totalDialed)} icon={PhoneOutgoing} {...KPI_TINTS.mint} />
        <Kpi label="Total Campaigns" value={String(all.length)} icon={Target} {...KPI_TINTS.lavender} />
      </div>

      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none mt-4">
        {campaignsLoading ? (
          <SkeletonRows rows={5} />
        ) : all.length === 0 ? (
          <EmptyPanel
            icon={Megaphone}
            title="No Campaigns Yet"
            hint="Build a calling list, then launch your first campaign with a dialing window."
            action={
              <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]" onClick={() => setOpen(true)}>
                New Campaign
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Campaign</th><th className="py-2">Mode</th>
                <th className="py-2">Closer</th><th className="py-2">List</th>
                <th className="py-2">Dialed / Connects</th><th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((c: any) => {
                const s = statsFor(c.id);
                return (
                  <tr key={c.id} className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50">
                    <td className="py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.goal && <div className="text-xs text-[#6B6B76]">{c.goal}</div>}
                    </td>
                    <td className="py-3"><Badge variant="secondary">{MODE_LABEL[c.mode] ?? c.mode}</Badge></td>
                    <td className="py-3 text-[#6B6B76]">{c.agents?.name ?? "—"}</td>
                    <td className="py-3 text-[#6B6B76]">
                      {c.call_lists?.name
                        ? `${c.call_lists.name} · ${c.call_lists.list_contacts?.length ?? 0}`
                        : "—"}
                    </td>
                    <td className="py-3 font-mono">{s.dialed} / {s.connects}</td>
                    <td className="py-3"><StatusPill label={c.status} tone={toneForStatus(c.status)} /></td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        {c.status === "active" ? (
                          <Button
                            size="sm" variant="outline" className="rounded-xl"
                            onClick={() => setStatus.mutate({ id: c.id, status: "paused", name: c.name, mode: c.mode })}
                          >
                            <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                          </Button>
                        ) : (
                          <Button
                            size="sm" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]"
                            onClick={() => setStatus.mutate({ id: c.id, status: "active", name: c.name, mode: c.mode })}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" /> Launch
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                          <Link to="/dialer">Dial</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
