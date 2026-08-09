import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { GraduationCap, Sparkles, Send, RotateCcw } from "lucide-react";
import { closeObjection } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Practice — Master Closer" },
      { name: "description", content: "Scored AI roleplay so reps drill objections before they hit a live call." },
      { property: "og:title", content: "Practice — Master Closer" },
      { property: "og:description", content: "Scored AI roleplay so reps drill objections before they hit a live call." },
    ],
  }),
  component: PracticePage,
});

const MODES = [
  { key: "full_ai", label: "AI", hint: "AI Runs The Call" },
  { key: "hybrid", label: "Hybrid", hint: "AI Starts, Human Closes" },
  { key: "copilot", label: "Copilot", hint: "Human Leads, AI Assists" },
] as const;

const PRESETS = [
  "Honestly, your competitor is cheaper.",
  "I need to think about it.",
  "Send me some information and I'll get back to you.",
  "We already have someone doing this.",
  "This isn't a priority right now.",
];

type Rep = {
  id: number;
  prospect: string;
  objection: string;
  tone: string;
  confidence: number;
  line: string;
};

function PracticePage() {
  const run = useServerFn(closeObjection);
  const [mode, setMode] = useState<string>("copilot");
  const [prospect, setProspect] = useState(PRESETS[0]);
  const [reps, setReps] = useState<Rep[]>([]);

  const ask = useMutation({
    mutationFn: async () => run({ data: { prospect, mode } }),
    onSuccess: (r) =>
      setReps((prev) => [
        { id: Date.now(), prospect, objection: r.objection, tone: r.tone, confidence: r.confidence, line: r.line },
        ...prev,
      ]),
    onError: () => toast.error("Couldn't Reach The Closer Just Now. Try Again In A Moment."),
  });

  const avg = reps.length
    ? Math.round(reps.reduce((s, r) => s + r.confidence, 0) / reps.length)
    : 0;

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="Practice — scored AI roleplay so reps drill objections before a live call."
        tabs={TAB_GROUPS.studio}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
          <div className="flex items-start gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-[#CC0000]" />
            </div>
            <div>
              <h3 className="font-semibold">Drill Room</h3>
              <p className="text-sm text-[#6B6B76]">Throw the objection. Get the exact next line back.</p>
            </div>
          </div>

          <Label>Mode</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={
                  "rounded-xl border px-3 py-2.5 text-left transition-colors " +
                  (mode === m.key
                    ? "border-[#CC0000] bg-[#CC0000]/5"
                    : "border-[#E7E7EC] hover:bg-[#F4F4F6]")
                }
              >
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-[11px] text-[#6B6B76]">{m.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <Label>Prospect Says</Label>
            <Textarea
              rows={3}
              value={prospect}
              onChange={(e) => setProspect(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProspect(p)}
                  className="rounded-full border border-[#E7E7EC] px-3 py-1 text-xs text-[#4A505C] hover:bg-[#F4F4F6]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button
              type="button"
              onClick={() => ask.mutate()}
              disabled={ask.isPending || !prospect.trim()}
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {ask.isPending ? "Thinking…" : "Run The Rep"}
            </Button>
            {reps.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReps([])}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear Session
              </Button>
            )}
          </div>

          {reps[0] && (
            <div className="mt-6 rounded-2xl bg-[#111318] p-5 text-white">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                <Sparkles className="h-3.5 w-3.5 text-[#FF4D4D]" /> Next Best Response
              </div>
              <p className="mt-3 text-lg leading-snug">{reps[0].line}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2.5 py-1">{reps[0].objection}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1">Tone · {reps[0].tone}</span>
                <span className="rounded-full bg-[#CC0000] px-2.5 py-1 font-semibold">
                  {reps[0].confidence}% Close Probability
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
          <h3 className="font-semibold">Session Score</h3>
          <p className="text-sm text-[#6B6B76]">Average close probability across this drill.</p>
          <div className="mt-4 font-num text-4xl font-semibold">{avg}%</div>
          <div className="mt-1 text-xs text-[#6B6B76]">
            {reps.length} rep{reps.length === 1 ? "" : "s"} drilled
          </div>

          <div className="mt-5 space-y-2 max-h-[420px] overflow-y-auto">
            {reps.length === 0 ? (
              <p className="text-sm text-[#6B6B76]">Run a rep to start scoring.</p>
            ) : (
              reps.map((r) => (
                <div key={r.id} className="rounded-xl border border-[#E7E7EC] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px]">{r.objection}</Badge>
                    <span className="font-num text-sm font-semibold">{r.confidence}%</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#6B6B76] line-clamp-2">“{r.prospect}”</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
