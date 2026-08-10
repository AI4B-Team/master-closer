import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneCall, Sparkles, ShieldCheck, MessageSquare, Search, Download, BookPlus, Check, CalendarClock, Plus } from "lucide-react";
import { EmptyPanel, SkeletonRows } from "@/components/back-office/ui";
import { usePrefs } from "@/hooks/use-prefs";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { summarizeCall } from "@/lib/calls.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toCsv, downloadCsv, stampedName } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/calls")({
  validateSearch: (s: Record<string, unknown>): { campaign?: string; agent?: string; call?: string; mode?: string } => ({
    campaign: typeof s.campaign === "string" ? s.campaign : undefined,
    agent: typeof s.agent === "string" ? s.agent : undefined,
    call: typeof s.call === "string" ? s.call : undefined,
    mode: typeof s.mode === "string" ? s.mode : undefined,
  }),
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

const OUTCOMES = ["scheduled", "in_progress", "completed", "no_answer", "voicemail", "failed"];
const RANGES: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

function CallsPage() {
  const sp = Route.useSearch();
  const [openId, setOpenId] = useState<string | null>(sp.call ?? null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState(sp.mode ?? "all");
  const [outcome, setOutcome] = useState("all");
  const [range, setRange] = useState("all");
  const [agent, setAgent] = useState(sp.agent ?? "all");
  const [campaign, setCampaign] = useState(sp.campaign ?? "all");

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ["calls", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("calls")
        .select("*, leads(name, company), agents(name), campaigns(name)").eq("workspace_id", wsId!).order("started_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-min", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name").eq("workspace_id", wsId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: campaignOptions } = useQuery({
    queryKey: ["campaigns-min", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("id, name").eq("workspace_id", wsId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = calls?.find((c: any) => c.id === openId);

  const filtered = (calls ?? []).filter((c: any) => {
    const q = search.toLowerCase();
    if (search && !(
      c.leads?.name?.toLowerCase().includes(q) ||
      c.leads?.company?.toLowerCase().includes(q) ||
      c.agents?.name?.toLowerCase().includes(q) ||
      c.campaigns?.name?.toLowerCase().includes(q) ||
      c.disposition?.toLowerCase().includes(q) ||
      c.summary?.toLowerCase().includes(q)
    )) return false;
    if (mode !== "all" && c.mode !== mode) return false;
    if (outcome !== "all" && c.outcome !== outcome) return false;
    if (agent === "none" ? !!c.agent_id : agent !== "all" && c.agent_id !== agent) return false;
    if (campaign === "none" ? !!c.campaign_id : campaign !== "all" && c.campaign_id !== campaign) return false;
    if (range !== "all") {
      const cutoff = Date.now() - RANGES[range] * 86400000;
      if (new Date(c.started_at).getTime() < cutoff) return false;
    }
    return true;
  });

  function exportCsv() {
    if (filtered.length === 0) return;
    const csv = toCsv(
      ["Date", "Lead", "Company", "Agent", "Campaign", "Mode", "Outcome", "Disposition", "Duration (sec)", "Close Probability"],
      filtered.map((c: any) => [
        new Date(c.started_at).toISOString(),
        c.leads?.name ?? "",
        c.leads?.company ?? "",
        c.agents?.name ?? "",
        c.campaigns?.name ?? "",
        MODE_LABEL[c.mode] ?? c.mode,
        c.outcome,
        c.disposition ?? "",
        c.duration_sec ?? 0,
        c.close_probability ?? 0,
      ]),
    );
    downloadCsv(stampedName("calls"), csv);
  }

  const connected = filtered.filter((c: any) => c.outcome === "completed").length;
  const talkTime = filtered.reduce((s: number, c: any) => s + (c.duration_sec ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Calls"
        description="History — every conversation with transcript, AI summary, and moves."
        tabs={TAB_GROUPS.calls}
        action={
          <Button type="button" variant="outline" className="rounded-xl" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        }
      />

      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B76]" />
            <Input placeholder="Search Lead, Company, Agent, Campaign, Or Summary" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="full_ai">AI</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="copilot">Copilot</SelectItem>
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              {OUTCOMES.map((o) => (
                <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="none">No Agent</SelectItem>
              {(agents ?? []).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="none">No Campaign</SelectItem>
              {(campaignOptions ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-[#6B6B76] mb-4">
          <span><b className="text-[#111114]">{filtered.length}</b> Calls</span>
          <span><b className="text-[#111114]">{connected}</b> Completed</span>
          <span><b className="text-[#111114]">{Math.round(talkTime / 60)}</b> Min Talk Time</span>
        </div>

        {callsLoading ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyPanel
            icon={PhoneCall}
            title="No Calls Found"
            hint="Calls land here once the dialer runs. Try simulation mode to see a full call end to end."
            action={
              <Link to="/dialer" className="mc-btn-link">
                <Button type="button" className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]">Open Dialer</Button>
              </Link>
            }
          />
        ) : (
          <div className="mc-tablewrap"><table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Lead</th>
                <th className="py-2 pr-4">Agent</th>
                <th className="py-2 pr-4">Campaign</th>
                <th className="py-2 pr-4">Mode</th><th className="py-2 pr-4 whitespace-nowrap">Duration</th>
                <th className="py-2 pr-4">Outcome</th><th className="py-2 text-right whitespace-nowrap">Close Probability</th>
              </tr>

            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50 cursor-pointer"
                >
                  <td className="py-3 pr-4 text-[#6B6B76] font-mono text-xs">
                    {new Date(c.started_at).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    {c.leads?.name ?? "—"}{c.leads?.company ? ` · ${c.leads.company}` : ""}
                  </td>
                  <td className="py-3 pr-4 text-[#6B6B76]">{c.agents?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-[#6B6B76]">{c.campaigns?.name ?? "—"}</td>

                  <td className="py-3 pr-4">
                    <Badge variant="secondary">{MODE_LABEL[c.mode] ?? c.mode}</Badge>
                  </td>
                  <td className="py-3 pr-4 font-mono whitespace-nowrap">{fmtDur(c.duration_sec)}</td>
                  <td className="py-3 pr-4">{prettyOutcome(c.disposition ?? c.outcome)}</td>
                  <td className="py-3 text-right font-mono">{c.close_probability ?? 0}%</td>

                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {active?.leads?.name ?? "Call detail"}
            </SheetTitle>
            <SheetDescription className="sr-only">Review this call's transcript, outcome and recording.</SheetDescription>
          </SheetHeader>
          {active ? <CallDetail call={active} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CallDetail({ call }: { call: any }) {
  const { data: detailWorkspace } = useWorkspace();
  const wsId = detailWorkspace?.id ?? null;
  const [saved, setSaved] = useState<string[]>([]);
  const promote = useMutation({
    mutationFn: async (p: { id: string; trigger: string; response: string }) => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof?.org_id) throw new Error("No workspace found");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { error } = await supabase.from("objections").insert({
        org_id: prof.org_id, workspace_id: prof.active_workspace_id,
        trigger: p.trigger,
        response: p.response,
        category: "From Call",
      });
      if (error) throw error;
      return p.id;
    },
    onSuccess: (id: string) => {
      setSaved((s) => [...s, id]);
      toast.success("Added To Playbook");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add to playbook"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["call-detail", call.id, wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const [segs, sugg, consent] = await Promise.all([
        supabase.from("transcript_segments").select("*").eq("call_id", call.id).eq("workspace_id", wsId!).order("ts_sec"),
        supabase.from("suggestions").select("*").eq("call_id", call.id).eq("workspace_id", wsId!).order("ts_sec"),
        supabase.from("consent_logs").select("*").eq("call_id", call.id).eq("workspace_id", wsId!).order("disclosed_at"),
      ]);
      return {
        segments: segs.data ?? [],
        suggestions: sugg.data ?? [],
        consent: consent.data ?? [],
      };
    },
  });

  const qc = useQueryClient();
  const summarize = useServerFn(summarizeCall);
  const [summary, setSummary] = useState<string | null>(call.summary ?? null);
  const [taskTitle, setTaskTitle] = useState("");

  const followUps = useQuery({
    queryKey: ["call-tasks", call.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, due_at, priority")
        .eq("call_id", call.id)
        .order("due_at", { nullsFirst: false });
      return data ?? [];
    },
  });

  const genSummary = useMutation({
    mutationFn: async () => {
      const lines = (data?.segments ?? []).map((s: any) => ({ speaker: s.speaker, text: s.text }));
      const res: any = await summarize({
        data: {
          mode: call.mode,
          outcome: call.disposition ?? String(call.outcome),
          prospect: call.leads?.name ?? null,
          lines,
        },
      });
      const text: string = res?.summary ?? "";
      const { error } = await supabase.from("calls").update({ summary: text }).eq("id", call.id);
      if (error) throw error;
      return { text, nextStep: res?.next_step as string | null };
    },
    onSuccess: ({ text, nextStep }) => {
      setSummary(text);
      if (nextStep && !taskTitle) setTaskTitle(nextStep);
      qc.invalidateQueries({ queryKey: ["calls"] });
      toast.success("Summary Written");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not write the summary"),
  });

  const addFollowUp = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("id, org_id, active_workspace_id").maybeSingle();
      if (!prof?.org_id) throw new Error("No workspace found");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const due = new Date();
      due.setDate(due.getDate() + 2);
      const { error } = await supabase.from("tasks").insert({
        org_id: prof.org_id, workspace_id: prof.active_workspace_id,
        title: taskTitle.trim().slice(0, 200),
        notes: summary ?? null,
        due_at: due.toISOString(),
        priority: "medium",
        status: "open",
        assignee_id: prof.id,
        created_by: prof.id,
        call_id: call.id,
        lead_id: call.lead_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTaskTitle("");
      followUps.refetch();
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Follow-Up Created");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not create the follow-up"),
  });

  return (
    <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Mode" value={MODE_LABEL[call.mode] ?? call.mode} />
        <Stat label="Outcome" value={String(call.outcome).replace(/_/g, " ")} />
        <Stat label="Duration" value={fmtDur(call.duration_sec)} />
        <Stat label="Close Probability" value={`${call.close_probability ?? 0}%`} />
        <Stat label="Agent" value={call.agents?.name ?? "No Agent"} />
        <Stat label="Campaign" value={call.campaigns?.name ?? "No Campaign"} />
      </div>

      <div className="flex flex-wrap gap-2">
        {call.lead_id ? (
          <Link to="/leads" search={{ lead: call.lead_id } as any} className="mc-btn-link">
            <Button type="button" variant="outline" size="sm" className="rounded-xl">Open Lead</Button>
          </Link>
        ) : null}
        {call.campaign_id ? (
          <Link to="/campaigns" className="mc-btn-link">
            <Button type="button" variant="outline" size="sm" className="rounded-xl">Open Campaign</Button>
          </Link>
        ) : null}
      </div>


      <Section icon={Sparkles} title="AI Summary">
        {summary ? (
          <p className="text-sm text-[#3A3A44] leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-[#6B6B76]">No summary yet for this call.</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => genSummary.mutate()}
          disabled={genSummary.isPending || isLoading}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {genSummary.isPending ? "Writing…" : summary ? "Rewrite Summary" : "Write Summary"}
        </Button>
      </Section>

      <Section icon={CalendarClock} title="Follow-Ups">
        {(followUps.data ?? []).length > 0 ? (
          <div className="space-y-2 mb-3">
            {(followUps.data ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-[#3A3A44]">{t.title}</span>
                <Badge variant="outline" className="capitalize">
                  {t.status}
                  {t.due_at ? ` · ${new Date(t.due_at).toLocaleDateString()}` : ""}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6B6B76] mb-3">No follow-ups on this call yet.</p>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Next step"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => addFollowUp.mutate()}
            disabled={!taskTitle.trim() || addFollowUp.isPending}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </Section>


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
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#6B6B76]">{s.objection}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.was_used ? "default" : "secondary"}>
                      {s.was_used ? "Used" : "Offered"}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={promote.isPending || saved.includes(s.id)}
                      onClick={() => promote.mutate({ id: s.id, trigger: s.objection, response: s.line })}
                    >
                      {saved.includes(s.id) ? (
                        <><Check className="h-3.5 w-3.5 mr-1" />In Playbook</>
                      ) : (
                        <><BookPlus className="h-3.5 w-3.5 mr-1" />Add To Playbook</>
                      )}
                    </Button>
                  </div>
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
  const { t } = usePrefs();
  return (
    <div className="rounded-xl bg-[#F4F4F6] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-[#6B6B76]">{t(label)}</div>
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
