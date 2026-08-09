import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { Plus, Bot, GraduationCap } from "lucide-react";
import { AgentDrawer } from "@/components/back-office/AgentDrawer";
import { EmptyPanel, SkeletonCards } from "@/components/back-office/ui";
import { VoicePicker } from "@/components/back-office/VoicePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-closers")({
  head: () => ({
    meta: [
      { title: "AI Closers — Master Closer" },
      { name: "description", content: "Build AI closers: identity, voice, industry knowledge, autonomy mode, and system prompt." },
      { property: "og:title", content: "AI Closers — Master Closer" },
      { property: "og:description", content: "Build AI closers: identity, voice, industry knowledge, autonomy mode, and system prompt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AIClosers,
});

function AIClosers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; industry: string; default_mode: string; voices: string[] }>({ name: "", industry: "", default_mode: "hybrid", voices: ["aria"] });
  const [selected, setSelected] = useState<any>(null);

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: scores } = useQuery({
    queryKey: ["practice-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("practice_sessions").select("agent_id, confidence");
      const map: Record<string, { avg: number; count: number }> = {};
      const sums: Record<string, { total: number; count: number }> = {};
      for (const row of data ?? []) {
        if (!row.agent_id) continue;
        const s = sums[row.agent_id] ?? { total: 0, count: 0 };
        s.total += row.confidence ?? 0;
        s.count += 1;
        sums[row.agent_id] = s;
      }
      for (const [id, s] of Object.entries(sums)) {
        map[id] = { avg: Math.round(s.total / s.count), count: s.count };
      }
      return map;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const { error } = await supabase.from("agents").insert({
        name: form.name,
        industry: form.industry,
        default_mode: form.default_mode as any,
        voices: form.voices,
        voice: form.voices[0] ?? null,
        org_id: prof.org_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent created.");
      setOpen(false);
      setForm({ name: "", industry: "", default_mode: "hybrid", voices: ["aria"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from("agents").update({ active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="Closers — identity, knowledge, autonomy, and where to transfer."
        tabs={TAB_GROUPS.studio}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> New Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New AI Closer</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aria — Insurance Closer" /></div>
                <div><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Home Services" /></div>
                <div>
                  <Label>Default Mode</Label>
                  <Select value={form.default_mode} onValueChange={(v) => setForm({ ...form, default_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_ai">AI</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="copilot">Copilot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <VoicePicker value={form.voices} onChange={(voices) => setForm({ ...form, voices })} />
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending} className="bg-[#CC0000] hover:bg-[#A30000]">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {agentsLoading ? (
        <SkeletonCards count={6} height={150} />
      ) : !agents || agents.length === 0 ? (
        <EmptyPanel
          icon={Bot}
          title="No AI Closers Yet"
          hint="Pick a voice, an industry, and an autonomy mode — your closer is live in under a minute."
          action={
            <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]" onClick={() => setOpen(true)}>
              Build Closer
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <Card
              key={a.id}
              onClick={() => setSelected(a)}
              className="p-5 rounded-2xl border-[#E7E7EC] shadow-none cursor-pointer transition-colors hover:border-[#CC0000]/40"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-[#CC0000]" />
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={a.active} onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })} />
                </div>
              </div>
              <h3 className="font-semibold">{a.name}</h3>
              <p className="text-xs text-[#6B6B76] mt-1">{a.industry ?? "General"}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="capitalize">{a.default_mode.replace("_", " ")}</Badge>
                {((a.voices?.length ? a.voices : [a.voice]).filter(Boolean) as string[]).map((v) => (
                  <Badge key={v} variant="outline" className="capitalize">{v.replace("custom:", "Custom ")}</Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#6B6B76]">
                <GraduationCap className="h-3.5 w-3.5 text-[#CC0000]" />
                {scores?.[a.id]
                  ? `${scores[a.id].avg}% Drill Score · ${scores[a.id].count} Rep${scores[a.id].count === 1 ? "" : "s"}`
                  : "No Drills Yet"}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AgentDrawer agent={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
