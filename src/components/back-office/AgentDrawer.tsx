import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2, Sparkles, Wand2, RefreshCw, Scissors, Megaphone, Copy } from "lucide-react";
import { VoicePicker } from "@/components/back-office/VoicePicker";
import { AgentQuickDrill } from "@/components/back-office/AgentQuickDrill";

import { helpSystemPrompt } from "@/lib/agents.functions";
import { useServerFn } from "@tanstack/react-start";

type Agent = {
  id: string;
  name: string;
  industry: string | null;
  voice: string | null;
  voices: string[] | null;
  default_mode: string;
  active: boolean;
  system_prompt: string | null;
  transfer_to?: string | null;
};

const NO_TRANSFER = "none";

export function AgentDrawer({
  agent,
  onOpenChange,
}: {
  agent: Agent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Agent>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const aiHelp = useServerFn(helpSystemPrompt);

  const { data: members } = useQuery({
    queryKey: ["transfer-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (agent) setForm({ ...agent });
  }, [agent]);



  const runAiHelp = async (instruction: "generate" | "improve" | "shorten" | "tone") => {
    if (!form.name) {
      toast.error("Add a name first so AI knows who this closer is.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiHelp({
        data: {
          name: form.name,
          industry: form.industry ?? null,
          mode: (form.default_mode ?? "hybrid") as "full_ai" | "hybrid" | "copilot",
          current: form.system_prompt ?? null,
          instruction,
        },
      });
      setForm((f) => ({ ...f, system_prompt: res.prompt }));
      toast.success("Prompt updated.");
    } catch (e: any) {
      toast.error(e?.message ?? "AI help failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agents")
        .update({
          name: form.name ?? "",
          industry: form.industry || null,
          voice: form.voices?.[0] || form.voice || null,
          voices: form.voices ?? [],
          default_mode: (form.default_mode ?? "hybrid") as never,
          active: form.active ?? true,
          system_prompt: form.system_prompt || null,
          transfer_to: form.transfer_to || null,
        })
        .eq("id", agent!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closer updated.");
      qc.invalidateQueries({ queryKey: ["agents"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agents").delete().eq("id", agent!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closer deleted.");
      qc.invalidateQueries({ queryKey: ["agents"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { error } = await supabase.from("agents").insert({
        org_id: prof.org_id, workspace_id: prof.active_workspace_id,
        name: `${form.name ?? agent!.name} (Copy)`,
        industry: form.industry || null,
        voice: form.voices?.[0] || form.voice || null,
        voices: form.voices ?? [],
        default_mode: (form.default_mode ?? "hybrid") as never,
        active: false,
        system_prompt: form.system_prompt || null,
        transfer_to: form.transfer_to || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closer duplicated — the copy starts inactive.");
      qc.invalidateQueries({ queryKey: ["agents"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{agent?.name ?? "AI Closer"}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#E7E7EC] px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-[#6B6B76]">Inactive closers are skipped by campaigns.</p>
            </div>
            <Switch
              checked={form.active ?? false}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
          </div>

          <div>
            <Label>Name</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <Label>Industry</Label>
            <Input value={form.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>

          <VoicePicker
            value={form.voices ?? []}
            onChange={(voices) => setForm({ ...form, voices })}
          />


          <div>
            <Label>Default Mode</Label>
            <Select value={form.default_mode ?? "hybrid"} onValueChange={(v) => setForm({ ...form, default_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_ai">AI — AI Runs The Call</SelectItem>
                <SelectItem value="hybrid">Hybrid — AI Starts, Human Closes</SelectItem>
                <SelectItem value="copilot">Copilot — Human Leads, AI Assists</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Transfer To</Label>
            <Select
              value={form.transfer_to ?? NO_TRANSFER}
              onValueChange={(v) => setForm({ ...form, transfer_to: v === NO_TRANSFER ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="No Human Closer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TRANSFER}>No Human Closer</SelectItem>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email || "Teammate"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#6B6B76] mt-1">
              {form.default_mode === "hybrid"
                ? "This closer hands the call to this teammate once the prospect is warm."
                : "Used when a call is escalated or the prospect asks for a human."}
            </p>
          </div>

          <div>

            <div className="flex items-start justify-between gap-3 mb-1.5">
              <Label className="mt-1.5 shrink-0">System Prompt</Label>
              <div className="flex flex-wrap justify-end items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiLoading}
                  onClick={() => runAiHelp("generate")}
                  className="h-7 text-xs rounded-lg border-[#E7E7EC] hover:border-[#CC0000]/40 hover:bg-[#CC0000]/5"
                >
                  {aiLoading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  Generate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiLoading || !form.system_prompt}
                  onClick={() => runAiHelp("improve")}
                  className="h-7 text-xs rounded-lg border-[#E7E7EC] hover:border-[#CC0000]/40 hover:bg-[#CC0000]/5"
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Improve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiLoading || !form.system_prompt}
                  onClick={() => runAiHelp("shorten")}
                  className="h-7 text-xs rounded-lg border-[#E7E7EC] hover:border-[#CC0000]/40 hover:bg-[#CC0000]/5"
                >
                  <Scissors className="h-3 w-3 mr-1" /> Shorten
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiLoading || !form.system_prompt}
                  onClick={() => runAiHelp("tone")}
                  className="h-7 text-xs rounded-lg border-[#E7E7EC] hover:border-[#CC0000]/40 hover:bg-[#CC0000]/5"
                >
                  <Megaphone className="h-3 w-3 mr-1" /> Tone Up
                </Button>
              </div>
            </div>
            <Textarea
              rows={10}
              value={form.system_prompt ?? ""}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              placeholder="You are a closer for a home services company. Open with the disclosure, qualify budget and timeline, and never argue price — reframe to value."
              className="text-sm"
            />
            <p className="text-xs text-[#6B6B76] mt-1">
              This drives how the closer speaks, qualifies, and handles objections on every call.
            </p>
          </div>

          {agent && (
            <AgentQuickDrill
              agentId={agent.id}
              name={form.name ?? agent.name}
              industry={form.industry}
              systemPrompt={form.system_prompt}
              mode={form.default_mode ?? "hybrid"}
            />
          )}


          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={!form.name || save.isPending}
              className="bg-[#111114] hover:bg-[#111114]/90 rounded-xl"
            >
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-[#E7E7EC]"
              onClick={() => duplicate.mutate()}
              disabled={duplicate.isPending || !form.name}
            >
              <Copy className="h-4 w-4 mr-1" /> Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-[#CC0000] hover:text-[#A30000]"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
