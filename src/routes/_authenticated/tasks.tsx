import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, Kpi, KPI_TINTS, Panel, SkeletonRows } from "@/components/back-office/ui";
import { PRIORITIES, dueLabel, type TaskRow } from "@/components/back-office/TaskPanel";
import { ListChecks, Plus, Trash2, CalendarClock, CheckCircle2, AlarmClock, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Follow-Ups — Master Closer" },
      { name: "description", content: "Track every next step after the call so no deal goes cold on your desk." },
      { property: "og:title", content: "Follow-Ups — Master Closer" },
      { property: "og:description", content: "Track every next step after the call so no deal goes cold on your desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TasksPage,
});

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "today", label: "Due Today" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Completed" },
] as const;

const PRIORITY_DOT: Record<string, string> = {
  high: "#CC0000",
  normal: "#6B6B76",
  low: "#B7B7C0",
};

const TONE_STYLE: Record<string, string> = {
  late: "text-[#CC0000]",
  soon: "text-[#B45309]",
  muted: "text-[#6B6B76]",
};

function isToday(due: string | null) {
  if (!due) return false;
  const d = new Date(due);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due).getTime() < new Date().setHours(0, 0, 0, 0);
}

function TasksPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", due: "", priority: "normal", lead_id: "" });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, leads(id, name, company)")
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as (TaskRow & { leads: { id: string; name: string; company: string | null } | null })[];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["tasks-lead-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("id, name").order("name").limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof?.org_id) throw new Error("No workspace found for your account.");
      const { error } = await supabase.from("tasks").insert({
        org_id: prof.org_id,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        due_at: form.due ? new Date(form.due).toISOString() : null,
        priority: form.priority,
        lead_id: form.lead_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up added.");
      setOpen(false);
      setForm({ title: "", notes: "", due: "", priority: "normal", lead_id: "" });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: TaskRow) => {
      const done = t.status !== "done";
      const { error } = await supabase
        .from("tasks")
        .update({ status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const all = tasks ?? [];
  const openTasks = all.filter((t) => t.status !== "done");
  const counts = {
    open: openTasks.length,
    today: openTasks.filter((t) => isToday(t.due_at)).length,
    overdue: openTasks.filter((t) => isOverdue(t.due_at)).length,
    done: all.filter((t) => t.status === "done").length,
  };

  const visible = all.filter((t) => {
    if (filter === "done") return t.status === "done";
    if (t.status === "done") return false;
    if (filter === "today") return isToday(t.due_at);
    if (filter === "overdue") return isOverdue(t.due_at);
    return true;
  });

  return (
    <>
      <PageHeader
        title="Leads"
        description="Follow-ups — every next step after the call, in one queue."
        tabs={TAB_GROUPS.leads}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> New Follow-Up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Follow-Up</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Task</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Send pricing recap and book the close call"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Linked Lead</Label>
                  <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {(leads ?? []).map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Context your closer needs before the next touch."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
                  disabled={!form.title.trim() || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Add Follow-Up
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="kpis">
        <Kpi label="Open" value={String(counts.open)} icon={ListChecks} {...KPI_TINTS.blue} />
        <Kpi label="Due Today" value={String(counts.today)} icon={CalendarClock} {...KPI_TINTS.mint} />
        <Kpi label="Overdue" value={String(counts.overdue)} icon={AlarmClock} {...KPI_TINTS.red} />
        <Kpi label="Completed" value={String(counts.done)} icon={CheckCircle2} {...KPI_TINTS.lavender} />
      </div>

      <Panel
        title="Follow-Up Queue"
        action={
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (filter === f.key ? "bg-[#111114] text-white" : "text-[#6B6B76] hover:bg-[#F4F4F6]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : visible.length === 0 ? (
          <EmptyPanel
            icon={ListChecks}
            title="Nothing In This Queue"
            hint="Add a follow-up so the next step on every deal has a date attached."
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((t) => {
              const d = dueLabel(t.due_at);
              const done = t.status === "done";
              return (
                <li key={t.id} className="flex items-start gap-3 rounded-xl border border-[#E7E7EC] px-3 py-3">
                  <Checkbox checked={done} onCheckedChange={() => toggle.mutate(t)} className="mt-1" />
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: PRIORITY_DOT[t.priority] ?? "#6B6B76" }}
                  />
                  <div className="min-w-0">
                    <p className={"text-sm " + (done ? "line-through text-[#9A9AA5]" : "font-medium")}>{t.title}</p>
                    <p className="text-xs text-[#6B6B76]">
                      {t.leads ? t.leads.name + (t.leads.company ? " · " + t.leads.company : "") : "Unlinked"}
                      {t.notes ? " — " + t.notes : ""}
                    </p>
                  </div>
                  <span className={"ml-auto shrink-0 text-sm " + (done ? "text-[#9A9AA5]" : TONE_STYLE[d.tone])}>
                    {done ? "Done" : d.text}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete Task"
                    className="mt-0.5 text-[#9A9AA5] hover:text-[#CC0000]"
                    onClick={() => remove.mutate(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
