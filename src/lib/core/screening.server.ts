/**
 * Core bulk screening + suppression mirroring (server-only).
 *
 * Bulk assertions are advisory: they exist to clean a queue before dialing, and
 * never authorize a dial. The dialer still calls assertCanCall at the moment of
 * contact. Suppression mirroring copies Core's shared opt-out list into the
 * local Do Not Call table so local rules agree with Core even offline.
 */

import { MAX_BULK_IDENTIFIERS, type AssertBulkResult } from "./sdk";
import { toE164 } from "./tenancy.server";

export type ScreenRow = {
  identifier: string;
  decision: "allow" | "deny" | "error";
  deniedBy: string | null;
  reason: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs assert-bulk over any number of identifiers, batching to Core's limit. */
export async function assertBulkAll(args: {
  coreWorkspaceId: string;
  identifiers: string[];
  actorId: string;
}): Promise<{ rows: ScreenRow[]; evaluatedAt: string }> {
  const { coreService } = await import("./core.server");
  const core = coreService();
  const rows: ScreenRow[] = [];
  let evaluatedAt = new Date().toISOString();

  for (const batch of chunk(args.identifiers, MAX_BULK_IDENTIFIERS)) {
    const result: AssertBulkResult = await core.policy.assertBulk({
      workspace_id: args.coreWorkspaceId,
      action: "call",
      channel: "voice",
      identifiers: batch,
      actor_type: "automation",
      actor_id: args.actorId,
    });
    evaluatedAt = result.evaluated_at ?? evaluatedAt;
    for (const r of result.results) {
      rows.push({
        identifier: r.identifier,
        decision: r.decision,
        deniedBy: r.denied_by ?? null,
        reason: r.reason ?? r.error ?? null,
      });
    }
  }

  return { rows, evaluatedAt };
}

/** Records advisory bulk outcomes in the policy-check audit log. */
export async function logScreenRows(args: {
  workspaceId: string;
  coreWorkspaceId: string;
  actorId: string;
  rows: ScreenRow[];
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const payload = args.rows.map((r) => ({
    workspace_id: args.workspaceId,
    core_workspace_id: args.coreWorkspaceId,
    action: "call",
    channel: "voice",
    identifier: r.identifier,
    decision: r.decision === "error" ? "deny" : r.decision,
    denied_by: r.deniedBy,
    reason: r.reason ? `bulk_screen:${r.reason}` : "bulk_screen",
    actor_type: "automation",
    actor_id: args.actorId,
    rules_evaluated: [],
  }));
  try {
    for (const batch of chunk(payload, 500)) {
      await supabaseAdmin.from("core_policy_checks").insert(batch as never);
    }
  } catch {
    /* the audit write must never fail the screening result */
  }
}

/**
 * Copies Core suppressions for voice into the local Do Not Call list and flags
 * matching contacts as suppressed. Returns what changed.
 */
export async function mirrorSuppressions(args: {
  supabase: any;
  workspaceId: string;
  orgId: string;
  coreWorkspaceId: string;
}) {
  const { coreService } = await import("./core.server");
  const { suppressions } = await coreService().suppressions.list(args.coreWorkspaceId);

  const numbers = Array.from(
    new Set(
      suppressions
        .filter((s) => s.channel === "voice" || s.channel === "all")
        .map((s) => toE164(s.identifier))
        .filter((v): v is string => !!v),
    ),
  );
  if (numbers.length === 0) return { mirrored: 0, added: 0, contactsSuppressed: 0 };

  const { data: existing } = await args.supabase
    .from("dnc_list")
    .select("phone")
    .eq("workspace_id", args.workspaceId)
    .in("phone", numbers);
  const have = new Set((existing ?? []).map((r: { phone: string }) => r.phone));
  const missing = numbers.filter((n) => !have.has(n));

  if (missing.length) {
    const { error } = await args.supabase.from("dnc_list").insert(
      missing.map((phone) => ({
        org_id: args.orgId,
        workspace_id: args.workspaceId,
        phone,
        reason: "core_suppression",
      })),
    );
    if (error) throw new Error(error.message);
  }

  // Keep contacts in step so campaign builders skip them too.
  const { data: touched } = await args.supabase
    .from("contacts")
    .update({ suppressed: true, suppressed_at: new Date().toISOString() })
    .eq("workspace_id", args.workspaceId)
    .eq("suppressed", false)
    .in("phone", numbers)
    .select("id");

  return {
    mirrored: numbers.length,
    added: missing.length,
    contactsSuppressed: (touched ?? []).length,
  };
}
