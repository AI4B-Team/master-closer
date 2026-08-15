// Intelligence agents, learning & governance (server-only).
// Every agent is read-only unless its mode is 'active', and every behaviour
// change leaves the agent as a proposal a human approves.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { localHourIn, resolveLeadTimezone, withLocalHour } from "./calling-window";
import { phoneKey } from "./phone";

export const LABELER_VERSION = "labeler-v1";

export type AgentKey =
  | "conversation_labeler"
  | "lead_scout"
  | "hot_lead_scorer"
  | "booking_auditor"
  | "coach"
  | "wisdom_miner";

export const AGENT_META: Record<
  AgentKey,
  { name: string; cadence: string; blurb: string; canActivate: boolean; order: number }
> = {
  conversation_labeler: {
    name: "Conversation Labeler",
    cadence: "Hourly",
    blurb:
      "Reads finished calls and records what actually happened — outcome, objection, sentiment and which autonomy mode ran the call. Everything else learns from this.",
    canActivate: false,
    order: 1,
  },
  lead_scout: {
    name: "Lead Scout",
    cadence: "Every 3 Hours",
    blurb:
      "Reads the whole book, not just the recent end of it, and nominates who is genuinely worth a call today — including product lines nobody has ever offered.",
    canActivate: true,
    order: 2,
  },
  hot_lead_scorer: {
    name: "Hot-Lead Scorer",
    cadence: "Weekly Refit",
    blurb:
      "Learns from Worked / Not Hot / Dismiss taps and real closes, then refits the ranking weights for this workspace only. Needs 50 labeled outcomes first.",
    canActivate: true,
    order: 3,
  },
  booking_auditor: {
    name: "Booking Auditor",
    cadence: "Every 15 Minutes",
    blurb:
      "Re-reads new bookings against the call that produced them and flags drift in day, time, timezone or AM/PM before it becomes a no-show.",
    canActivate: true,
    order: 4,
  },
  coach: {
    name: "Coach",
    cadence: "Weekly",
    blurb:
      "Reviews your closers' own transcripts and drafts concrete copy replacements with numbers and evidence calls. Proposals only — this agent has no active mode, ever.",
    canActivate: false,
    order: 5,
  },
  wisdom_miner: {
    name: "Wisdom Miner",
    cadence: "Every 45 Minutes",
    blurb:
      "Captures what a human said on a takeover, what the AI had drafted, and what happened next — then offers the winning human pattern as a draft to edit.",
    canActivate: true,
    order: 6,
  },
};

export const DEFAULT_WEIGHTS = {
  anchor_urgency: 40,
  engagement_recency: 25,
  dormancy_with_cause: 12,
  new_information: 10,
  callback_window: 8,
  untouched_product_line: 5,
};

export type RunStats = {
  examined: number;
  actioned: number;
  flagged: number;
  summary: string;
  status?: "ok" | "skipped";
};

type Ctx = {
  workspaceId: string;
  agentId: string;
  agentKey: AgentKey;
  mode: "off" | "flag_only" | "active";
  config: Record<string, unknown>;
};

const db = () => supabaseAdmin;

function normalizeMode(mode: string | null): "ai" | "hybrid" | "copilot" {
  if (mode === "full_ai") return "ai";
  if (mode === "hybrid") return "hybrid";
  return "copilot";
}

const STOP_DISPOSITIONS = ["opted_out", "opt_out", "do_not_call", "dnc", "not_interested_ever", "deceased"];
const SENSITIVE_LINES = ["final_expense", "health", "debt", "medicare", "iul"];

const OBJECTION_PATTERNS: { category: string; words: string[] }[] = [
  { category: "Price / Competitor Cheaper", words: ["cheaper", "competitor", "too expensive", "costs too much", "price is high"] },
  { category: "Needs To Think", words: ["think about it", "sleep on it", "get back to you"] },
  { category: "Spouse / Second Decision Maker", words: ["my wife", "my husband", "talk to my spouse", "my partner"] },
  { category: "Timing", words: ["not right now", "next month", "call me later", "bad time"] },
  { category: "Trust / Legitimacy", words: ["is this a scam", "how do i know", "never heard of you"] },
  { category: "Already Covered", words: ["already have", "already covered", "we're set"] },
];

function textOf(segments: { speaker: string; text: string }[]) {
  return segments.map((s) => s.text).join(" ").toLowerCase();
}

/* ---------------------------------- 2 · Labeler --------------------------------- */

async function runLabeler(ctx: Ctx): Promise<RunStats> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: calls } = await db()
    .from("calls")
    .select("id, lead_id, agent_id, campaign_id, mode, outcome, disposition, summary, started_at, ended_at")
    .eq("workspace_id", ctx.workspaceId)
    .gte("started_at", since)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(200);

  const eligible = calls ?? [];
  if (!eligible.length) return { examined: 0, actioned: 0, flagged: 0, summary: "No finished calls to label.", status: "skipped" };

  const { data: labeled } = await db()
    .from("conversation_outcomes")
    .select("call_id")
    .eq("workspace_id", ctx.workspaceId)
    .is("superseded_at", null)
    .in("call_id", eligible.map((c) => c.id));
  const done = new Set((labeled ?? []).map((r) => r.call_id));

  const todo = eligible.filter((c) => !done.has(c.id));
  let actioned = 0;
  let flagged = 0;

  for (const call of todo.slice(0, 50)) {
    const { data: segs } = await db()
      .from("transcript_segments")
      .select("speaker, text")
      .eq("call_id", call.id)
      .order("ts_sec", { ascending: true });
    const body = textOf(segs ?? []) + " " + (call.summary ?? "").toLowerCase();
    const disp = (call.disposition ?? "").toLowerCase();

    let outcome = "unclear";
    let objection: string | null = null;
    let confidence = 0.5;

    if (STOP_DISPOSITIONS.some((d) => disp.includes(d))) { outcome = "opted_out"; confidence = 0.95; }
    else if (disp.includes("won") || disp.includes("sold") || disp.includes("closed_won")) { outcome = "closed_won"; confidence = 0.95; }
    else if (disp.includes("lost")) { outcome = "closed_lost"; confidence = 0.9; }
    else if (disp.includes("book") || disp.includes("appoint")) { outcome = "booked"; confidence = 0.9; }
    else if (disp.includes("transfer") || disp.includes("handoff")) { outcome = "handed_off"; confidence = 0.9; }
    else if (call.outcome === "no_answer" || call.outcome === "voicemail") { outcome = "no_answer"; confidence = 0.95; }
    else if (disp) { outcome = "disposition_detected"; confidence = 0.7; }

    if (outcome === "unclear" || outcome === "disposition_detected") {
      const hit = OBJECTION_PATTERNS.find((p) => p.words.some((w) => body.includes(w)));
      if (hit) { outcome = "objection_raised"; objection = hit.category; confidence = 0.75; }
      else if (/\b(price|pricing|cost|how much)\b/.test(body)) { outcome = "price_question"; confidence = 0.7; }
      else if (/(not the (right )?person|not the decision maker|my boss)/.test(body)) { outcome = "not_decision_maker"; confidence = 0.75; }
      else if (/(stop calling|harass|lawyer|furious)/.test(body)) { outcome = "hostile"; confidence = 0.8; }
      else if (!segs?.length) { outcome = "went_quiet"; confidence = 0.6; }
    }

    let sentiment: "positive" | "neutral" | "negative" | "at_risk" = "neutral";
    if (outcome === "closed_won" || outcome === "booked") sentiment = "positive";
    if (outcome === "hostile" || outcome === "opted_out" || outcome === "closed_lost") sentiment = "negative";
    if (/(fixed income|social security|my late|passed away|hospice|disability|debt collector|medicare)/.test(body)) sentiment = "at_risk";

    let touches = 0;
    if (call.lead_id) {
      const { count } = await db()
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", call.lead_id)
        .lte("started_at", call.started_at);
      touches = count ?? 0;
    }

    const isFlagged = outcome === "unclear" || sentiment === "at_risk";
    const { error } = await db().from("conversation_outcomes").insert({
      workspace_id: ctx.workspaceId,
      call_id: call.id,
      lead_id: call.lead_id,
      outcome,
      objection_category: objection,
      sentiment,
      mode: normalizeMode(call.mode),
      touches_before_outcome: touches,
      closer_profile_id: call.agent_id,
      campaign_step_id: call.campaign_id,
      variant_hash: null,
      confidence,
      flagged: isFlagged,
      labeler_version: LABELER_VERSION,
    });
    if (!error) {
      actioned++;
      if (isFlagged) flagged++;
    }
  }

  return {
    examined: todo.length,
    actioned,
    flagged,
    summary: `Labeled ${actioned} finished ${actioned === 1 ? "call" : "calls"}${flagged ? `, ${flagged} flagged for human eyes` : ""}.`,
  };
}

/* --------------------------------- 3 · Scout ----------------------------------- */

async function runScout(ctx: Ctx): Promise<RunStats> {
  await db().from("worklist_nominations").delete().eq("workspace_id", ctx.workspaceId).lt("expires_at", new Date().toISOString());

  const { data: contacts } = await db()
    .from("contacts")
    .select("id, name, suppressed")
    .eq("workspace_id", ctx.workspaceId)
    .eq("suppressed", false)
    .limit(500);

  const { data: lines } = await db()
    .from("lead_lines")
    .select("id, contact_id, product_line, status, disposition, anchor_date, last_touch_at, touches")
    .eq("workspace_id", ctx.workspaceId)
    .limit(2000);

  const { data: leads } = await db()
    .from("leads")
    .select("id, name, status, consent, source, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .neq("consent", "opt_out")
    .limit(500);

  const { data: outcomes } = await db()
    .from("conversation_outcomes")
    .select("lead_id, outcome, sentiment, objection_category, labeled_at")
    .eq("workspace_id", ctx.workspaceId)
    .is("superseded_at", null)
    .limit(2000);

  const byContact = new Map<string, typeof lines>();
  for (const l of lines ?? []) {
    const arr = byContact.get(l.contact_id) ?? [];
    arr.push(l);
    byContact.set(l.contact_id, arr as any);
  }

  /* Human feedback is a real signal: a line waved off as not hot stays out of the
     worklist for two weeks, and a dismissal for a week, unless it was undone. */
  const { data: fb } = await db()
    .from("worklist_feedback")
    .select("action, lead_line_id, lead_id, contact_id, created_at, undone")
    .eq("workspace_id", ctx.workspaceId)
    .eq("undone", false)
    .gte("created_at", new Date(Date.now() - 14 * 864e5).toISOString())
    .limit(2000);

  const mutedLines = new Set<string>();
  const mutedLeads = new Set<string>();
  const mutedContacts = new Set<string>();
  for (const f of fb ?? []) {
    if (f.action === "worked") continue;
    const ageDays = (Date.now() - new Date(f.created_at).getTime()) / 864e5;
    const window = f.action === "not_hot" ? 14 : 7;
    if (ageDays > window) continue;
    if (f.lead_line_id) mutedLines.add(f.lead_line_id);
    if (f.lead_id) mutedLeads.add(f.lead_id);
    if (!f.lead_line_id && !f.lead_id && f.contact_id) mutedContacts.add(f.contact_id);
  }

  const rows: any[] = [];
  const now = Date.now();
  const okContacts = new Set((contacts ?? []).map((c) => c.id));

  for (const line of lines ?? []) {
    if (!okContacts.has(line.contact_id)) continue;
    if (mutedLines.has(line.id) || mutedContacts.has(line.contact_id)) continue;
    if (STOP_DISPOSITIONS.some((d) => (line.disposition ?? "").toLowerCase().includes(d))) continue;

    let score = 0;
    const reasons: string[] = [];
    let code = "review";

    if (line.anchor_date) {
      const days = Math.round((new Date(line.anchor_date).getTime() - now) / 864e5);
      if (days >= 0 && days <= 21) {
        score += days <= 3 ? 55 : days <= 7 ? 42 : 28;
        reasons.push(days === 0 ? "anchor date is today" : `anchor date in ${days} ${days === 1 ? "day" : "days"}`);
        code = "anchor_urgency";
      }
    }
    if (line.last_touch_at) {
      const days = Math.round((now - new Date(line.last_touch_at).getTime()) / 864e5);
      if (days >= 3 && days <= 45 && (line.touches ?? 0) > 0) {
        score += 18;
        reasons.push(`answered ${line.touches} ${line.touches === 1 ? "time" : "times"}, never closed`);
        if (code === "review") code = "engagement_recency";
      }
      if (days > 45) {
        score += 6;
        reasons.push(`quiet for ${days} days`);
        if (code === "review") code = "dormancy_with_cause";
      }
    }
    const sibling = (byContact.get(line.contact_id) ?? []) as any[];
    if (line.status === "inactive" && (line.touches ?? 0) === 0 && sibling.some((s: any) => s.id !== line.id && s.status === "completed")) {
      score += 20;
      reasons.push(`${line.product_line.replace(/_/g, " ")} never offered, another line completed`);
      code = "untouched_product_line";
    }
    if (!reasons.length) continue;

    rows.push({
      workspace_id: ctx.workspaceId,
      contact_id: line.contact_id,
      lead_line_id: line.id,
      score,
      reason_code: code,
      reason_text: reasons.join(", "),
      suggested: ctx.mode !== "active",
    });
  }

  // Leads that have no contact record yet still deserve a nomination.
  for (const lead of leads ?? []) {
    if ((lead.source ?? "").toLowerCase().includes("mock")) continue;
    if (mutedLeads.has(lead.id)) continue;
    const hist = (outcomes ?? []).filter((o) => o.lead_id === lead.id);
    const engaged = hist.filter((o) => ["objection_raised", "price_question", "booked", "handed_off"].includes(o.outcome));
    if (!engaged.length) continue;
    if (hist.some((o) => o.outcome === "opted_out" || o.outcome === "closed_won")) continue;
    const last = hist.map((o) => new Date(o.labeled_at).getTime()).sort((a, b) => b - a)[0];
    const days = Math.round((now - last) / 864e5);
    rows.push({
      workspace_id: ctx.workspaceId,
      lead_id: lead.id,
      score: 30 + Math.max(0, 14 - days),
      reason_code: "engagement_recency",
      reason_text: `raised "${engaged[0].objection_category ?? engaged[0].outcome.replace(/_/g, " ")}" ${days} ${days === 1 ? "day" : "days"} ago, never closed`,
      suggested: ctx.mode !== "active",
    });
  }

  // Safe to wipe: worklist_feedback keeps its own subject ids and its FK is
  // ON DELETE SET NULL, so human "not hot"/"dismiss" mutes survive the rebuild.
  await db().from("worklist_nominations").delete().eq("workspace_id", ctx.workspaceId);
  if (rows.length) await db().from("worklist_nominations").insert(rows);

  return {
    examined: (lines?.length ?? 0) + (leads?.length ?? 0),
    actioned: rows.length,
    flagged: 0,
    summary: rows.length
      ? `Nominated ${rows.length} ${rows.length === 1 ? "line" : "lines"} genuinely due today.`
      : "Nothing genuinely due — worklist left empty rather than padded.",
    status: rows.length ? "ok" : "skipped",
  };
}

/* ------------------------------- 4 · Scorer ------------------------------------ */

async function runScorer(ctx: Ctx): Promise<RunStats> {
  const { data: existing } = await db()
    .from("scorer_weights")
    .select("id, weights, is_default, fitted_on")
    .eq("workspace_id", ctx.workspaceId)
    .eq("product_line", "default")
    .maybeSingle();

  if (!existing) {
    await db().from("scorer_weights").insert({
      workspace_id: ctx.workspaceId,
      product_line: "default",
      weights: DEFAULT_WEIGHTS,
      is_default: true,
      fitted_on: 0,
    });
  }

  const { count } = await db()
    .from("conversation_outcomes")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspaceId)
    .is("superseded_at", null);
  const labeled = count ?? 0;

  if (labeled < 50) {
    return {
      examined: labeled,
      actioned: 0,
      flagged: 0,
      summary: `Learning, using defaults — ${labeled} of 50 labeled outcomes needed before a refit.`,
      status: "skipped",
    };
  }

  const { data: outcomes } = await db()
    .from("conversation_outcomes")
    .select("outcome, mode, touches_before_outcome, sentiment")
    .eq("workspace_id", ctx.workspaceId)
    .is("superseded_at", null)
    .limit(5000);
  const { data: feedback } = await db()
    .from("worklist_feedback")
    .select("action, score_at_action")
    .eq("workspace_id", ctx.workspaceId)
    .eq("undone", false)
    .limit(5000);

  const wins = (outcomes ?? []).filter((o) => o.outcome === "closed_won" || o.outcome === "booked").length;
  const total = (outcomes ?? []).length || 1;
  const winRate = wins / total;
  const notHot = (feedback ?? []).filter((f) => f.action === "not_hot").length;
  const worked = (feedback ?? []).filter((f) => f.action === "worked").length;
  const precision = worked / Math.max(1, worked + notHot);

  const current = (existing?.weights as Record<string, number>) ?? DEFAULT_WEIGHTS;
  const cap = (base: number, factor: number) => Math.round(base * Math.min(1.15, Math.max(0.85, factor)));
  const proposed = {
    anchor_urgency: cap(current.anchor_urgency ?? 40, 1 + (winRate - 0.2)),
    engagement_recency: cap(current.engagement_recency ?? 25, 1 + (precision - 0.5) * 0.3),
    dormancy_with_cause: cap(current.dormancy_with_cause ?? 12, 1 - (notHot / Math.max(1, worked + notHot)) * 0.2),
    new_information: cap(current.new_information ?? 10, 1),
    callback_window: cap(current.callback_window ?? 8, 1 + (winRate - 0.2) * 0.2),
    untouched_product_line: cap(current.untouched_product_line ?? 5, 1 + (precision - 0.5) * 0.2),
  };

  const rationale =
    `Fitted on ${labeled} labeled outcomes for this workspace only. ` +
    `Close-or-book rate ${(winRate * 100).toFixed(1)}%; rep agreement on nominations ${(precision * 100).toFixed(0)}% ` +
    `(${worked} worked vs ${notHot} not hot). Every weight change is capped at ±15% per refit.`;

  await db().from("agent_proposals").insert({
    agent_id: ctx.agentId,
    workspace_id: ctx.workspaceId,
    agent_key: ctx.agentKey,
    proposal_type: "scorer_weights",
    target_table: "scorer_weights",
    target_id: existing?.id ?? null,
    target_field: "weights",
    current_value: current,
    proposed_value: proposed,
    rationale,
    evidence_refs: { labeled_outcomes: labeled, feedback: worked + notHot },
  });

  let applied = 0;
  if (ctx.mode === "active") {
    await db()
      .from("scorer_weights")
      .update({ weights: proposed, is_default: false, fitted_on: labeled, fitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId)
      .eq("product_line", "default");
    applied = 1;
  }

  return {
    examined: labeled,
    actioned: applied,
    flagged: 1,
    summary: applied ? "Refit weights applied and logged as a proposal." : "Refit proposed; waiting for approval in flag-only mode.",
  };
}

/* --------------------------- 5 · Booking Auditor -------------------------------- */

const TIME_RE = /\b(?:after\s+)?(1[0-2]|[1-9])(?::([0-5][0-9]))?\s*(am|pm)?\b/g;

async function runBookingAuditor(ctx: Ctx): Promise<RunStats> {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data: appts } = await db()
    .from("tasks")
    .select("id, title, due_at, call_id, created_at, lead_id")
    .eq("workspace_id", ctx.workspaceId)
    .not("call_id", "is", null)
    .not("due_at", "is", null)
    .gte("created_at", since)
    .limit(100);

  let flagged = 0;
  for (const a of appts ?? []) {
    const { data: segs } = await db()
      .from("transcript_segments")
      .select("speaker, text")
      .eq("call_id", a.call_id as string)
      .order("ts_sec", { ascending: true });
    const prospect = (segs ?? []).filter((s) => s.speaker.toLowerCase() !== "ai" && s.speaker.toLowerCase() !== "rep");
    const quoted = prospect.map((s) => s.text).join(" ");
    const hours = [...quoted.toLowerCase().matchAll(TIME_RE)].map((m) => {
      let h = Number(m[1]);
      if (m[3] === "pm" && h < 12) h += 12;
      if (m[3] === "am" && h === 12) h = 0;
      return h;
    });

    // The booked hour has to be read in the prospect's own timezone. Reading it
    // with getHours() used the worker's clock (UTC), which flagged almost every
    // correct booking and proposed a time hours off.
    let leadTz = "America/New_York";
    if (a.lead_id) {
      const { data: lead } = await db()
        .from("leads")
        .select("timezone, phone")
        .eq("id", a.lead_id as string)
        .maybeSingle();
      if (lead) leadTz = resolveLeadTimezone(lead as { timezone?: string | null; phone?: string | null }).timezone;
    }
    const dueAt = new Date(a.due_at as string);
    const bookedHour = localHourIn(dueAt, leadTz);
    let rationale: string | null = null;
    let proposedValue: string | null = null;

    if (!hours.length) {
      rationale = `No time request from the lead appears anywhere in the source call, so this slot was not asked for. That usually means the closer invented it — a prompt problem, not a lead problem.`;
    } else if (!hours.includes(bookedHour)) {
      const want = hours[0]!;
      proposedValue = withLocalHour(dueAt, leadTz, want).toISOString();
      rationale = `The lead said "${quoted.slice(0, 160)}". Booked for ${bookedHour}:00 but the lead asked for ${want}:00 in their own timezone (${leadTz}). AM/PM and timezone drift is the most common mis-book.`;
    }


    if (!rationale) continue;
    const { error } = await db().from("agent_proposals").insert({
      agent_id: ctx.agentId,
      workspace_id: ctx.workspaceId,
      agent_key: ctx.agentKey,
      proposal_type: "booking_correction",
      target_table: "tasks",
      target_id: a.id,
      target_field: "due_at",
      current_value: a.due_at,
      proposed_value: proposedValue,
      rationale,
      evidence_refs: { call_id: a.call_id, appointment: a.title },
    });
    if (!error) flagged++;
  }

  return {
    examined: appts?.length ?? 0,
    actioned: 0,
    flagged,
    summary: flagged ? `Flagged ${flagged} ${flagged === 1 ? "booking" : "bookings"} that drifted from the call.` : "No booking drift found.",
    status: (appts?.length ?? 0) === 0 ? "skipped" : "ok",
  };
}

/* --------------------------------- 6 · Coach ----------------------------------- */

async function runCoach(ctx: Ctx): Promise<RunStats> {
  const { data: profiles } = await db()
    .from("agents")
    .select("id, name, system_prompt")
    .eq("workspace_id", ctx.workspaceId)
    .limit(50);

  let flagged = 0;
  let examined = 0;

  for (const p of profiles ?? []) {
    const { data: outs } = await db()
      .from("conversation_outcomes")
      .select("id, call_id, outcome, objection_category, mode")
      .eq("workspace_id", ctx.workspaceId)
      .eq("closer_profile_id", p.id)
      .is("superseded_at", null)
      .limit(1000);
    examined += outs?.length ?? 0;
    if ((outs?.length ?? 0) < 30) continue;

    const byCat = new Map<string, { total: number; won: number; calls: string[] }>();
    for (const o of outs ?? []) {
      const cat = o.objection_category ?? (o.outcome === "objection_raised" ? "Uncategorised" : null);
      if (!cat) continue;
      const rec = byCat.get(cat) ?? { total: 0, won: 0, calls: [] };
      rec.total++;
      if (o.outcome === "closed_won" || o.outcome === "booked") rec.won++;
      if (o.call_id && rec.calls.length < 5) rec.calls.push(o.call_id);
      byCat.set(cat, rec);
    }

    const worst = [...byCat.entries()]
      .filter(([, r]) => r.total >= 5 && r.calls.length >= 3)
      .sort((a, b) => a[1].won / a[1].total - b[1].won / b[1].total)[0];
    if (!worst) continue;

    const [cat, rec] = worst;
    const rate = ((rec.won / rec.total) * 100).toFixed(0);
    const addition =
      `\n\nWhen the prospect raises "${cat}": name the concern out loud, give the one number that answers it, ` +
      `then ask for the smallest next commitment instead of re-pitching the whole offer.`;
    const proposed = `${p.system_prompt ?? ""}${addition}`;

    const { error } = await db().from("agent_proposals").insert({
      agent_id: ctx.agentId,
      workspace_id: ctx.workspaceId,
      agent_key: ctx.agentKey,
      proposal_type: "profile_copy",
      target_table: "agents",
      target_id: p.id,
      target_field: "system_prompt",
      current_value: p.system_prompt ?? "",
      proposed_value: proposed,
      rationale:
        `${p.name} converts "${cat}" at ${rate}% across ${rec.total} labeled outcomes — the weakest objection on this profile. ` +
        `The replacement copy is additive and names the exact field. Sample size ${rec.total}; ${rec.calls.length} evidence calls attached.`,
      evidence_refs: { calls: rec.calls.slice(0, 3), objection_category: cat, sample_size: rec.total },
    });
    if (!error) flagged++;
  }

  return {
    examined,
    actioned: 0,
    flagged,
    summary: flagged
      ? `Drafted ${flagged} copy ${flagged === 1 ? "replacement" : "replacements"} for review. The Coach never applies a change.`
      : "No profile has enough labeled outcomes for a defensible copy proposal yet.",
    status: flagged ? "ok" : "skipped",
  };
}

/* ------------------------------ 7 · Wisdom Miner -------------------------------- */

async function runWisdomMiner(ctx: Ctx): Promise<RunStats> {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data: calls } = await db()
    .from("calls")
    .select("id, mode, agent_id, disposition, started_at")
    .eq("workspace_id", ctx.workspaceId)
    .gte("started_at", since)
    .limit(200);

  const ids = (calls ?? []).map((c) => c.id);
  if (!ids.length) return { examined: 0, actioned: 0, flagged: 0, summary: "No recent calls to mine.", status: "skipped" };

  const { data: outs } = await db()
    .from("conversation_outcomes")
    .select("call_id, outcome, sentiment, objection_category, anchor_days_remaining")
    .eq("workspace_id", ctx.workspaceId)
    .in("call_id", ids)
    .is("superseded_at", null);
  const outByCall = new Map((outs ?? []).map((o) => [o.call_id as string, o]));

  const { data: sugg } = await db()
    .from("suggestions")
    .select("call_id, line, objection, ts_sec, was_used")
    .in("call_id", ids)
    .eq("was_used", false)
    .limit(500);

  let actioned = 0;
  for (const s of sugg ?? []) {
    const out = outByCall.get(s.call_id);
    if (out?.sentiment === "at_risk") continue; // never mine at-risk conversations
    const call = (calls ?? []).find((c) => c.id === s.call_id);
    const { data: segs } = await db()
      .from("transcript_segments")
      .select("speaker, text, ts_sec")
      .eq("call_id", s.call_id)
      .gte("ts_sec", s.ts_sec)
      .order("ts_sec", { ascending: true })
      .limit(6);
    const human = (segs ?? []).find((g) => ["rep", "human", "closer"].includes(g.speaker.toLowerCase()));
    if (!human) continue;

    const positive = ["closed_won", "booked", "handed_off"].includes(out?.outcome ?? "");
    const { error } = await db().from("takeover_library").upsert(
      {
        workspace_id: ctx.workspaceId,
        call_id: s.call_id,
        closer_profile_id: call?.agent_id ?? null,
        mode: normalizeMode(call?.mode ?? null),
        objection_category: out?.objection_category ?? s.objection,
        ai_drafted: s.line,
        human_said: human.text,
        subsequent_outcome: out?.outcome ?? null,
        sentiment: out?.sentiment ?? null,
        anchor_days: out?.anchor_days_remaining ?? null,
        positive,
      },
      { onConflict: "call_id,human_said" },
    );
    if (!error) actioned++;
  }

  const { data: lib } = await db()
    .from("takeover_library")
    .select("objection_category, human_said, positive, closer_profile_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("positive", true)
    .limit(1000);

  const groups = new Map<string, { count: number; examples: string[]; profile: string | null }>();
  for (const t of lib ?? []) {
    const cat = t.objection_category ?? "Uncategorised";
    const rec = groups.get(cat) ?? { count: 0, examples: [], profile: t.closer_profile_id ?? null };
    rec.count++;
    if (rec.examples.length < 3 && t.human_said) rec.examples.push(t.human_said);
    groups.set(cat, rec);
  }

  let flagged = 0;
  for (const [cat, rec] of groups) {
    if (rec.count < 5) continue;
    const { data: dupe } = await db()
      .from("agent_proposals")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("proposal_type", "objection_response")
      .eq("target_field", cat)
      .eq("status", "pending")
      .maybeSingle();
    if (dupe) continue;

    const { error } = await db().from("agent_proposals").insert({
      agent_id: ctx.agentId,
      workspace_id: ctx.workspaceId,
      agent_key: ctx.agentKey,
      proposal_type: "objection_response",
      target_table: "objections",
      target_id: null,
      target_field: cat,
      current_value: null,
      proposed_value: { category: cat, draft: rec.examples[0], examples: rec.examples },
      rationale:
        `${rec.count} human takeovers on "${cat}" were followed by a booking or a close. This is a DRAFT to edit, never a verbatim ` +
        `human line: reps say things that work once and must not become a template, including promises the closer may not make.`,
      evidence_refs: { takeovers: rec.count, examples: rec.examples },
    });
    if (!error) flagged++;
  }

  return {
    examined: sugg?.length ?? 0,
    actioned,
    flagged,
    summary: `Captured ${actioned} ${actioned === 1 ? "takeover" : "takeovers"}${flagged ? `, raised ${flagged} draft ${flagged === 1 ? "pattern" : "patterns"}` : ""}.`,
  };
}

const RUNNERS: Record<AgentKey, (ctx: Ctx) => Promise<RunStats>> = {
  conversation_labeler: runLabeler,
  lead_scout: runScout,
  hot_lead_scorer: runScorer,
  booking_auditor: runBookingAuditor,
  coach: runCoach,
  wisdom_miner: runWisdomMiner,
};

/* -------------------------------- Scheduler ------------------------------------ */

/**
 * Retires pending proposals whose evidence window has closed. Runs on the cron
 * tick so stale proposals expire even if nobody opens the Intelligence page,
 * and each retirement lands in the audit trail.
 */
async function sweepExpiredProposals(workspaceId?: string) {
  let q = db()
    .from("agent_proposals")
    .update({ status: "expired", reviewed_at: new Date().toISOString(), review_note: "Expired before review." })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (workspaceId) q = q.eq("workspace_id", workspaceId);

  const { data: retired } = await q.select("id, workspace_id, agent_key, proposal_type");
  const rows = retired ?? [];
  if (rows.length === 0) return 0;

  const wsIds = [...new Set(rows.map((r: any) => r.workspace_id).filter(Boolean))];
  const { data: workspaces } = await db().from("workspaces").select("id, org_id").in("id", wsIds);
  const orgOf = new Map((workspaces ?? []).map((w: any) => [w.id, w.org_id]));

  const events = rows
    .filter((r: any) => r.workspace_id && orgOf.get(r.workspace_id))
    .map((r: any) => ({
      org_id: orgOf.get(r.workspace_id),
      workspace_id: r.workspace_id,
      event_type: "job.completed",
      payload: {
        kind: "agent.proposal_expired",
        proposal_id: r.id,
        agent_key: r.agent_key,
        proposal_type: r.proposal_type,
      },
    }));
  if (events.length > 0) await db().from("events").insert(events);
  return rows.length;
}

export async function tickAgents(opts: { workspaceId?: string; agentId?: string; force?: boolean } = {}) {
  await sweepExpiredProposals(opts.workspaceId);


  let q = db()
    .from("background_agents")
    .select("id, workspace_id, agent_key, mode, enabled, interval_minutes, next_run_at, config, consecutive_failures");
  if (opts.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
  if (opts.agentId) q = q.eq("id", opts.agentId);
  if (!opts.force) {
    q = q.eq("enabled", true).neq("mode", "off").or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);
  }

  const { data: due, error } = await q.limit(200);
  if (error) throw new Error(error.message);

  const results: { agent_key: string; status: string; summary: string }[] = [];

  for (const a of due ?? []) {
    if (!a.workspace_id) continue;
    const runner = RUNNERS[a.agent_key as AgentKey];
    if (!runner) continue;

    const startedAt = new Date().toISOString();
    let stats: RunStats | null = null;
    let errText: string | null = null;
    try {
      stats = await runner({
        workspaceId: a.workspace_id,
        agentId: a.id,
        agentKey: a.agent_key as AgentKey,
        mode: (a.mode as Ctx["mode"]) ?? "flag_only",
        config: (a.config as Record<string, unknown>) ?? {},
      });
    } catch (e) {
      errText = e instanceof Error ? e.message : String(e);
    }

    // Every run is logged, even when nothing happened.
    await db().from("agent_runs").insert({
      agent_id: a.id,
      workspace_id: a.workspace_id,
      agent_key: a.agent_key,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: errText ? "failed" : (stats?.status ?? "ok"),
      items_examined: stats?.examined ?? 0,
      items_actioned: stats?.actioned ?? 0,
      items_flagged: stats?.flagged ?? 0,
      summary: stats?.summary ?? null,
      error: errText,
    });

    const failures = errText ? (a.consecutive_failures ?? 0) + 1 : 0;
    await db()
      .from("background_agents")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + a.interval_minutes * 60000).toISOString(),
        consecutive_failures: failures,
        ...(failures >= 3 ? { enabled: false } : {}),
      })
      .eq("id", a.id);

    results.push({
      agent_key: a.agent_key,
      status: errText ? "failed" : (stats?.status ?? "ok"),
      summary: errText ?? stats?.summary ?? "",
    });
  }

  return { ran: results.length, results };
}

/* ----------------------------- Proposal decisions ------------------------------ */

const GUARDED_PROPOSAL_TYPES = new Set(["profile_copy", "objection_response"]);

/** Audit twin of logActivity — governance decisions are written server-side. */
async function logGovernanceEvent(
  supabase: any,
  scope: { orgId: string; workspaceId: string },
  kind: string,
  payload: Record<string, unknown> = {},
) {
  try {
    await supabase.from("events").insert({
      org_id: scope.orgId,
      workspace_id: scope.workspaceId,
      event_type: "job.completed",
      payload: { kind, ...payload },
    });
  } catch {
    /* non-blocking */
  }
}

/**
 * Applies a single proposal decision. Shared by the one-at-a-time review and the
 * bulk review so both paths enforce the same expiry and attestation guards.
 */
export async function applyProposalDecision(
  supabase: any,
  scope: { orgId: string; workspaceId: string },
  userId: string,
  input: { id: string; decision: "approved" | "rejected"; note?: string; attested?: boolean },
) {
  const { orgId, workspaceId } = scope;
  const { data: p } = await supabase
    .from("agent_proposals")
    .select("id, agent_key, proposal_type, target_table, target_id, target_field, current_value, proposed_value, status, expires_at")
    .eq("id", input.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!p) throw new Error("Proposal not found.");
  if (p.status === "expired") throw new Error("This proposal expired and can no longer be applied.");
  if (p.status !== "pending") throw new Error("This proposal was already reviewed.");
  if (p.expires_at && new Date(p.expires_at) < new Date()) {
    await supabase
      .from("agent_proposals")
      .update({ status: "expired", reviewed_at: new Date().toISOString(), review_note: "Expired before review." })
      .eq("id", p.id)
      .eq("workspace_id", workspaceId);
    throw new Error("This proposal expired and can no longer be applied.");
  }

  if (input.decision === "approved" && GUARDED_PROPOSAL_TYPES.has(p.proposal_type) && !input.attested) {
    throw new Error("Compliance-adjacent copy needs the lawful-basis attestation re-affirmed before approval.");
  }

  if (input.decision === "approved") {
    if (p.proposal_type === "scorer_weights") {
      await supabase
        .from("scorer_weights")
        .update({
          weights: p.proposed_value as any,
          is_default: false,
          fitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .eq("product_line", "default");
    } else if (p.proposal_type === "profile_copy" && p.target_id) {
      const { appendPromptVersion } = await import("./prompt-versions.server");
      const { data: agentRow } = await supabase
        .from("agents")
        .select("system_prompt")
        .eq("id", p.target_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (agentRow?.system_prompt) {
        await appendPromptVersion(supabase, {
          workspaceId,
          agentId: p.target_id,
          prompt: String(agentRow.system_prompt),
          source: "seed",
          note: "Copy in use before the agent proposal was approved.",
          userId,
        });
      }

      const nextPrompt = String((p.proposed_value as any) ?? "");
      await supabase
        .from("agents")
        .update({ system_prompt: nextPrompt })
        .eq("id", p.target_id)
        .eq("workspace_id", workspaceId);

      await appendPromptVersion(supabase, {
        workspaceId,
        agentId: p.target_id,
        prompt: nextPrompt,
        source: "proposal",
        note: `Approved from ${p.agent_key} proposal.`,
        proposalId: p.id,
        userId,
      });
    } else if (p.proposal_type === "booking_correction" && p.target_id && p.proposed_value) {
      await supabase
        .from("tasks")
        .update({ due_at: String(p.proposed_value) })
        .eq("id", p.target_id)
        .eq("workspace_id", workspaceId);
    } else if (p.proposal_type === "objection_response") {
      const v = p.proposed_value as any;
      await supabase.from("objections").insert({
        org_id: orgId,
        workspace_id: workspaceId,
        category: v?.category ?? p.target_field ?? "Uncategorised",
        trigger: v?.category ?? p.target_field ?? "Objection",
        response: String(v?.draft ?? ""),
      });
    }

    if (GUARDED_PROPOSAL_TYPES.has(p.proposal_type)) {
      await supabase.from("consent_logs").insert({
        org_id: orgId,
        workspace_id: workspaceId,
        method: "attestation_reaffirmed",
        notes: `Lawful-basis attestation re-affirmed to approve proposal ${p.id} (${p.proposal_type}) from ${p.agent_key}.`,
      });
    }
  }

  const { error } = await supabase
    .from("agent_proposals")
    .update({
      status: input.decision,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_note: input.note ?? null,
    })
    .eq("id", p.id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);

  await logGovernanceEvent(
    supabase,
    { orgId, workspaceId },
    input.decision === "approved" ? "agent.proposal_approved" : "agent.proposal_rejected",
    { proposal_id: p.id, agent_key: p.agent_key, proposal_type: p.proposal_type, note: input.note ?? null },
  );

  return { ok: true as const, proposalType: p.proposal_type as string, agentKey: p.agent_key as string };
}

/** Requires the lawful-basis attestation before approval. */
export function proposalNeedsAttestation(proposalType: string) {
  return GUARDED_PROPOSAL_TYPES.has(proposalType);
}
