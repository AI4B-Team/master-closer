import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activeWorkspace } from "./workspace-scope";
import { isWin } from "./line-performance.shared";

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

    // The Data API caps a single response at 1000 rows regardless of .limit(),
    // so both reads are paged. Calls are ordered newest-first so the window is
    // a deterministic "most recent" sample rather than whatever the planner
    // happened to return.
    const CALL_CAP = 2000;
    const PAGE = 1000;
    type CallRow = { id: string; disposition: string | null; mode: string | null };
    const calls: CallRow[] = [];
    for (let from = 0; from < CALL_CAP; from += PAGE) {
      const { data: page } = await context.supabase
        .from("calls")
        .select("id, disposition, mode, started_at")
        .eq("workspace_id", workspaceId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .range(from, Math.min(from + PAGE, CALL_CAP) - 1);
      if (!page?.length) break;
      calls.push(...(page as unknown as CallRow[]));
      if (page.length < PAGE) break;
    }

    const callIds = calls.map((c) => c.id);
    if (callIds.length === 0) {
      return { days: data.days, totals: { surfaced: 0, used: 0, wins: 0 }, rows: [] };
    }

    const byCall = new Map<string, { disposition: string | null; mode: string | null }>();
    for (const c of calls) byCall.set(c.id, { disposition: c.disposition, mode: c.mode });

    // A single .in() over hundreds of ids builds a URL long enough to be
    // rejected outright, so the id list is filtered in chunks and each chunk
    // is paged to its end.
    type SuggestionRow = { call_id: string; objection: string; line: string; was_used: boolean };
    const suggestions: SuggestionRow[] = [];
    const CHUNK = 100;
    for (let i = 0; i < callIds.length; i += CHUNK) {
      const ids = callIds.slice(i, i + CHUNK);
      for (let from = 0; ; from += PAGE) {
        const { data: page } = await context.supabase
          .from("suggestions")
          .select("call_id, objection, line, was_used")
          .eq("workspace_id", workspaceId)
          .in("call_id", ids)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (!page?.length) break;
        suggestions.push(...(page as unknown as SuggestionRow[]));
        if (page.length < PAGE) break;
      }
    }


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
      .eq("id", profile.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
