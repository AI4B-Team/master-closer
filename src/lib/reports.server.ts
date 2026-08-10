/**
 * Scheduled report digests (server-only).
 *
 * A digest is a short performance summary for one workspace over the last day
 * or week. It lands in the workspace activity feed, which is what the bell menu
 * and the /notifications inbox read, so a schedule is useful before any email
 * domain is connected. Recipient addresses are stored so the same rows can feed
 * email delivery later without another migration.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Cadence = "daily" | "weekly";

export type DigestSchedule = {
  id: string;
  workspace_id: string;
  org_id: string;
  name: string;
  cadence: string;
  send_hour_utc: number;
  weekday: number;
  recipients: string[];
  enabled: boolean;
};

const db = () => supabaseAdmin;

/** Outcomes that mean a human actually picked up. */
const CONNECTED = new Set(["connected", "answered", "human"]);

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/**
 * The next UTC instant this schedule should fire, strictly after `from`.
 * Daily digests fire at `send_hour_utc`; weekly digests fire on `weekday`
 * (0 = Sunday) at the same hour.
 */
export function nextRunAt(schedule: Pick<DigestSchedule, "cadence" | "send_hour_utc" | "weekday">, from = new Date()) {
  const next = new Date(from);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(schedule.send_hour_utc);
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
  if (schedule.cadence === "weekly") {
    const ahead = (schedule.weekday - next.getUTCDay() + 7) % 7;
    if (ahead) next.setUTCDate(next.getUTCDate() + ahead);
  }
  return next.toISOString();
}

export type DigestBody = {
  headline: string;
  lines: string[];
  metrics: Record<string, number>;
};

/** Builds the digest text for one workspace over the trailing window. */
export async function buildDigest(workspaceId: string, cadence: Cadence): Promise<DigestBody> {
  const days = cadence === "daily" ? 1 : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: calls }, { data: deals }, { data: suggestions }, { data: proposals }, { data: candidates }] =
    await Promise.all([
      db()
        .from("calls")
        .select("outcome, dial_outcome, duration_sec, close_probability, started_at")
        .eq("workspace_id", workspaceId)
        .gte("started_at", since)
        .limit(2000),
      db()
        .from("deals")
        .select("value, stage, updated_at")
        .eq("workspace_id", workspaceId)
        .gte("updated_at", since)
        .limit(2000),
      db()
        .from("suggestions")
        .select("objection, was_used")
        .eq("workspace_id", workspaceId)
        .limit(2000),
      db()
        .from("agent_proposals")
        .select("status, expires_at, reviewed_at")
        .eq("workspace_id", workspaceId)
        .limit(2000),
      db()
        .from("objection_candidates")
        .select("status")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .limit(2000),
    ]);


  const rows = calls ?? [];
  const connects = rows.filter((c) => CONNECTED.has(String(c.dial_outcome ?? c.outcome ?? ""))).length;
  const talkMinutes = Math.round(rows.reduce((s, c) => s + Number(c.duration_sec ?? 0), 0) / 60);
  const probabilities = rows.map((c) => Number(c.close_probability ?? 0)).filter((n) => n > 0);
  const avgProbability = probabilities.length
    ? Math.round(probabilities.reduce((s, n) => s + n, 0) / probabilities.length)
    : 0;

  const won = (deals ?? []).filter((d) => String(d.stage ?? "") === "won");
  const revenue = won.reduce((s, d) => s + Number(d.value ?? 0), 0);

  const byTrigger = new Map<string, number>();
  for (const s of suggestions ?? []) {
    const key = String(s.objection ?? "").trim();
    if (key) byTrigger.set(key, (byTrigger.get(key) ?? 0) + 1);
  }

  const topObjection = [...byTrigger.entries()].sort((a, b) => b[1] - a[1])[0];

  const window = cadence === "daily" ? "Last 24 Hours" : "Last 7 Days";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const lines = [
    `${plural(rows.length, "call")} · ${connects} connects (${rows.length ? Math.round((connects / rows.length) * 100) : 0}%)`,
    `${talkMinutes} talk minutes · ${avgProbability}% avg close probability`,
    `${plural(won.length, "deal")} won · ${money(revenue)} closed`,
  ];
  if (topObjection) lines.push(`Top objection: ${topObjection[0]} (${topObjection[1]}x)`);

  return {
    headline: `${window}: ${plural(rows.length, "call")}, ${won.length} won, ${money(revenue)}`,
    lines,
    metrics: {
      calls: rows.length,
      connects,
      talk_minutes: talkMinutes,
      avg_close_probability: avgProbability,
      deals_won: won.length,
      revenue,
    },
  };
}

/** Builds and delivers one digest, then advances the schedule. */
export async function runSchedule(schedule: DigestSchedule) {
  const cadence: Cadence = schedule.cadence === "daily" ? "daily" : "weekly";
  const digest = await buildDigest(schedule.workspace_id, cadence);
  const now = new Date();

  await db().from("events").insert({
    org_id: schedule.org_id,
    workspace_id: schedule.workspace_id,
    event_type: "report.digest",
    payload: {
      kind: "report.digest",
      schedule_id: schedule.id,
      name: schedule.name,
      cadence,
      message: digest.headline,
      lines: digest.lines,
      metrics: digest.metrics,
      recipients: schedule.recipients,
    },
  });

  await db()
    .from("report_schedules")
    .update({ last_run_at: now.toISOString(), next_run_at: nextRunAt(schedule, now) })
    .eq("id", schedule.id);

  return { schedule_id: schedule.id, name: schedule.name, headline: digest.headline };
}

/**
 * Cron entry point. Runs every schedule whose next_run_at has passed; a schedule
 * with no next_run_at yet is scheduled forward instead of firing immediately, so
 * creating one never dumps a digest into the feed out of nowhere.
 */
export async function runDueDigests(opts: { workspaceId?: string; scheduleId?: string; force?: boolean } = {}) {
  let q = db()
    .from("report_schedules")
    .select("id, workspace_id, org_id, name, cadence, send_hour_utc, weekday, recipients, enabled");
  if (opts.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
  if (opts.scheduleId) q = q.eq("id", opts.scheduleId);
  if (!opts.force) {
    q = q.eq("enabled", true).not("next_run_at", "is", null).lte("next_run_at", new Date().toISOString());
  }

  const { data, error } = await q.limit(200);
  if (error) throw new Error(error.message);

  const ran: { schedule_id: string; name: string; headline: string }[] = [];
  for (const s of (data ?? []) as DigestSchedule[]) {
    ran.push(await runSchedule(s));
  }

  // Prime anything that has never been scheduled so the next tick picks it up.
  if (!opts.force) {
    const { data: unscheduled } = await db()
      .from("report_schedules")
      .select("id, cadence, send_hour_utc, weekday")
      .eq("enabled", true)
      .is("next_run_at", null)
      .limit(200);
    for (const s of unscheduled ?? []) {
      await db()
        .from("report_schedules")
        .update({ next_run_at: nextRunAt(s as DigestSchedule) })
        .eq("id", s.id);
    }
  }

  return { ran: ran.length, digests: ran };
}
