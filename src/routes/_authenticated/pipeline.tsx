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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonCards } from "@/components/back-office/ui";
import {
  Plus, Trash2, GripVertical, KanbanSquare, MoreHorizontal, Pencil,
  ArrowLeft, ArrowRight, Columns3,
} from "lucide-react";
import { DealDrawer, type DealRow } from "@/components/back-office/DealDrawer";
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

type Stage = {
  id: string;
  org_id: string;
  label: string;
  position: number;
  kind: string;
  wip_limit: number | null;
  stale_days: number | null;
};

function daysSince(iso?: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const LEGACY_STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"] as const;

function legacyStage(stage: Stage | undefined) {
  if (!stage) return "new";
  const slug = stage.label.trim().toLowerCase();
  if ((LEGACY_STAGES as readonly string[]).includes(slug)) return slug;
  if (stage.kind === "won") return "won";
  if (stage.kind === "lost") return "lost";
  return "new";
}

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n.toLocaleString()}`;

function PipelinePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [colOpen, setColOpen] = useState(false);
  const [selected, setSelected] = useState<DealRow | null>(null);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [colForm, setColForm] = useState({ label: "", kind: "open", wip_limit: "", stale_days: "14" });
  const [form, setForm] = useState({
    title: "",
    value: "0",
    stage_id: "",
    close_probability: "50",
    expected_close_at: "",
    lead_id: "",
  });

  const { data: stages, isLoading: stagesLoading } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipeline_stages")
        .select("*").order("position", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Stage[];
    },
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

  const columns = stages ?? [];
  const selectedDeal = selected
    ? ((deals ?? []).find((d) => d.id === selected.id) as DealRow | undefined) ?? selected
    : null;
  const firstStage = columns[0];
  const stageById = useMemo(() => new Map(columns.map((s) => [s.id, s])), [columns]);

  // Deals with no column yet land in the first column.
  const columnOf = (d: any) => (d.stage_id && stageById.has(d.stage_id) ? d.stage_id : firstStage?.id ?? null);
  const itemsIn = (stageId: string) => (deals ?? []).filter((d) => columnOf(d) === stageId);

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const stage = stageById.get(form.stage_id) ?? firstStage;
      const { error } = await supabase.from("deals").insert({
        title: form.title,
        value: Number(form.value) || 0,
        stage: legacyStage(stage) as any,
        stage_id: stage?.id ?? null,
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
      setForm({ title: "", value: "0", stage_id: firstStage?.id ?? "", close_probability: "50", expected_close_at: "", lead_id: "" });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stageId, index }: { id: string; stageId: string; index: number }) => {
      const column = itemsIn(stageId).filter((d) => d.id !== id);
      const at = Math.max(0, Math.min(column.length, index));
      const ordered = [...column.slice(0, at).map((d) => d.id), id, ...column.slice(at).map((d) => d.id)];
      const now = new Date().toISOString();
      const stage = stageById.get(stageId);
      for (let i = 0; i < ordered.length; i++) {
        const payload =
          ordered[i] === id
            ? { sort_order: i + 1, stage_id: stageId, stage: legacyStage(stage) as any, updated_at: now }
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

  const saveColumn = useMutation({
    mutationFn: async () => {
      const label = colForm.label.trim();
      if (!label) throw new Error("Give the column a name.");
      const limitRaw = Number(colForm.wip_limit);
      const wip_limit = colForm.wip_limit.trim() && limitRaw > 0 ? Math.round(limitRaw) : null;
      const staleRaw = Number(colForm.stale_days);
      const stale_days = Number.isFinite(staleRaw) && staleRaw >= 0 ? Math.round(staleRaw) : 14;
      if (editing) {
        const { error } = await supabase.from("pipeline_stages")
          .update({ label, kind: colForm.kind, wip_limit, stale_days }).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const nextPos = (columns.at(-1)?.position ?? 0) + 1;
      const { error } = await supabase.from("pipeline_stages")
        .insert({ org_id: prof.org_id, label, kind: colForm.kind, position: nextPos, wip_limit, stale_days });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Column updated." : "Column added.");
      setColOpen(false);
      setEditing(null);
      setColForm({ label: "", kind: "open", wip_limit: "", stale_days: "14" });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderColumn = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = columns.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= columns.length) return;
      const next = [...columns];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      for (let i = 0; i < next.length; i++) {
        const { error } = await supabase.from("pipeline_stages")
          .update({ position: i + 1 }).eq("id", next[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      if (columns.length <= 1) throw new Error("Keep at least one column.");
      const fallback = columns.find((s) => s.id !== id);
      if (!fallback) throw new Error("Keep at least one column.");
      const stranded = itemsIn(id);
      for (const d of stranded) {
        const { error } = await supabase.from("deals")
          .update({ stage_id: fallback.id, stage: legacyStage(fallback) as any })
          .eq("id", d.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
      return stranded.length;
    },
    onSuccess: (moved) => {
      toast.success(moved ? `Column deleted. ${moved} deal(s) moved.` : "Column deleted.");
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isOpenStage = (d: any) => {
    const s = stageById.get(columnOf(d) ?? "");
    return !s || s.kind === "open";
  };
  const openValue = (deals ?? []).filter(isOpenStage).reduce((s, d) => s + Number(d.value ?? 0), 0);
  const weighted = (deals ?? []).filter(isOpenStage)
    .reduce((s, d) => s + (Number(d.value ?? 0) * Number(d.close_probability ?? 0)) / 100, 0);

  function drop(stageId: string, index?: number) {
    const id = dragId;
    const target = index ?? overIndex;
    setOverStage(null);
    setOverIndex(null);
    setDragId(null);
    if (!id) return;
    const current = (deals ?? []).find((d) => d.id === id);
    if (!current) return;
    const column = itemsIn(stageId);
    const withoutDragged = column.filter((d) => d.id !== id);
    const at = target ?? withoutDragged.length;
    const currentIndex = column.findIndex((d) => d.id === id);
    const sameColumn = columnOf(current) === stageId;
    if (sameColumn && (currentIndex === at || currentIndex === at - 1)) return;
    move.mutate({ id, stageId, index: sameColumn && currentIndex < at ? at - 1 : at });
  }

  function openNewColumn() {
    setEditing(null);
    setColForm({ label: "", kind: "open", wip_limit: "", stale_days: "14" });
    setColOpen(true);
  }

  function openEditColumn(s: Stage) {
    setEditing(s);
    setColForm({
      label: s.label,
      kind: s.kind,
      wip_limit: s.wip_limit ? String(s.wip_limit) : "",
      stale_days: String(s.stale_days ?? 14),
    });
    setColOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Pipeline — deals from first touch to signed. Drag a card to change stage or reorder it."
        tabs={TAB_GROUPS.leads}
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={openNewColumn}>
              <Columns3 className="h-4 w-4 mr-1" /> Add Column
            </Button>
            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v);
              if (v && !form.stage_id) setForm((f) => ({ ...f, stage_id: firstStage?.id ?? "" }));
            }}>
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
                      <Select value={form.stage_id || firstStage?.id || ""} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {columns.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
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
          </div>
        }
      />

      <Dialog open={colOpen} onOpenChange={setColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Column" : "Add Column"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Column Name</Label>
              <Input value={colForm.label} placeholder="Discovery"
                onChange={(e) => setColForm({ ...colForm, label: e.target.value })} />
            </div>
            <div>
              <Label>Column Type</Label>
              <Select value={colForm.kind} onValueChange={(v) => setColForm({ ...colForm, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open — Counts Toward Forecast</SelectItem>
                  <SelectItem value="won">Won — Closed Revenue</SelectItem>
                  <SelectItem value="lost">Lost — Removed From Forecast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Card Limit</Label>
                <Input type="number" min={0} placeholder="No Limit" value={colForm.wip_limit}
                  onChange={(e) => setColForm({ ...colForm, wip_limit: e.target.value })} />
                <p className="text-[11px] text-[#6B6B76] mt-1">Warn when this column holds more cards than this.</p>
              </div>
              <div>
                <Label>Stalled After (Days)</Label>
                <Input type="number" min={0} value={colForm.stale_days}
                  onChange={(e) => setColForm({ ...colForm, stale_days: e.target.value })} />
                <p className="text-[11px] text-[#6B6B76] mt-1">Flag a deal that sits here without an update. 0 turns it off.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => saveColumn.mutate()}
              disabled={!colForm.label.trim() || saveColumn.isPending}
              className="bg-[#CC0000] hover:bg-[#A30000]">
              {editing ? "Save Changes" : "Add Column"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="secondary" className="rounded-lg font-normal">
          Open Pipeline <span className="font-mono ml-1.5">{money(openValue)}</span>
        </Badge>
        <Badge variant="secondary" className="rounded-lg font-normal">
          Weighted Forecast <span className="font-mono ml-1.5">{money(Math.round(weighted))}</span>
        </Badge>
      </div>

      {dealsLoading || stagesLoading ? (
        <SkeletonCards count={6} height={180} />
      ) : columns.length === 0 ? (
        <EmptyPanel
          icon={Columns3}
          title="No Pipeline Columns Yet"
          hint="Add your first column to start building a pipeline."
          action={
            <Button type="button" onClick={openNewColumn} className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]">
              <Plus className="h-4 w-4 mr-1.5" /> Add Column
            </Button>
          }
        />
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
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((s, colIdx) => {
          const items = itemsIn(s.id);
          const total = items.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
          const isOver = overStage === s.id;
          const limit = s.wip_limit ?? 0;
          const overLimit = limit > 0 && items.length > limit;
          const staleAfter = s.kind === "open" ? (s.stale_days ?? 14) : 0;
          const stalledCount = staleAfter > 0
            ? items.filter((d) => daysSince(d.updated_at) > staleAfter).length
            : 0;
          return (
            <div
              key={s.id}
              className="min-w-[210px] flex-1"
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
              onDragLeave={() => {
                setOverStage((c) => (c === s.id ? null : c));
                setOverIndex(null);
              }}
              onDrop={(e) => { e.preventDefault(); drop(s.id); }}
            >
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider truncate">{s.label}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs font-mono ${overLimit ? "text-[#CC0000] font-semibold" : "text-[#6B6B76]"}`}>
                    {limit > 0 ? `${items.length}/${limit}` : items.length}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5 text-[#6B6B76]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => openEditColumn(s)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename / Type
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={colIdx === 0}
                        onClick={() => reorderColumn.mutate({ id: s.id, dir: -1 })}
                      >
                        <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Move Left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={colIdx === columns.length - 1}
                        onClick={() => reorderColumn.mutate({ id: s.id, dir: 1 })}
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-2" /> Move Right
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={openNewColumn}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add Column
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={columns.length <= 1}
                        className="text-[#CC0000]"
                        onClick={() => deleteColumn.mutate(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Column
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                      setOverStage(s.id);
                      setOverIndex(after ? idx + 1 : idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const after = e.clientY > rect.top + rect.height / 2;
                      drop(s.id, after ? idx + 1 : idx);
                    }}
                    onClick={() => setSelected(d as DealRow)}
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
                        onClick={(e) => { e.stopPropagation(); remove.mutate(d.id); }}
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

      <DealDrawer
        deal={selectedDeal}
        stages={columns.map((c) => ({ id: c.id, label: c.label, kind: c.kind }))}
        leads={(leads ?? []).map((l) => ({ id: l.id, name: l.name, company: l.company }))}
        legacyStage={(stage) => legacyStage(stage as Stage | undefined)}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
      />
    </div>
  );
}
