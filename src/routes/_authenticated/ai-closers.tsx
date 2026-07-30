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
import { PageHeader } from "@/components/back-office/AppShell";
import { Plus, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-closers")({
  head: () => ({ meta: [{ title: "AI Closers — Master Closer" }] }),
  component: AIClosers,
});

function AIClosers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", default_mode: "hybrid", voice: "aria" });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const { error } = await supabase.from("agents").insert({
        ...form, default_mode: form.default_mode as any, org_id: prof.org_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agent created.");
      setOpen(false);
      setForm({ name: "", industry: "", default_mode: "hybrid", voice: "aria" });
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
        title="AI Closers"
        description="Build a Master Closer: identity, knowledge, autonomy, and where to transfer."
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
                <div>
                  <Label>Voice</Label>
                  <Select value={form.voice} onValueChange={(v) => setForm({ ...form, voice: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aria">Aria</SelectItem>
                      <SelectItem value="marcus">Marcus</SelectItem>
                      <SelectItem value="june">June</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

      {!agents || agents.length === 0 ? (
        <Card className="p-16 rounded-2xl border-[#E7E7EC] shadow-none text-center">
          <Bot className="h-10 w-10 mx-auto text-[#CC0000] mb-3" />
          <p className="font-semibold">No AI Closers yet</p>
          <p className="text-sm text-[#6B6B76] mt-1">Create your first agent to start closing calls.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <Card key={a.id} className="p-5 rounded-2xl border-[#E7E7EC] shadow-none">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-[#CC0000]" />
                </div>
                <Switch checked={a.active} onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })} />
              </div>
              <h3 className="font-semibold">{a.name}</h3>
              <p className="text-xs text-[#6B6B76] mt-1">{a.industry ?? "General"}</p>
              <div className="flex gap-2 mt-3">
                <Badge variant="secondary" className="capitalize">{a.default_mode.replace("_", " ")}</Badge>
                <Badge variant="outline" className="capitalize">{a.voice}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
