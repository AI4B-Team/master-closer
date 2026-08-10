import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callerScope(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return { orgId: data.org_id as string, workspaceId: data.active_workspace_id as string };
}

/**
 * Server-side twin of logActivity: governance decisions are audit-relevant, so
 * they are written from the handler rather than trusted to the browser.
 */
async function logGovernance(
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
    const { workspaceId } = await callerScope(context.supabase, context.userId);
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
    return { ok: true };
  });

export const pauseAllAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("background_agents")
      .update({ enabled: !data.paused })
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
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
    const { workspaceId } = await callerScope(context.supabase, context.userId);
    // Stale proposals lose their evidence window, so they retire instead of
    // sitting in the queue waiting for a rubber-stamp approval.
    await context.supabase
      .from("agent_proposals")
      .update({ status: "expired", reviewed_at: new Date().toISOString(), review_note: "Expired before review." })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

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

const GUARDED_TYPES = new Set(["profile_copy", "objection_response"]);

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
    const { orgId, workspaceId } = await callerScope(context.supabase, context.userId);
    const { data: p } = await context.supabase
      .from("agent_proposals")
      .select("id, agent_key, proposal_type, target_table, target_id, target_field, current_value, proposed_value, status, expires_at")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!p) throw new Error("Proposal not found.");
    if (p.status === "expired") throw new Error("This proposal expired and can no longer be applied.");
    if (p.status !== "pending") throw new Error("This proposal was already reviewed.");
    if (p.expires_at && new Date(p.expires_at) < new Date()) {
      await context.supabase
        .from("agent_proposals")
        .update({ status: "expired", reviewed_at: new Date().toISOString(), review_note: "Expired before review." })
        .eq("id", p.id)
        .eq("workspace_id", workspaceId);
      throw new Error("This proposal expired and can no longer be applied.");
    }

    if (data.decision === "approved" && GUARDED_TYPES.has(p.proposal_type) && !data.attested) {
      throw new Error("Compliance-adjacent copy needs the lawful-basis attestation re-affirmed before approval.");
    }

    if (data.decision === "approved") {
      if (p.proposal_type === "scorer_weights") {
        await context.supabase
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
        // Version the profile: keep the prior copy and who approved the change.
        const { appendPromptVersion } = await import("./prompt-versions.server");
        const { data: agentRow } = await context.supabase
          .from("agents")
          .select("system_prompt")
          .eq("id", p.target_id)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (agentRow?.system_prompt) {
          await appendPromptVersion(context.supabase, {
            workspaceId,
            agentId: p.target_id,
            prompt: String(agentRow.system_prompt),
            source: "seed",
            note: "Copy in use before the agent proposal was approved.",
            userId: context.userId,
          });
        }

        const nextPrompt = String((p.proposed_value as any) ?? "");
        await context.supabase
          .from("agents")
          .update({ system_prompt: nextPrompt })
          .eq("id", p.target_id)
          .eq("workspace_id", workspaceId);

        await appendPromptVersion(context.supabase, {
          workspaceId,
          agentId: p.target_id,
          prompt: nextPrompt,
          source: "proposal",
          note: `Approved from ${p.agent_key} proposal.`,
          proposalId: p.id,
          userId: context.userId,
        });
      } else if (p.proposal_type === "booking_correction" && p.target_id && p.proposed_value) {
        await context.supabase
          .from("tasks")
          .update({ due_at: String(p.proposed_value) })
          .eq("id", p.target_id)
          .eq("workspace_id", workspaceId);
      } else if (p.proposal_type === "objection_response") {
        const v = p.proposed_value as any;
        await context.supabase.from("objections").insert({
          org_id: orgId,
          workspace_id: workspaceId,
          category: v?.category ?? p.target_field ?? "Uncategorised",
          trigger: v?.category ?? p.target_field ?? "Objection",
          response: String(v?.draft ?? ""),
        });
      }

      if (GUARDED_TYPES.has(p.proposal_type)) {
        await context.supabase.from("consent_logs").insert({
          org_id: orgId,
          workspace_id: workspaceId,
          method: "attestation_reaffirmed",
          notes: `Lawful-basis attestation re-affirmed to approve proposal ${p.id} (${p.proposal_type}) from ${p.agent_key}.`,
        });
      }
    }

    const { error } = await context.supabase
      .from("agent_proposals")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note ?? null,
      })
      .eq("id", p.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
