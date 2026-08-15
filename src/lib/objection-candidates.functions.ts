import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeWorkspace } from "./workspace-scope";

const SELECT =
  "id, workspace_id, profile_id, industry, prospect_text, ai_response, label, mode, occurrences, call_id, status, reviewed_at, first_seen_at, last_seen_at";


/** Rough dedupe key so the same objection asked twice becomes one queue row. */
function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Called from the live dialer whenever the AI answered an objection without a
 * matching approved line. Nothing goes into a closer profile automatically —
 * the row lands in a review queue a human has to approve.
 */
export const captureObjectionCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        prospectText: z.string().trim().min(3).max(1000),
        aiResponse: z.string().trim().min(1).max(1200),
        label: z.string().trim().max(120).nullish(),
        mode: z.string().trim().max(30).nullish(),
        industry: z.string().trim().max(60).nullish(),
        profileId: z.string().uuid().nullish(),
        callId: z.string().uuid().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const { data: existing } = await context.supabase
      .from("objection_candidates")
      .select("id, prospect_text, occurrences, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("last_seen_at", { ascending: false })
      .limit(200);

    const key = normalize(data.prospectText);
    const match = (existing ?? []).find((r: any) => normalize(r.prospect_text) === key);

    if (match) {
      await context.supabase
        .from("objection_candidates")
        .update({ occurrences: (match.occurrences ?? 1) + 1, last_seen_at: new Date().toISOString() })
        .eq("id", match.id);
      return { ok: true as const, id: match.id as string, deduped: true as const };
    }

    const { data: row, error } = await context.supabase
      .from("objection_candidates")
      .insert({
        workspace_id: workspaceId,
        profile_id: data.profileId ?? null,
        industry: data.industry ?? null,
        prospect_text: data.prospectText,
        ai_response: data.aiResponse,
        label: data.label ?? null,
        mode: data.mode ?? null,
        call_id: data.callId ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row?.id as string, deduped: false as const };
  });

/** The review queue behind Studio → Closer Profiles. */
export const listObjectionCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("objection_candidates")
      .select(SELECT)
      .eq("workspace_id", workspaceId)
      .order("status", { ascending: true })
      .order("occurrences", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(200);
    return { workspaceId, candidates: data ?? [] };
  });

/**
 * Approve a candidate into a closer profile's objection library (editable text
 * wins over the AI's original wording), or dismiss it.
 */
export const reviewObjectionCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "dismiss", "reopen"]),
        profileId: z.string().uuid().nullish(),
        trigger: z.string().trim().max(300).nullish(),
        approvedResponse: z.string().trim().max(1200).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const { data: row } = await context.supabase
      .from("objection_candidates")
      .select("id, prospect_text, ai_response")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!row) throw new Error("Candidate not found in this workspace.");

    if (data.action === "approve") {
      if (!data.profileId) throw new Error("Pick the closer profile this line belongs to.");
      const { data: profile } = await context.supabase
        .from("closer_profiles")
        .select("id, workspace_id, objections")
        .eq("id", data.profileId)
        .maybeSingle();
      if (!profile) throw new Error("Closer profile not found.");
      if (profile.workspace_id !== workspaceId)
        throw new Error("Platform profiles are read-only. Duplicate it into this workspace first.");

      const trigger = (data.trigger || row.prospect_text).slice(0, 300);
      const approved_response = (data.approvedResponse || row.ai_response).slice(0, 1200);
      const objections = [
        ...((profile.objections as any[]) ?? []).filter(
          (o) => String(o?.trigger ?? "").toLowerCase() !== trigger.toLowerCase(),
        ),
        { trigger, approved_response },
      ].slice(-60);

      const { error: upErr } = await context.supabase
        .from("closer_profiles")
        .update({ objections })
        .eq("id", profile.id);
      if (upErr) throw new Error(upErr.message);
    }

    const status =
      data.action === "approve" ? "approved" : data.action === "dismiss" ? "dismissed" : "pending";
    const { error } = await context.supabase
      .from("objection_candidates")
      .update({
        status,
        profile_id: data.action === "approve" ? data.profileId : undefined,
        reviewed_by: status === "pending" ? null : context.userId,
        reviewed_at: status === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true as const, status };
  });
