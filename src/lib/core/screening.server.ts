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
 * Copies Core suppressions for voice into the local Do Not Call list, flags
 * matching contacts as suppressed, and releases mirrored entries Core has since
 * lifted. Returns what changed.
 *
 * Releases only ever touch rows this mirror created (`reason = core_suppression`):
 * a number a human added locally stays on Do Not Call regardless of Core.
 */
export async function mirrorSuppressions(args: {
  supabase: any;
  workspaceId: string;
  orgId: string;
  coreWorkspaceId: string;
}) {
  const { coreService } = await import("./core.server");
  const { phoneKey } = await import("@/lib/phone");
  const { suppressions } = await coreService().suppressions.list(args.coreWorkspaceId);

  const numbers = Array.from(
    new Set(
      suppressions
        .filter((s) => s.channel === "voice" || s.channel === "all")
        .map((s) => toE164(s.identifier))
        .filter((v): v is string => !!v),
    ),
  );
  const coreKeys = new Set(numbers.map((n) => phoneKey(n)).filter(Boolean));

  let added = 0;
  if (numbers.length) {
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
    added = missing.length;
  }

  // Core has lifted anything still mirrored locally but absent from its list.
  const { data: mirrored } = await args.supabase
    .from("dnc_list")
    .select("id, phone")
    .eq("workspace_id", args.workspaceId)
    .eq("reason", "core_suppression");
  const staleRows = (mirrored ?? []).filter(
    (r: { phone: string | null }) => !coreKeys.has(phoneKey(r.phone)),
  );
  if (staleRows.length) {
    await args.supabase
      .from("dnc_list")
      .delete()
      .in("id", staleRows.map((r: { id: string }) => r.id));
  }

  // Keep contacts in step so campaign builders skip them too. Local numbers are
  // stored as typed, so match on the normalized form rather than raw text.
  const { data: candidates } = await args.supabase
    .from("contacts")
    .select("id, phone, suppressed")
    .eq("workspace_id", args.workspaceId)
    .not("phone", "is", null);

  const hitIds = (candidates ?? [])
    .filter((c: { phone: string | null; suppressed: boolean }) => !c.suppressed && coreKeys.has(phoneKey(c.phone)))
    .map((c: { id: string }) => c.id);

  let touched: { id: string }[] = [];
  if (hitIds.length) {
    const { data } = await args.supabase
      .from("contacts")
      .update({ suppressed: true, suppressed_at: new Date().toISOString() })
      .in("id", hitIds)
      .select("id");
    touched = data ?? [];
  }

  // Remaining local Do Not Call entries still cover a number even after Core
  // lifts it, so both release passes below share one read.
  let localKeys = new Set<string>();
  if (staleRows.length) {
    const { data: remaining } = await args.supabase
      .from("dnc_list")
      .select("phone")
      .eq("workspace_id", args.workspaceId);
    localKeys = new Set((remaining ?? []).map((r: { phone: string | null }) => phoneKey(r.phone)));
  }
  const isReleased = (phone: string | null) => {
    const k = phoneKey(phone);
    return !!k && !coreKeys.has(k) && !localKeys.has(k);
  };

  // A contact only comes back when neither Core nor any remaining local Do Not
  // Call entry covers the number. Follow-up lines stay paused: resuming outreach
  // is a human decision, surfaced in the Compliance Center.
  let contactsReleased = 0;
  if (staleRows.length) {
    const releaseIds = (candidates ?? [])
      .filter((c: { phone: string | null; suppressed: boolean }) => c.suppressed && isReleased(c.phone))
      .map((c: { id: string }) => c.id);
    if (releaseIds.length) {
      const { data } = await args.supabase
        .from("contacts")
        .update({ suppressed: false, suppressed_at: null })
        .in("id", releaseIds)
        .select("id");
      contactsReleased = (data ?? []).length;
    }
  }

  // Leads carry their own consent state, and the dialer, worklist and agreement
  // surfaces read it. Mirroring it keeps a Core opt-out visible on the lead
  // record itself instead of only on the contact.
  const { data: leadRows } = await args.supabase
    .from("leads")
    .select("id, phone, consent")
    .eq("workspace_id", args.workspaceId)
    .not("phone", "is", null);

  const leadHits = (leadRows ?? [])
    .filter((l: { phone: string | null; consent: string }) => l.consent !== "opt_out" && coreKeys.has(phoneKey(l.phone)))
    .map((l: { id: string }) => l.id);
  let leadsFlagged = 0;
  if (leadHits.length) {
    const { data } = await args.supabase
      .from("leads")
      .update({ consent: "opt_out" })
      .in("id", leadHits)
      .select("id");
    leadsFlagged = (data ?? []).length;
  }

  let leadsReleased = 0;
  if (staleRows.length) {
    const releaseIds = (leadRows ?? [])
      .filter((l: { phone: string | null; consent: string }) => l.consent === "opt_out" && isReleased(l.phone))
      .map((l: { id: string }) => l.id);
    if (releaseIds.length) {
      const { data } = await args.supabase
        .from("leads")
        .update({ consent: "unknown" })
        .in("id", releaseIds)
        .select("id");
      leadsReleased = (data ?? []).length;
    }
  }

  // Call-list rows are what the dialer and campaign counts read, so they need
  // the same consent mirror as leads or a Core opt-out stays dialable in a list.
  const { data: listRows } = await args.supabase
    .from("list_contacts")
    .select("id, phone, consent")
    .eq("workspace_id", args.workspaceId);

  const listHits = (listRows ?? [])
    .filter((c: { phone: string | null; consent: string }) => c.consent !== "opt_out" && coreKeys.has(phoneKey(c.phone)))
    .map((c: { id: string }) => c.id);
  let listContactsFlagged = 0;
  if (listHits.length) {
    const { data } = await args.supabase
      .from("list_contacts")
      .update({ consent: "opt_out" })
      .in("id", listHits)
      .select("id");
    listContactsFlagged = (data ?? []).length;
  }

  let listContactsReleased = 0;
  if (staleRows.length) {
    const releaseIds = (listRows ?? [])
      .filter((c: { phone: string | null; consent: string }) => c.consent === "opt_out" && isReleased(c.phone))
      .map((c: { id: string }) => c.id);
    if (releaseIds.length) {
      const { data } = await args.supabase
        .from("list_contacts")
        .update({ consent: "unknown" })
        .in("id", releaseIds)
        .select("id");
      listContactsReleased = (data ?? []).length;
    }
  }

  return {
    mirrored: numbers.length,
    added,
    removed: staleRows.length,
    contactsSuppressed: (touched ?? []).length,
    contactsReleased,
    leadsFlagged,
    leadsReleased,
    listContactsFlagged,
    listContactsReleased,
  };
}


