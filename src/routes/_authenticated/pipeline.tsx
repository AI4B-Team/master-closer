import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonCards } from "@/components/back-office/ui";
import { Plus, Trash2, GripVertical, KanbanSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Master Closer" },
      { name: "description", content: "Drag deals from first touch to signed, with value, close probability and expected close date." },
      { property: "og:title", content: "Pipeline — Master Closer" },
      { property: "og:description", content: "Drag deals from first touch to signed, with value, close probability and expected close date." },
    ],
  }),
  component: PipelinePage,
});

const STAGES = [
  { key: "new", label: "New" },
  { key: "qualifying", label: "Qualifying" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

function PipelinePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    value: "0",
    stage: "new",
    close_probability: "50",
    expected_close_at: "",
    lead_id: "",
  });

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals")
        .select("*").order("sort_order", { ascending: true }).order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["deal-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("leads")
        .select("id,name,company").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const leadName = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads ?? []) map.set(l.id, l.company ? `${l.name} · ${l.company}` : l.name);
    return map;
  }, [leads]);

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const { error } = await supabase.from("deals").insert({
        title: form.title,
        value: Number(form.value) || 0,
        stage: form.stage as any,
        close_probability: Math.max(0, Math.min(100, Number(form.close_probability) || 0)),
        expected_close_at: form.expected_close_at || null,
        lead_id: form.lead_id || null,
        org_id: prof.org_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal created.");
      setOpen(false);
      setForm({ title: "", value: "0", stage: "new", close_probability: "50", expected_close_at: "", lead_id: "" });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage, index }: { id: string; stage: string; index: number }) => {
      const column = (deals ?? []).filter((d) => d.stage === stage && d.id !== id);
      const at = Math.max(0, Math.min(column.length, index));
      const ordered = [...column.slice(0, at).map((d) => d.id), id, ...column.slice(at).map((d) => d.id)];
      const now = new Date().toISOString();
      for (let i = 0; i < ordered.length; i++) {
        const payload =
          ordered[i] === id
            ? { sort_order: i + 1, stage: stage as any, updated_at: now }
            : { sort_order: i + 1 };
        const { error } = await supabase.from("deals").update(payload).eq("id", ordered[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal removed.");
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openValue = (deals ?? [])
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((s, d) => s + Number(d.value ?? 0), 0);
  const weighted = (deals ?? [])
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((s, d) => s + (Number(d.value ?? 0) * Number(d.close_probability ?? 0)) / 100, 0);

  function drop(stage: string, index?: number) {
    const id = dragId;
    const target = index ?? overIndex;
    setOverStage(null);
    setOverIndex(null);
    setDragId(null);
    if (!id) return;
    const current = (deals ?? []).find((d) => d.id === id);
    if (!current) return;
    const column = (deals ?? []).filter((d) => d.stage === stage);
    const withoutDragged = column.filter((d) => d.id !== id);
    const at = target ?? withoutDragged.length;
    const currentIndex = column.findIndex((d) => d.id === id);
    if (current.stage === stage && (currentIndex === at || currentIndex === at - 1)) return;
    move.mutate({ id, stage, index: current.stage === stage && currentIndex < at ? at - 1 : at });
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Pipeline — deals from first touch to signed. Drag a card to change stage or reorder it."
        tabs={TAB_GROUPS.leads}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> New Deal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Value ($)</Label>
                    <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
                  </div>
                  <div>
                    <Label>Close Probability (%)</Label>
                    <Input type="number" min={0} max={100} value={form.close_probability}
                      onChange={(e) => setForm({ ...form, close_probability: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Stage</Label>
                    <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expected Close</Label>
                    <Input type="date" value={form.expected_close_at}
                      onChange={(e) => setForm({ ...form, expected_close_at: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Linked Lead</Label>
                  <Select value={form.lead_id || "none"} onValueChange={(v) => setForm({ ...form, lead_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(leads ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.company ? `${l.name} · ${l.company}` : l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending} className="bg-[#CC0000] hover:bg-[#A30000]">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="secondary" className="rounded-lg font-normal">
          Open Pipeline <span className="font-mono ml-1.5">{money(openValue)}</span>
        </Badge>
        <Badge variant="secondary" className="rounded-lg font-normal">
          Weighted Forecast <span className="font-mono ml-1.5">{money(Math.round(weighted))}</span>
        </Badge>
      </div>

      {dealsLoading ? (
        <SkeletonCards count={6} height={180} />
      ) : (deals ?? []).length === 0 ? (
        <EmptyPanel
          icon={KanbanSquare}
          title="No Deals In The Pipeline"
          hint="Create your first deal, or work a lead until it's worth forecasting."
          action={
            <>
              <Button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]"
              >
                <Plus className="h-4 w-4 mr-1.5" /> New Deal
              </Button>
              <Button asChild type="button" variant="outline" className="rounded-xl">
                <Link to="/leads" search={{ q: undefined, lead: undefined }}>Go To Leads</Link>
              </Button>
            </>
          }
        />
      ) : (
      <div className="grid grid-cols-6 gap-3 overflow-x-auto">
        {STAGES.map((s) => {
          const items = (deals ?? []).filter((d) => d.stage === s.key);
          const total = items.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
          const isOver = overStage === s.key;
          return (
            <div
              key={s.key}
              className="min-w-[200px]"
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }}
              onDragLeave={() => {
                setOverStage((c) => (c === s.key ? null : c));
                setOverIndex(null);
              }}
              onDrop={(e) => { e.preventDefault(); drop(s.key); }}
            >
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider">{s.label}</span>
                <span className="text-xs text-[#6B6B76]">{items.length}</span>
              </div>
              <div className="text-[10px] text-[#6B6B76] px-1 mb-2 font-mono">
                {money(total)}
              </div>
              <div
                className={`space-y-2 min-h-[140px] rounded-xl p-1 transition ${
                  isOver ? "bg-[#CC0000]/5 ring-1 ring-[#CC0000]/30" : ""
                }`}
              >
                {items.map((d, idx) => (
                  <div key={d.id}>
                    {isOver && overIndex === idx && dragId && dragId !== d.id ? (
                      <div className="h-0.5 rounded-full bg-[#CC0000] mb-2" />
                    ) : null}
                  <Card
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); setOverIndex(null); }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      setOverStage(s.key);
                      setOverIndex(after ? idx + 1 : idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      drop(s.key, after ? idx + 1 : idx);
                    }}
                    className={`group p-3 rounded-xl border-[#E7E7EC] shadow-none hover:border-[#CC0000] transition cursor-grab active:cursor-grabbing ${
                      dragId === d.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="h-3.5 w-3.5 text-[#C4C4CC] mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        {d.lead_id && leadName.get(d.lead_id) ? (
                          <div className="text-[11px] text-[#6B6B76] truncate mt-0.5">
                            {leadName.get(d.lead_id)}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => remove.mutate(d.id)}
                      >
                        <Trash2 className="h-3 w-3 text-[#6B6B76]" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono">{money(Number(d.value ?? 0))}</span>
                      <span className="text-[11px] text-[#6B6B76] font-mono">
                        {Number(d.close_probability ?? 0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-[#F1F1F4] overflow-hidden">
                      <div
                        className="h-full bg-[#CC0000]"
                        style={{ width: `${Math.max(0, Math.min(100, Number(d.close_probability ?? 0)))}%` }}
                      />
                    </div>
                    {d.expected_close_at ? (
                      <div className="text-[10px] text-[#6B6B76] font-mono mt-1.5">
                        Close {new Date(d.expected_close_at).toLocaleDateString()}
                      </div>
                    ) : null}
                  </Card>
                    {isOver && overIndex === idx + 1 && idx === items.length - 1 && dragId && dragId !== d.id ? (
                      <div className="h-0.5 rounded-full bg-[#CC0000] mt-2" />
                    ) : null}
                  </div>
                ))}
                {items.length === 0 ? (
                  <p className="text-[11px] text-[#A0A0AA] text-center py-6">Drop Here</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
