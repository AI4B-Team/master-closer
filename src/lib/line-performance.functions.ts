import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeWorkspace } from "./workspace-scope";

const WIN_WORDS = ["won", "book", "appointment", "sale", "sold", "closed", "demo", "meeting"];


function isWin(disposition: string | null) {
  if (!disposition) return false;
  const d = disposition.toLowerCase();
  return WIN_WORDS.some((w) => d.includes(w));
}

/**
 * Which objection lines actually move calls. Aggregated from live suggestions
 * joined to the outcome of the call they were surfaced on, so a workspace can
 * see what to promote into a closer profile and what to rewrite.
 */
export const linePerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: calls } = await context.supabase
      .from("calls")
      .select("id, disposition, mode, started_at")
      .eq("workspace_id", workspaceId)
      .gte("started_at", since)
      .limit(2000);

    const callIds = (calls ?? []).map((c: any) => c.id);
    if (callIds.length === 0) {
      return { days: data.days, totals: { surfaced: 0, used: 0, wins: 0 }, rows: [] };
    }

    const byCall = new Map<string, { disposition: string | null; mode: string | null }>();
    for (const c of calls ?? []) byCall.set(c.id, { disposition: c.disposition, mode: c.mode });

    const { data: suggestions } = await context.supabase
      .from("suggestions")
      .select("id, call_id, objection, line, was_used")
      .eq("workspace_id", workspaceId)
      .in("call_id", callIds)
      .limit(5000);

    type Agg = {
      objection: string;
      surfaced: number;
      used: number;
      wins: number;
      topLine: string;
      lines: Map<string, number>;
    };
    const agg = new Map<string, Agg>();
    const totals = { surfaced: 0, used: 0, wins: 0 };

    for (const s of suggestions ?? []) {
      const key = String(s.objection || "Other").trim() || "Other";
      const row =
        agg.get(key) ??
        ({ objection: key, surfaced: 0, used: 0, wins: 0, topLine: s.line, lines: new Map() } as Agg);
      row.surfaced += 1;
      totals.surfaced += 1;
      if (s.was_used) {
        row.used += 1;
        totals.used += 1;
        row.lines.set(s.line, (row.lines.get(s.line) ?? 0) + 1);
      }
      const call = byCall.get(s.call_id);
      if (s.was_used && isWin(call?.disposition ?? null)) {
        row.wins += 1;
        totals.wins += 1;
      }
      agg.set(key, row);
    }

    const rows = [...agg.values()]
      .map((r) => {
        const top = [...r.lines.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? r.topLine;
        return {
          objection: r.objection,
          surfaced: r.surfaced,
          used: r.used,
          wins: r.wins,
          adoption: r.surfaced ? Math.round((r.used / r.surfaced) * 100) : 0,
          winRate: r.used ? Math.round((r.wins / r.used) * 100) : 0,
          topLine: String(top ?? "").slice(0, 400),
        };
      })
      .sort((a, b) => b.surfaced - a.surfaced)
      .slice(0, 40);

    return { days: data.days, totals, rows };
  });

/**
 * Promote a proven live line into a workspace closer profile's objection
 * library. Same write path as the review queue: human-triggered only.
 */
export const promoteLineToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        profileId: z.string().uuid(),
        trigger: z.string().trim().min(2).max(300),
        response: z.string().trim().min(2).max(1200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const { data: profile } = await context.supabase
      .from("closer_profiles")
      .select("id, workspace_id, objections")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!profile) throw new Error("Closer profile not found.");
    if (profile.workspace_id !== workspaceId)
      throw new Error("Platform profiles are read-only. Duplicate it into this workspace first.");

    const objections = [
      ...(((profile.objections as any[]) ?? []).filter(
        (o) => String(o?.trigger ?? "").toLowerCase() !== data.trigger.toLowerCase(),
      )),
      { trigger: data.trigger, approved_response: data.response },
    ].slice(-60);

    const { error } = await context.supabase
      .from("closer_profiles")
      .update({ objections })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
