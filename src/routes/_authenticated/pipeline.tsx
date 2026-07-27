import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/back-office/AppShell";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — Master Closer" }] }),
  component: PipelinePage,
});

const STAGES = [
  { key: "new", label: "New" },
  { key: "qualifying", label: "Qualifying" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

function PipelinePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "0", stage: "new" });

  const { data: deals } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals")
        .select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const { error } = await supabase.from("deals").insert({
        title: form.title,
        value: Number(form.value) || 0,
        stage: form.stage as any,
        org_id: prof.org_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal created.");
      setOpen(false);
      setForm({ title: "", value: "0", stage: "new" });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage: stage as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Deals from first touch to signed."
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
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Value ($)</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
                <div>
                  <Label>Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
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

      <div className="grid grid-cols-6 gap-3 overflow-x-auto">
        {STAGES.map((s) => {
          const items = (deals ?? []).filter((d) => d.stage === s.key);
          const total = items.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
          return (
            <div key={s.key} className="min-w-[200px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold uppercase tracking-wider">{s.label}</span>
                <span className="text-xs text-[#6B6B76]">{items.length}</span>
              </div>
              <div className="text-[10px] text-[#6B6B76] px-1 mb-2 font-mono">
                ${total.toLocaleString()}
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map((d) => (
                  <Card key={d.id} className="p-3 rounded-xl border-[#E7E7EC] shadow-none hover:border-[#CC0000] transition">
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="text-xs text-[#6B6B76] font-mono mt-1">
                      ${Number(d.value).toLocaleString()}
                    </div>
                    <Select value={d.stage} onValueChange={(v) => move.mutate({ id: d.id, stage: v })}>
                      <SelectTrigger className="h-7 mt-2 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((st) => <SelectItem key={st.key} value={st.key}>{st.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
