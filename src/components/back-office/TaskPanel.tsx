import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, ListChecks, Plus, Trash2 } from "lucide-react";
import { EmptyPanel, SkeletonRows } from "@/components/back-office/ui";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  lead_id: string | null;
  deal_id: string | null;
  completed_at: string | null;
  created_at: string;
};

export const PRIORITIES = ["low", "normal", "high"] as const;

export function dueLabel(due: string | null) {
  if (!due) return { text: "No Due Date", tone: "muted" as const };
  const d = new Date(due);
  const today = new Date();
  const days = Math.round((d.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: "late" as const };
  if (days === 0) return { text: "Due Today", tone: "soon" as const };
  if (days === 1) return { text: "Due Tomorrow", tone: "soon" as const };
  return { text: d.toLocaleDateString(), tone: "muted" as const };
}

const TONE_STYLE: Record<string, string> = {
  late: "text-[#CC0000]",
  soon: "text-[#B45309]",
  muted: "text-[#6B6B76]",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "#CC0000",
  normal: "#6B6B76",
  low: "#B7B7C0",
};

/** Compact task list scoped to a lead or deal, used inside detail drawers. */
export function TaskPanel({ leadId, dealId }: { leadId?: string; dealId?: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");
  const scopeKey = ["tasks", { leadId: leadId ?? null, dealId: dealId ?? null }];

  const { data: tasks, isLoading } = useQuery({
    queryKey: scopeKey,
    enabled: !!(leadId || dealId),
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
      if (leadId) q = q.eq("lead_id", leadId);
      if (dealId) q = q.eq("deal_id", dealId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof?.org_id) throw new Error("No workspace found for your account.");
      const { error } = await supabase.from("tasks").insert({
        org_id: prof.org_id,
        title: title.trim(),
        due_at: due ? new Date(due).toISOString() : null,
        priority,
        lead_id: leadId ?? null,
        deal_id: dealId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDue("");
      setPriority("normal");
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Next step — e.g. Send pricing recap"
          className="rounded-xl"
        />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-[150px] rounded-xl" />
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[120px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          className="bg-[#111114] hover:bg-[#111114]/90 rounded-xl"
          disabled={!title.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : !tasks || tasks.length === 0 ? (
        <p className="text-sm text-[#6B6B76]">No follow-ups yet. Add the next step so nothing slips.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const d = dueLabel(t.due_at);
            const done = t.status === "done";
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                <Checkbox checked={done} onCheckedChange={() => toggle.mutate(t)} />
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_DOT[t.priority] ?? "#6B6B76" }}
                />
                <span className={done ? "line-through text-[#9A9AA5]" : "font-medium"}>{t.title}</span>
                <span className={"ml-auto " + (done ? "text-[#9A9AA5]" : TONE_STYLE[d.tone])}>
                  {done ? "Done" : d.text}
                </span>
                <button
                  type="button"
                  aria-label="Delete Task"
                  className="text-[#9A9AA5] hover:text-[#CC0000]"
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { ListChecks, CheckCircle2, EmptyPanel };
