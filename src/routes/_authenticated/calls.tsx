import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { PhoneCall, Sparkles, ShieldCheck, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Calls & Transcripts — Master Closer" },
      { name: "description", content: "Every conversation with transcript, AI summary, coaching moves, and consent record." },
      { property: "og:title", content: "Calls & Transcripts — Master Closer" },
      { property: "og:description", content: "Review call history, transcripts and AI coaching moves." },
    ],
  }),
  component: CallsPage,
});

const MODE_LABEL: Record<string, string> = {
  full_ai: "AI", hybrid: "Hybrid", copilot: "Copilot",
};

function fmtDur(sec: number) {
  return `${Math.floor((sec ?? 0) / 60)}m ${(sec ?? 0) % 60}s`;
}

function CallsPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: calls } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calls")
        .select("*, leads(name, company)").order("started_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = calls?.find((c: any) => c.id === openId);

  return (
    <div>
      <PageHeader
        title="Calls"
        description="History — every conversation with transcript, AI summary, and moves."
        tabs={TAB_GROUPS.calls}
      />

      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
        {!calls || calls.length === 0 ? (
          <div className="text-center py-16">
            <PhoneCall className="h-8 w-8 mx-auto text-[#6B6B76] mb-3" />
            <p className="font-medium">No calls yet</p>
            <p className="text-sm text-[#6B6B76] mt-1">Calls appear here once the dialer runs.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Date</th><th className="py-2">Lead</th>
                <th className="py-2">Mode</th><th className="py-2">Duration</th>
                <th className="py-2">Outcome</th><th className="py-2 text-right">Close Probability</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50 cursor-pointer"
                >
                  <td className="py-3 text-[#6B6B76] font-mono text-xs">
                    {new Date(c.started_at).toLocaleString()}
                  </td>
                  <td className="py-3 font-medium">
                    {c.leads?.name ?? "—"}{c.leads?.company ? ` · ${c.leads.company}` : ""}
                  </td>
                  <td className="py-3">
                    <Badge variant="secondary">{MODE_LABEL[c.mode] ?? c.mode}</Badge>
                  </td>
                  <td className="py-3 font-mono">{fmtDur(c.duration_sec)}</td>
                  <td className="py-3 capitalize">{c.outcome}</td>
                  <td className="py-3 text-right font-mono">{c.close_probability ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {active?.leads?.name ?? "Call detail"}
            </SheetTitle>
          </SheetHeader>
          {active ? <CallDetail call={active} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CallDetail({ call }: { call: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["call-detail", call.id],
    queryFn: async () => {
      const [segs, sugg, consent] = await Promise.all([
        supabase.from("transcript_segments").select("*").eq("call_id", call.id).order("ts_sec"),
        supabase.from("suggestions").select("*").eq("call_id", call.id).order("ts_sec"),
        supabase.from("consent_logs").select("*").eq("call_id", call.id).order("disclosed_at"),
      ]);
      return {
        segments: segs.data ?? [],
        suggestions: sugg.data ?? [],
        consent: consent.data ?? [],
      };
    },
  });

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Mode" value={MODE_LABEL[call.mode] ?? call.mode} />
        <Stat label="Outcome" value={String(call.outcome).replace(/_/g, " ")} />
        <Stat label="Duration" value={fmtDur(call.duration_sec)} />
        <Stat label="Close Probability" value={`${call.close_probability ?? 0}%`} />
      </div>

      {call.summary ? (
        <Section icon={Sparkles} title="AI Summary">
          <p className="text-sm text-[#3A3A44] leading-relaxed">{call.summary}</p>
        </Section>
      ) : null}

      {call.recording_url ? (
        <Section icon={PhoneCall} title="Recording">
          <audio controls src={call.recording_url} className="w-full" />
        </Section>
      ) : null}

      <Section icon={MessageSquare} title="Transcript">
        {isLoading ? (
          <p className="text-sm text-[#6B6B76]">Loading…</p>
        ) : data && data.segments.length > 0 ? (
          <div className="space-y-2">
            {data.segments.map((s: any) => (
              <div key={s.id} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-[#6B6B76] w-12 shrink-0 pt-0.5">
                  {String(Math.floor(s.ts_sec / 60)).padStart(2, "0")}:{String(s.ts_sec % 60).padStart(2, "0")}
                </span>
                <span className="font-semibold w-20 shrink-0 capitalize">{s.speaker}</span>
                <span className="text-[#3A3A44]">{s.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B6B76]">No transcript captured for this call.</p>
        )}
      </Section>

      <Section icon={Sparkles} title="AI Moves">
        {data && data.suggestions.length > 0 ? (
          <div className="space-y-3">
            {data.suggestions.map((s: any) => (
              <div key={s.id} className="rounded-xl border border-[#E7E7EC] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wider text-[#6B6B76]">{s.objection}</span>
                  <Badge variant={s.was_used ? "default" : "secondary"}>
                    {s.was_used ? "Used" : "Offered"}
                  </Badge>
                </div>
                <p className="text-sm text-[#3A3A44]">{s.line}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B6B76]">No AI suggestions recorded.</p>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Consent & Disclosure">
        {data && data.consent.length > 0 ? (
          <div className="space-y-2">
            {data.consent.map((c: any) => (
              <div key={c.id} className="text-sm flex items-center justify-between border border-[#E7E7EC] rounded-xl px-3 py-2">
                <span className="capitalize">{String(c.method).replace(/_/g, " ")}</span>
                <span className="text-xs text-[#6B6B76] font-mono">
                  {c.jurisdiction ?? "—"} · {new Date(c.disclosed_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B6B76]">No disclosure logged for this call.</p>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F4F4F6] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-[#6B6B76]">{label}</div>
      <div className="font-semibold capitalize">{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-[#CC0000]" />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      {children}
    </div>
  );
}
