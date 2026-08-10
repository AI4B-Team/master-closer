import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, Kpi, KPI_TINTS, Panel, SkeletonRows, StatusPill } from "@/components/back-office/ui";
import {
  Bot, Play, Pause, ShieldCheck, ShieldAlert, Inbox, ListChecks, Sparkles, Check, X,
  ThumbsUp, ThumbsDown, Undo2, Activity, Gauge,
  MessageSquareText, Radar, CalendarClock, GraduationCap, Lightbulb,
} from "lucide-react";

import { toast } from "sonner";
import {
  listAgents, setAgentMode, pauseAllAgents, runAgentNow, listProposals, reviewProposal,
  listWorklist, sendWorklistFeedback, undoWorklistFeedback, conversationsReport,
} from "@/lib/governance.functions";

type AgentsView = "registry" | "proposals" | "worklist" | "insights";

export const Route = createFileRoute("/_authenticated/agents")({
  validateSearch: (s: Record<string, unknown>): { view?: AgentsView } => {
    const v = String(s.view ?? "");
    return ["registry", "proposals", "worklist", "insights"].includes(v) ? { view: v as AgentsView } : {};
  },
  head: () => ({
    meta: [
      { title: "Intelligence Agents — Master Closer" },
      {
        name: "description",
        content:
          "Six autonomous agents that learn from finished calls, plus the proposal inbox where a human approves every change before it reaches a live conversation.",
      },
      { property: "og:title", content: "Intelligence Agents — Master Closer" },
      {
        property: "og:description",
        content: "Learning loop, human-approved, auditable. Every agent ships flag-only with a kill switch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});

const MODES = [
  { key: "off", label: "Off" },
  { key: "flag_only", label: "Flag Only" },
  { key: "active", label: "Active" },
] as const;

const VIEWS = [
  { key: "registry", label: "Overview", icon: Bot },
  { key: "proposals", label: "Proposals", icon: Inbox },
  { key: "worklist", label: "Suggested Worklist", icon: ListChecks },
  { key: "insights", label: "Learning", icon: Sparkles },
] as const;

function timeAgo(iso?: string | null) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just Now";
  if (mins < 60) return `${mins}m Ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h Ago`;
  return `${Math.round(hrs / 24)}d Ago`;
}

function valueText(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

function AgentsPage() {
  const qc = useQueryClient();
  const { view: viewParam } = Route.useSearch();
  const [view, setView] = useState<AgentsView>(viewParam ?? "registry");

  const fetchAgents = useServerFn(listAgents);
  const fetchProposals = useServerFn(listProposals);
  const fetchWorklist = useServerFn(listWorklist);
  const fetchReport = useServerFn(conversationsReport);

  const agentsQ = useQuery({ queryKey: ["bg-agents"], queryFn: () => fetchAgents({}) });
  const proposalsQ = useQuery({ queryKey: ["bg-proposals"], queryFn: () => fetchProposals({}) });
  const worklistQ = useQuery({ queryKey: ["bg-worklist"], queryFn: () => fetchWorklist({}) });
  const reportQ = useQuery({ queryKey: ["bg-report"], queryFn: () => fetchReport({}) });

  const modeFn = useServerFn(setAgentMode);
  const pauseFn = useServerFn(pauseAllAgents);
  const runFn = useServerFn(runAgentNow);

  const setMode = useMutation({
    mutationFn: (v: { id: string; mode: "off" | "flag_only" | "active" }) => modeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bg-agents"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const pauseAll = useMutation({
    mutationFn: (paused: boolean) => pauseFn({ data: { paused } }),
    onSuccess: (r) => {
      toast.success(r.paused ? "All Agents Paused" : "Agents Resumed");
      qc.invalidateQueries({ queryKey: ["bg-agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: (id?: string) => runFn({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(r.ran ? `${r.ran} Agent Run Logged` : "Nothing Due");
      qc.invalidateQueries({ queryKey: ["bg-agents"] });
      qc.invalidateQueries({ queryKey: ["bg-proposals"] });
      qc.invalidateQueries({ queryKey: ["bg-worklist"] });
      qc.invalidateQueries({ queryKey: ["bg-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = (proposalsQ.data?.proposals ?? []).filter((p: any) => p.status === "pending").length;
  const paused = agentsQ.data?.paused ?? false;

  return (
    <div className="page">
      <PageHeader
        title="Intelligence Agents"
        description="Six specialized agents analyze completed calls, surface opportunities, and propose improvements for your approval. Nothing changes without you."
        tabs={TAB_GROUPS.studio}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => runNow.mutate(undefined)} disabled={runNow.isPending}>
              <Play size={14} /> Run Due Tasks
            </Button>
            <Button variant={paused ? "default" : "outline"} onClick={() => pauseAll.mutate(!paused)}>
              <Pause size={14} /> {paused ? "Resume All" : "Pause All"}
            </Button>
          </div>
        }
      />

      <div className="kpis">
        <Kpi icon={Bot} label="Active Agents" value={String((agentsQ.data?.agents ?? []).filter((a: any) => a.enabled).length)} {...KPI_TINTS.blue} />
        <Kpi icon={Inbox} label="Pending Proposals" value={String(pendingCount)} {...KPI_TINTS.lavender} />
        <Kpi icon={Activity} label="Calls Analyzed" value={String(reportQ.data?.total ?? 0)} {...KPI_TINTS.mint} />
        <Kpi icon={ShieldAlert} label="Needs Review" value={String(reportQ.data?.flagged ?? 0)} {...KPI_TINTS.red} />
      </div>


      <div className="tabs" style={{ margin: "4px 0 14px" }}>
        {VIEWS.map((v) => (
          <button key={v.key} className={"tab " + (view === v.key ? "tab-on" : "")} onClick={() => setView(v.key)}>
            {v.label}
            {v.key === "proposals" && pendingCount ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {view === "registry" && (
        <Registry
          loading={agentsQ.isLoading}
          agents={agentsQ.data?.agents ?? []}
          onMode={(id, mode) => setMode.mutate({ id, mode })}
          onRun={(id) => runNow.mutate(id)}
        />
      )}

      {view === "proposals" && (
        <Proposals loading={proposalsQ.isLoading} proposals={proposalsQ.data?.proposals ?? []} />
      )}

      {view === "worklist" && <Worklist loading={worklistQ.isLoading} rows={worklistQ.data?.rows ?? []} />}

      {view === "insights" && (
        <Insights
          loading={reportQ.isLoading}
          report={reportQ.data}
          weights={agentsQ.data?.weights ?? []}
          defaults={agentsQ.data?.defaultWeights ?? {}}
        />
      )}
    </div>
  );
}

/* --------------------------------- Registry ------------------------------------ */

const AGENT_ICONS: Record<string, any> = {
  conversation_labeler: MessageSquareText,
  lead_scout: Radar,
  hot_lead_scorer: Gauge,
  booking_auditor: CalendarClock,
  coach: GraduationCap,
  wisdom_miner: Lightbulb,
};

const EMPTY_HINTS: Record<string, string> = {
  conversation_labeler: "No new finished calls were available during this run.",
  lead_scout: "No leads met the nomination bar during this run.",
  hot_lead_scorer: "Not enough labeled outcomes collected yet for the first refit.",
  booking_auditor: "No booking drift detected.",
  coach: "No coachable pattern reached the evidence threshold.",
  wisdom_miner: "No eligible takeover examples found.",
};

function RunRow({ r }: { r: any }) {
  return (
    <div className="runrow">
      <div className="runcell rc-run" data-label="Run">{timeAgo(r.started_at)}</div>
      <div className="runcell rc-status" data-label="Status">
        <StatusPill
          label={r.status === "ok" ? "Ok" : r.status === "skipped" ? "Skipped" : "Failed"}
          tone={r.status === "ok" ? "green" : r.status === "skipped" ? "neutral" : "red"}
        />
      </div>
      <div className="runcell rc-num font-num" data-label="Examined">{r.items_examined}</div>
      <div className="runcell rc-num font-num" data-label="Actioned">{r.items_actioned}</div>
      <div className="runcell rc-num font-num" data-label="Flagged">{r.items_flagged}</div>
      <div className="runcell rc-sum muted" data-label="Summary">{r.error ?? r.summary ?? "—"}</div>
    </div>
  );
}

function AgentCard({
  a, onMode, onRun,
}: {
  a: any;
  onMode: (id: string, mode: "off" | "flag_only" | "active") => void;
  onRun: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = AGENT_ICONS[a.agent_key] ?? Bot;
  const runs: any[] = a.runs ?? [];
  const latest = runs[0];
  const rest = runs.slice(1);
  const allZero =
    runs.length > 0 && runs.every((r) => !r.items_actioned && !r.items_flagged && r.status !== "failed");

  return (
    <div className="mc-card agent-card">
      <div className="agent-head">
        <div className="agent-id">
          <span className="agent-ico"><Icon size={17} strokeWidth={2.1} /></span>
          <h3 className="font-display card-h">{a.meta.name}</h3>
        </div>
        <div className="agent-ctl">
          <span className="pill pill-quiet">{a.meta.cadence}</span>
          <div className="segmented">
            {MODES.map((m) => {
              const blocked = m.key === "active" && !a.meta.canActivate;
              return (
                <button
                  key={m.key}
                  className={"seg " + (a.mode === m.key ? "seg-on" : "")}
                  disabled={blocked}
                  title={blocked ? "This agent has no active mode; it proposes only." : undefined}
                  onClick={() => onMode(a.id, m.key)}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => onRun(a.id)}>
            <Play size={13} /> Run Now
          </Button>
        </div>
      </div>

      <p className="agent-blurb">{a.meta.blurb}</p>

      <div className="agent-meta">
        <StatusPill
          label={a.enabled ? (a.mode === "active" ? "Active" : a.mode === "off" ? "Off" : "Flag Only") : "Paused"}
          tone={a.mode === "active" && a.enabled ? "green" : a.enabled ? "neutral" : "amber"}
        />
        {!a.meta.canActivate && <span className="pill pill-quiet">Proposals Only</span>}
        <span className="pill pill-quiet">Last Run {timeAgo(a.last_run_at)}</span>
        <span className="pill pill-quiet">Next Run {timeAgo(a.next_run_at)}</span>
        {a.pending > 0 && <StatusPill label={`${a.pending} Waiting`} tone="amber" />}
        {a.consecutive_failures >= 3 && <StatusPill label="Disabled After 3 Failures" tone="red" />}
      </div>

      {runs.length === 0 ? (
        <p className="agent-note">No runs yet. This agent has not been due since it was enabled.</p>
      ) : allZero ? (
        <>
          <p className="agent-note">{latest.summary || EMPTY_HINTS[a.agent_key] || "Nothing to act on during this run."}</p>
          {rest.length > 0 && (
            <button className="link-btn" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide Run History" : `View Run History (${rest.length})`}
            </button>
          )}
          {open && (
            <div className="runtable" style={{ marginTop: 10 }}>
              <div className="runrow runhead">
                <div className="runcell rc-run">Run</div>
                <div className="runcell rc-status">Status</div>
                <div className="runcell rc-num">Examined</div>
                <div className="runcell rc-num">Actioned</div>
                <div className="runcell rc-num">Flagged</div>
                <div className="runcell rc-sum">Summary</div>
              </div>
              {rest.map((r) => <RunRow key={r.id} r={r} />)}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="runtable">
            <div className="runrow runhead">
              <div className="runcell rc-run">Run</div>
              <div className="runcell rc-status">Status</div>
              <div className="runcell rc-num">Examined</div>
              <div className="runcell rc-num">Actioned</div>
              <div className="runcell rc-num">Flagged</div>
              <div className="runcell rc-sum">Summary</div>
            </div>
            <RunRow r={latest} />
            {open && rest.map((r) => <RunRow key={r.id} r={r} />)}
          </div>
          {rest.length > 0 && (
            <button className="link-btn" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide Run History" : `View Run History (${rest.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Registry({
  loading, agents, onMode, onRun,
}: {
  loading: boolean;
  agents: any[];
  onMode: (id: string, mode: "off" | "flag_only" | "active") => void;
  onRun: (id: string) => void;
}) {
  if (loading) return <Panel title="Agent Registry"><SkeletonRows rows={6} /></Panel>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {agents.map((a) => (
        <AgentCard key={a.id} a={a} onMode={onMode} onRun={onRun} />
      ))}
    </div>
  );
}


/* --------------------------------- Proposals ----------------------------------- */

const NEEDS_ATTESTATION = new Set(["profile_copy", "objection_response"]);

function Proposals({ loading, proposals }: { loading: boolean; proposals: any[] }) {
  const qc = useQueryClient();
  const reviewFn = useServerFn(reviewProposal);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attested, setAttested] = useState<Record<string, boolean>>({});

  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected"; note?: string; attested?: boolean }) =>
      reviewFn({ data: v }),
    onSuccess: () => {
      toast.success("Proposal Reviewed");
      qc.invalidateQueries({ queryKey: ["bg-proposals"] });
      qc.invalidateQueries({ queryKey: ["bg-agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <Panel title="Proposal Inbox"><SkeletonRows rows={5} /></Panel>;

  // Proposals carry an evidence window; show how much of it is left.
  const hoursLeft = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3600000;
  const expirySoon = (iso: string) => hoursLeft(iso) < 24;
  const expiryLabel = (iso: string) => {
    const h = hoursLeft(iso);
    if (h <= 0) return "Expired";
    if (h < 1) return "Expires In Under An Hour";
    if (h < 48) return `Expires In ${Math.round(h)} Hours`;
    return `Expires In ${Math.round(h / 24)} Days`;
  };

  const pending = proposals.filter((p) => p.status === "pending");
  const reviewed = proposals.filter((p) => p.status !== "pending");

  if (!pending.length && !reviewed.length) {
    return (
      <EmptyPanel
        title="Proposal Inbox"
        icon={Inbox}
        hint="Nothing waiting. Agents write proposals here with the evidence behind them. Nothing is ever applied without your approval."
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {pending.map((p) => (
        <Panel
          key={p.id}
          title={`${p.agent_key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} · ${p.proposal_type.replace(/_/g, " ")}`}
          action={
            <span style={{ display: "inline-flex", gap: 6 }}>
              <StatusPill label="Pending" tone="amber" />
              {p.expires_at && <StatusPill label={expiryLabel(p.expires_at)} tone={expirySoon(p.expires_at) ? "red" : "neutral"} />}
            </span>
          }
        >
          <p style={{ marginBottom: 10 }}>{p.rationale}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Current — {p.target_table}.{p.target_field ?? "—"}</div>
              <pre className="code-block">{valueText(p.current_value)}</pre>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Proposed</div>
              <pre className="code-block">{valueText(p.proposed_value)}</pre>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Evidence: {valueText(p.evidence_refs).slice(0, 400)}
          </div>

          {NEEDS_ATTESTATION.has(p.proposal_type) && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
              <Checkbox
                checked={!!attested[p.id]}
                onCheckedChange={(v) => setAttested((s) => ({ ...s, [p.id]: !!v }))}
              />
              <span style={{ fontSize: 13 }}>
                I re-affirm the lawful basis for contacting these people with this copy. This attestation is written to the consent log.
              </span>
            </label>
          )}

          <Textarea
            placeholder="Optional note for the record"
            value={notes[p.id] ?? ""}
            onChange={(e) => setNotes((s) => ({ ...s, [p.id]: e.target.value }))}
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              onClick={() => review.mutate({ id: p.id, decision: "approved", note: notes[p.id], attested: attested[p.id] })}
              disabled={review.isPending}
            >
              <Check size={14} /> Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => review.mutate({ id: p.id, decision: "rejected", note: notes[p.id] })}
              disabled={review.isPending}
            >
              <X size={14} /> Reject{notes[p.id] ? " With Note" : ""}
            </Button>
          </div>
        </Panel>
      ))}

      {reviewed.length > 0 && (
        <Panel title="Reviewed">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Agent</th><th>Type</th><th>Decision</th><th>Reviewed</th><th>Note</th></tr>
              </thead>
              <tbody>
                {reviewed.map((p) => (
                  <tr key={p.id}>
                    <td>{p.agent_key}</td>
                    <td>{p.proposal_type.replace(/_/g, " ")}</td>
                    <td>
                      <StatusPill
                        label={p.status === "approved" ? "Approved" : p.status === "expired" ? "Expired" : "Rejected"}
                        tone={p.status === "approved" ? "green" : p.status === "expired" ? "neutral" : "red"}
                      />
                    </td>
                    <td>{timeAgo(p.reviewed_at)}</td>
                    <td className="muted">{p.review_note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/* --------------------------------- Worklist ------------------------------------ */

function Worklist({ loading, rows }: { loading: boolean; rows: any[] }) {
  const qc = useQueryClient();
  const sendFn = useServerFn(sendWorklistFeedback);
  const undoFn = useServerFn(undoWorklistFeedback);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  const send = useMutation({
    mutationFn: (v: { nomination_id: string; action: "worked" | "not_hot" | "dismiss"; score?: number }) =>
      sendFn({ data: v }),
    onSuccess: (r, v) => {
      setHidden((h) => [...h, v.nomination_id]);
      setUndo({ id: r.id, label: v.action === "worked" ? "Worked" : v.action === "not_hot" ? "Not Hot" : "Dismissed" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setUndo(null), 10000);
      qc.invalidateQueries({ queryKey: ["bg-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undoIt = useMutation({
    mutationFn: (id: string) => undoFn({ data: { id } }),
    onSuccess: () => {
      setHidden([]);
      setUndo(null);
      toast.success("Undone");
    },
  });

  if (loading) return <Panel title="Suggested Worklist"><SkeletonRows rows={5} /></Panel>;

  const visible = rows.filter((r) => !hidden.includes(r.id));

  if (!visible.length) {
    return (
      <EmptyPanel
        title="Suggested Worklist"
        icon={ListChecks}
        hint="Nothing genuinely due. The Lead Scout leaves this empty rather than padding it with names that are not worth a call today."
      />
    );
  }

  return (
    <Panel
      title="Suggested Worklist"
      action={
        undo ? (
          <Button variant="outline" size="sm" onClick={() => undoIt.mutate(undo.id)}>
            <Undo2 size={13} /> Undo {undo.label}
          </Button>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>Nominated From Real Signals Only</span>
        )
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Who</th><th>Product Line</th><th>Score</th><th>Why</th><th style={{ textAlign: "right" }}>Feedback</th></tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.who}</td>
                <td className="muted">{r.product_line ? r.product_line.replace(/_/g, " ") : "—"}</td>
                <td>{Math.round(r.score)}</td>
                <td className="muted">{r.reason_text}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <Button variant="outline" size="sm" onClick={() => send.mutate({ nomination_id: r.id, action: "worked", score: r.score })}>
                      <ThumbsUp size={13} /> Worked
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => send.mutate({ nomination_id: r.id, action: "not_hot", score: r.score })}>
                      <ThumbsDown size={13} /> Not Hot
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => send.mutate({ nomination_id: r.id, action: "dismiss", score: r.score })}>
                      <X size={13} /> Dismiss
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* --------------------------------- Insights ------------------------------------ */

function Insights({
  loading, report, weights, defaults,
}: {
  loading: boolean;
  report: any;
  weights: any[];
  defaults: Record<string, number>;
}) {
  const active = useMemo(() => weights.find((w) => w.product_line === "default"), [weights]);
  if (loading) return <Panel title="Conversations"><SkeletonRows rows={6} /></Panel>;

  const list = (rows: { label: string; count: number }[]) =>
    rows.length ? (
      <ul style={{ display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{r.label.replace(/_/g, " ")}</span>
            <span className="muted">{r.count}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted">Nothing labeled yet.</p>
    );

  const shown = (active?.weights as Record<string, number>) ?? defaults;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <Panel title="Outcomes">{list(report?.outcomes ?? [])}</Panel>
        <Panel title="Objection Categories Ranked">{list(report?.objections ?? [])}</Panel>
        <Panel title="Sentiment">{list(report?.sentiment ?? [])}</Panel>
      </div>

      <Panel title="Close Rate By Autonomy Mode" action={<span className="muted" style={{ fontSize: 12 }}>Average Touches Before A Close: {(report?.avgTouches ?? 0).toFixed(1)}</span>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Mode</th><th>Labeled Conversations</th><th>Close Or Book Rate</th></tr></thead>
            <tbody>
              {(report?.byMode ?? []).map((m: any) => (
                <tr key={m.mode}>
                  <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{m.mode}</td>
                  <td>{m.total}</td>
                  <td>{m.closeRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Ranking Weights"
        action={
          <StatusPill
            label={active?.is_default === false ? `Fitted On ${active?.fitted_on ?? 0} Outcomes` : "Learning, Using Defaults"}
            tone={active?.is_default === false ? "green" : "neutral"}
          />
        }
      >
        <ul style={{ display: "grid", gap: 6 }}>
          {Object.entries(shown).map(([k, v]) => (
            <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Gauge size={14} /> {k.replace(/_/g, " ")}
              </span>
              <span className="muted">{v}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What's Working" action={<span className="muted" style={{ fontSize: 12 }}>Human Takeovers Ranked By Subsequent Close Rate</span>}>
        {(report?.whatsWorking ?? []).length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Objection</th><th>Takeovers</th><th>Followed By A Close</th><th>Example</th></tr></thead>
              <tbody>
                {report.whatsWorking.map((w: any) => (
                  <tr key={w.label}>
                    <td style={{ fontWeight: 600 }}>{w.label}</td>
                    <td>{w.total}</td>
                    <td>{w.rate.toFixed(0)}%</td>
                    <td className="muted">{w.example ? `"${String(w.example).slice(0, 120)}"` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No takeovers captured yet. The Wisdom Miner fills this after a human steps into a call.</p>
        )}
      </Panel>
    </div>
  );
}
