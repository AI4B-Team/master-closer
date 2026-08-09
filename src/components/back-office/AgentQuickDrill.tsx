import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, GraduationCap, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { closeObjection } from "@/lib/demo.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { fetchObjectionLibrary } from "@/lib/objections";

const MODE_LABEL: Record<string, string> = {
  full_ai: "AI Says To Prospect",
  hybrid: "AI Briefs Your Closer",
  copilot: "Next Best Response",
};

const SUGGESTED = [
  "Honestly, your competitor is cheaper.",
  "I need to think about it.",
  "Just send me some information.",
];

type Drill = { objection: string; tone: string; confidence: number; line: string; source?: "library" | "ai" };

/** Run a live objection drill against this agent's own prompt, industry, and mode. */
export function AgentQuickDrill({
  agentId,
  name,
  industry,
  systemPrompt,
  mode,
}: {
  agentId: string;
  name: string;
  industry?: string | null;
  systemPrompt?: string | null;
  mode: string;
}) {
  const qc = useQueryClient();
  const run = useServerFn(closeObjection);
  const [prospect, setProspect] = useState(SUGGESTED[0]);
  const [result, setResult] = useState<Drill | null>(null);

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: history } = useQuery({
    queryKey: ["agent-drills", agentId, wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_sessions")
        .select("id, prospect, objection, confidence, created_at")
        .eq("agent_id", agentId)
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const drill = useMutation({
    mutationFn: async () => {
      const res = await run({
        data: {
          prospect,
          mode: mode === "full_ai" ? "ai" : mode,
          agentName: name,
          industry: industry ?? null,
          systemPrompt: systemPrompt ?? null,
          library: await fetchObjectionLibrary(),
        },
      });
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
        if (!prof) throw new Error("No profile");
        if (!prof.active_workspace_id) throw new Error("No active workspace");
        await supabase.from("practice_sessions").insert({
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
          agent_id: agentId,
          mode,
          prospect,
          objection: res.objection,
          tone: res.tone,
          confidence: res.confidence,
          line: res.line,
        });
      return res;
    },
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["agent-drills", agentId] });
      qc.invalidateQueries({ queryKey: ["practice-scores"] });
    },
    onError: (e: Error) => toast.error(e.message || "Drill failed."),
  });

  return (
    <div className="rounded-xl border border-[#E7E7EC] p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <GraduationCap className="h-4 w-4 text-[#CC0000]" />
        <Label className="mb-0">Quick Drill</Label>
      </div>
      <p className="text-xs text-[#6B6B76] mb-3">
        Throw this closer a real objection and see the exact line it would use.
      </p>

      <div className="flex gap-2">
        <Input
          value={prospect}
          onChange={(e) => setProspect(e.target.value)}
          placeholder="Honestly, your competitor is cheaper."
          className="text-sm"
        />
        <Button
          type="button"
          className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl shrink-0"
          disabled={!prospect.trim() || drill.isPending}
          onClick={() => drill.mutate()}
        >
          {drill.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setProspect(s)}
            className="rounded-full border border-[#E7E7EC] px-2.5 py-1 text-[11px] text-[#6B6B76] hover:border-[#CC0000]/40"
          >
            {s}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-3 rounded-xl bg-[#FAFAFB] border border-[#E7E7EC] p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">{result.objection}</Badge>
            <Badge variant="outline">{result.tone}</Badge>
            <Badge variant="outline" className="text-[#CC0000] border-[#CC0000]/30">
              {result.confidence}% Close Probability
            </Badge>
            {result.source === "library" && (
              <Badge variant="outline" className="border-[#E7E7EC] text-[#6B6B76]">
                From Playbook
              </Badge>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-wide text-[#6B6B76] mb-1">
            {MODE_LABEL[mode] ?? "Next Best Response"}
          </p>
          <p className="text-sm font-medium leading-relaxed">{result.line}</p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-xs text-[#6B6B76]">
              <span className="truncate">{h.objection ?? h.prospect}</span>
              <span className="shrink-0 font-medium text-[#111114]">{h.confidence}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
