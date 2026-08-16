import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callerScope, logGovernance } from "./workspace-scope";

/** Registry + recent runs for the Agents admin surface. */
export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { AGENT_META, DEFAULT_WEIGHTS } = await import("./governance.server");
    const { workspaceId } = await callerScope(context.supabase, context.userId);

    const [{ data: agents }, { data: runs }, { data: weights }, { data: pending }] = await Promise.all([
      context.supabase
        .from("background_agents")
        .select("id, agent_key, enabled, mode, interval_minutes, last_run_at, next_run_at, consecutive_failures")
        .eq("workspace_id", workspaceId),
      context.supabase
        .from("agent_runs")
        .select("id, agent_id, agent_key, started_at, finished_at, status, items_examined, items_actioned, items_flagged, summary, error")
        .eq("workspace_id", workspaceId)
        .order("started_at", { ascending: false })
        .limit(120),
      context.supabase
        .from("scorer_weights")
        .select("product_line, weights, is_default, fitted_on, fitted_at")
        .eq("workspace_id", workspaceId),
      context.supabase
        .from("agent_proposals")
        .select("agent_key")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
    ]);

    const pendingBy = new Map<string, number>();
    for (const p of pending ?? []) pendingBy.set(p.agent_key ?? "", (pendingBy.get(p.agent_key ?? "") ?? 0) + 1);

    const rows = (agents ?? [])
      .map((a) => {
        const meta = (AGENT_META as any)[a.agent_key] ?? { name: a.agent_key, cadence: "", blurb: "", canActivate: true, order: 99 };
        const mine = (runs ?? []).filter((r) => r.agent_id === a.id).slice(0, 10);
        return { ...a, meta, runs: mine, pending: pendingBy.get(a.agent_key) ?? 0 };
      })
      .sort((a, b) => a.meta.order - b.meta.order);

    return {
      agents: rows,
      paused: rows.length > 0 && rows.every((r) => !r.enabled),
      weights: weights ?? [],
      defaultWeights: DEFAULT_WEIGHTS,
    };
  });

export const setAgentMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), mode: z.enum(["off", "flag_only", "active"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { orgId, workspaceId } = await callerScope(context.supabase, context.userId);
    const { data: agent } = await context.supabase
      .from("background_agents")
      .select("agent_key")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!agent) throw new Error("Agent not found in this workspace.");
    if (agent.agent_key === "coach" && data.mode === "active") {
      throw new Error("The Coach has no active mode; it proposes only.");
    }
    const { error } = await context.supabase
      .from("background_agents")
      .update({ mode: data.mode, enabled: data.mode !== "off", consecutive_failures: 0 })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    await logGovernance(context.supabase, { orgId, workspaceId }, "agent.mode_changed", {
      agent_key: agent.agent_key,
      mode: data.mode,
    });
    return { ok: true };
  });

export const pauseAllAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { orgId, workspaceId } = await callerScope(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("background_agents")
      .update({ enabled: !data.paused })
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    await logGovernance(context.supabase, { orgId, workspaceId }, data.paused ? "agent.paused_all" : "agent.resumed_all");
    return { paused: data.paused };
  });

export const runAgentNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    const { tickAgents } = await import("./governance.server");
    return tickAgents({ workspaceId, agentId: data.id, force: true });
  });

/* --------------------------------- Proposals ----------------------------------- */

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, workspaceId } = await callerScope(context.supabase, context.userId);
    // Stale proposals lose their evidence window, so they retire instead of
    // sitting in the queue waiting for a rubber-stamp approval.
    const { data: retired } = await context.supabase
      .from("agent_proposals")
      .update({ status: "expired", reviewed_at: new Date().toISOString(), review_note: "Expired before review." })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id, agent_key, proposal_type");

    for (const r of retired ?? []) {
      await logGovernance(context.supabase, { orgId, workspaceId }, "agent.proposal_expired", {
        proposal_id: r.id,
        agent_key: r.agent_key,
        proposal_type: r.proposal_type,
      });
    }

    const { data } = await context.supabase
      .from("agent_proposals")
      .select(
        "id, agent_key, proposal_type, target_table, target_id, target_field, current_value, proposed_value, rationale, evidence_refs, status, review_note, reviewed_at, created_at, expires_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { proposals: data ?? [] };
  });

export const reviewProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional(),
        attested: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { applyProposalDecision } = await import("./governance.server");
    const scope = await callerScope(context.supabase, context.userId);
    await applyProposalDecision(context.supabase, scope, context.userId, data);
    return { ok: true };
  });

/**
 * Bulk review. Each proposal is decided independently so one guarded item
 * (expired, or needing attestation) cannot block the rest of the batch.
 */
export const reviewProposalsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(1000).optional(),
        attested: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { applyProposalDecision } = await import("./governance.server");
    const scope = await callerScope(context.supabase, context.userId);

    let applied = 0;
    const failures: { id: string; reason: string }[] = [];
    for (const id of data.ids) {
      try {
        await applyProposalDecision(context.supabase, scope, context.userId, {
          id,
          decision: data.decision,
          note: data.note,
          attested: data.attested,
        });
        applied += 1;
      } catch (e) {
        failures.push({ id, reason: e instanceof Error ? e.message : "Could not apply." });
      }
    }

    await logGovernance(context.supabase, scope, "agent.proposals_bulk_reviewed", {
      decision: data.decision,
      requested: data.ids.length,
      applied,
      skipped: failures.length,
    });

    return { applied, failures };
  });


/* --------------------------------- Worklist ------------------------------------ */

export const listWorklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    const [{ data: noms }, { data: contacts }, { data: leads }, { data: lines }] = await Promise.all([
      context.supabase
        .from("worklist_nominations")
        .select("id, contact_id, lead_line_id, lead_id, score, reason_code, reason_text, suggested, nominated_at")
        .eq("workspace_id", workspaceId)
        .order("score", { ascending: false })
        .limit(100),
      context.supabase.from("contacts").select("id, name, phone").eq("workspace_id", workspaceId).limit(500),
      context.supabase.from("leads").select("id, name, phone, company").eq("workspace_id", workspaceId).limit(500),
      context.supabase.from("lead_lines").select("id, product_line, status").eq("workspace_id", workspaceId).limit(1000),
    ]);

    const cMap = new Map((contacts ?? []).map((c) => [c.id, c]));
    const lMap = new Map((leads ?? []).map((l) => [l.id, l]));
    const lineMap = new Map((lines ?? []).map((l) => [l.id, l]));

    return {
      rows: (noms ?? []).map((n) => ({
        ...n,
        who: n.contact_id ? (cMap.get(n.contact_id)?.name ?? "Contact") : (lMap.get(n.lead_id ?? "")?.name ?? "Lead"),
        phone: n.contact_id ? (cMap.get(n.contact_id)?.phone ?? null) : (lMap.get(n.lead_id ?? "")?.phone ?? null),
        product_line: n.lead_line_id ? (lineMap.get(n.lead_line_id)?.product_line ?? null) : null,
      })),
    };
  });

export const sendWorklistFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nomination_id: z.string().uuid(),
        action: z.enum(["worked", "not_hot", "dismiss"]),
        score: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);

    /* Nominations are rebuilt from scratch every Scout run, so the feedback row
       carries its own subject ids — that is what lets Scout stop re-nominating
       someone a human already waved off. */
    const { data: nom } = await context.supabase
      .from("worklist_nominations")
      .select("contact_id, lead_line_id, lead_id")
      .eq("id", data.nomination_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    /* Without those ids the row is inert: Scout mutes by subject, so a feedback
       row with all three null would let a waved-off lead come straight back on
       the next rebuild. Better to say so than to accept a silent no-op. */
    if (!nom || (!nom.contact_id && !nom.lead_line_id && !nom.lead_id)) {
      throw new Error("This worklist item is no longer current — refresh the worklist and try again.");
    }


    const { data: row, error } = await context.supabase
      .from("worklist_feedback")
      .insert({
        workspace_id: workspaceId,
        nomination_id: data.nomination_id,
        contact_id: nom?.contact_id ?? null,
        lead_line_id: nom?.lead_line_id ?? null,
        lead_id: nom?.lead_id ?? null,
        action: data.action,
        score_at_action: data.score ?? null,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const undoWorklistFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("worklist_feedback")
      .update({ undone: true })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------- Conversations report -------------------------------- */

export const conversationsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    const [{ data: outs }, { data: takeovers }] = await Promise.all([
      context.supabase
        .from("conversation_outcomes")
        .select("outcome, objection_category, sentiment, mode, touches_before_outcome, flagged, call_id")
        .eq("workspace_id", workspaceId)
        .is("superseded_at", null)
        .limit(5000),
      context.supabase
        .from("takeover_library")
        .select("objection_category, human_said, ai_drafted, positive, subsequent_outcome")
        .eq("workspace_id", workspaceId)
        .limit(1000),
    ]);

    const rows = outs ?? [];
    const tally = (key: (r: any) => string | null) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = key(r);
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    };

    const closes = rows.filter((r) => r.outcome === "closed_won");
    const avgTouches = closes.length
      ? closes.reduce((s, r) => s + (r.touches_before_outcome ?? 0), 0) / closes.length
      : 0;

    const byMode = ["ai", "hybrid", "copilot"].map((m) => {
      const set = rows.filter((r) => r.mode === m);
      const won = set.filter((r) => r.outcome === "closed_won" || r.outcome === "booked").length;
      return { mode: m, total: set.length, closeRate: set.length ? (won / set.length) * 100 : 0 };
    });

    const patterns = new Map<string, { total: number; positive: number; example: string | null }>();
    for (const t of takeovers ?? []) {
      const k = t.objection_category ?? "Uncategorised";
      const rec = patterns.get(k) ?? { total: 0, positive: 0, example: t.human_said ?? null };
      rec.total++;
      if (t.positive) rec.positive++;
      patterns.set(k, rec);
    }

    return {
      total: rows.length,
      flagged: rows.filter((r) => r.flagged).length,
      outcomes: tally((r) => r.outcome),
      objections: tally((r) => r.objection_category),
      sentiment: tally((r) => r.sentiment),
      avgTouches,
      byMode,
      whatsWorking: [...patterns.entries()]
        .map(([label, r]) => ({ label, ...r, rate: r.total ? (r.positive / r.total) * 100 : 0 }))
        .sort((a, b) => b.rate - a.rate || b.total - a.total)
        .slice(0, 8),
    };
  });
