import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Core tenancy + suppression surface.
 *
 * Core is the authority for who may be contacted. Every decision here comes
 * from Core and is recorded in core_policy_checks. When a workspace is linked
 * to Core, a Core failure denies the call (fail closed) — it never falls back to
 * a local guess. When a workspace is not linked yet, the call is reported as
 * `unlinked` so local compliance rules continue to govern it.
 */

export type CallDecision =
  | { status: "unlinked" }
  | {
      status: "decided";
      decision: "allow" | "allow_with_announcement" | "deny";
      requiresAnnouncement?: boolean;
      deniedBy?: string | null;
      reason?: string | null;
      policyCheckId?: string | null;
    }
  | { status: "unavailable"; reason: string };

/** Link status for the active workspace plus the Core tenants this app may use. */
export const getCoreTenancy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCoreLink } = await import("./tenancy.server");
    const { coreConfigStatus, coreService, CoreUnavailableError } = await import("./core.server");
    const { CoreApiError } = await import("./sdk");

    const status = coreConfigStatus();
    const { workspaceId, link } = await resolveCoreLink(context.supabase, context.userId);

    if (!status.configured) {
      return { workspaceId, link, configured: false as const, workspaces: [], error: "not_configured" };
    }

    try {
      const { workspaces } = await coreService().workspaces();
      return {
        workspaceId,
        link,
        configured: true as const,
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          legalEntityId: w.legal_entity_id,
          status: w.status ?? null,
        })),
        error: null,
      };
    } catch (e) {
      const reason =
        e instanceof CoreUnavailableError
          ? "not_configured"
          : e instanceof CoreApiError
            ? `core_${e.status}`
            : "unreachable";
      return { workspaceId, link, configured: true as const, workspaces: [], error: reason };
    }
  });

/** Bind the active workspace to a Core tenant. Admins only. */
export const linkWorkspaceToCore = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ coreWorkspaceId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { resolveCoreLink } = await import("./tenancy.server");
    const { coreService } = await import("./core.server");
    const { workspaceId } = await resolveCoreLink(context.supabase, context.userId);

    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("Only workspace owners and admins can link this workspace to Core.");
    }

    // The tenant must be one this app credential may actually act inside.
    const { workspaces } = await coreService().workspaces();
    const target = workspaces.find((w) => w.id === data.coreWorkspaceId);
    if (!target) throw new Error("That Core workspace is not entitled for Master Closer.");

    const { error } = await context.supabase
      .from("workspaces")
      .update({
        core_workspace_id: target.id,
        core_legal_entity_id: target.legal_entity_id,
        core_linked_at: new Date().toISOString(),
      })
      .eq("id", workspaceId);
    if (error) throw error;

    return { ok: true as const, coreWorkspaceId: target.id, name: target.name };
  });

/** Release the Core binding. Local compliance rules govern again afterwards. */
export const unlinkWorkspaceFromCore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCoreLink } = await import("./tenancy.server");
    const { workspaceId } = await resolveCoreLink(context.supabase, context.userId);

    const { data: member } = await context.supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("Only workspace owners and admins can unlink this workspace from Core.");
    }

    const { error } = await context.supabase
      .from("workspaces")
      .update({ core_workspace_id: null, core_legal_entity_id: null, core_linked_at: null })
      .eq("id", workspaceId);
    if (error) throw error;
    return { ok: true as const };
  });

/**
 * Point-of-contact authorization for a single number. Called immediately before
 * dialing — bulk results are advisory and never authorize a dial.
 */
export const assertCanCall = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().min(7),
        leadId: z.string().uuid().optional(),
        contactId: z.string().uuid().optional(),
        actorType: z.enum(["user", "ai", "automation"]).default("user"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<CallDecision> => {
    const { resolveCoreLink, toE164 } = await import("./tenancy.server");
    const { coreService, CoreUnavailableError } = await import("./core.server");
    const { CoreApiError } = await import("./sdk");

    const { workspaceId, link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" };

    const identifier = toE164(data.phone);
    if (!identifier) return { status: "unavailable", reason: "unrecognized_phone_format" };

    const log = async (row: Record<string, unknown>) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        await supabaseAdmin.from("core_policy_checks").insert({
          workspace_id: workspaceId,
          core_workspace_id: link.coreWorkspaceId,
          action: "call",
          channel: "voice",
          identifier,
          lead_id: data.leadId ?? null,
          actor_type: data.actorType,
          actor_id: context.userId,
          ...row,
        } as never);
      } catch {
        /* audit write must never block the compliance decision */
      }
    };

    try {
      const result = await coreService().policy.assert({
        workspace_id: link.coreWorkspaceId,
        action: "call",
        channel: "voice",
        identifier,
        contact_id: data.contactId,
        actor_type: data.actorType,
        actor_id: context.userId,
      });

      await log({
        decision: result.decision,
        denied_by: result.denied_by ?? null,
        reason: result.reason ?? null,
        policy_check_id: result.policy_check_id ?? null,
        rules_evaluated: result.rules_evaluated ?? [],
      });

      return {
        status: "decided",
        decision: result.decision,
        requiresAnnouncement: result.decision === "allow_with_announcement",
        deniedBy: result.denied_by ?? null,
        reason: result.reason ?? null,
        policyCheckId: result.policy_check_id ?? null,
      };
    } catch (e) {
      const reason =
        e instanceof CoreUnavailableError
          ? "core_not_configured"
          : e instanceof CoreApiError
            ? `core_${e.status}`
            : "core_unreachable";
      // Linked workspace + no Core answer = deny. Never guess locally.
      await log({ decision: "deny", denied_by: "core_unavailable", reason });
      return { status: "decided", decision: "deny", deniedBy: "core_unavailable", reason };
    }
  });

/** Recording-consent decision in the called party's jurisdiction. */
export const assertCanRecord = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: z.string().min(7) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { resolveCoreLink, toE164 } = await import("./tenancy.server");
    const { coreService } = await import("./core.server");

    const { workspaceId, link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" as const };
    const identifier = toE164(data.phone);
    if (!identifier) return { status: "unavailable" as const, reason: "unrecognized_phone_format" };

    // Recording verdicts are auditable evidence, so they land in the same log.
    const log = async (row: Record<string, unknown>) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        await supabaseAdmin.from("core_policy_checks").insert({
          workspace_id: workspaceId,
          core_workspace_id: link.coreWorkspaceId,
          action: "record",
          channel: "voice",
          identifier,
          actor_type: "user",
          actor_id: context.userId,
          rules_evaluated: [],
          ...row,
        } as never);
      } catch {
        /* audit write must never block the compliance decision */
      }
    };

    try {
      const r = await coreService().policy.assertCanRecord({
        workspace_id: link.coreWorkspaceId,
        called_e164: identifier,
        actor_type: "user",
        actor_id: context.userId,
      });
      await log({
        decision: r.decision,
        reason: `${r.consent_type} consent${r.called_state ? ` (${r.called_state})` : ""}${r.requires_announcement ? ", announcement required" : ""}`,
      });
      return {
        status: "decided" as const,
        decision: r.decision,
        consentType: r.consent_type,
        requiresAnnouncement: r.requires_announcement,
        calledState: r.called_state,
      };
    } catch {
      // Fail closed: assume the strictest posture when Core cannot answer.
      await log({ decision: "deny", denied_by: "core_unavailable", reason: "core_unreachable" });
      return { status: "decided" as const, decision: "deny" as const, consentType: "unknown" as const, requiresAnnouncement: true, calledState: null };
    }
  });

/** Suppressions held by Core for this tenant (all channels). */
export const listCoreSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCoreLink } = await import("./tenancy.server");
    const { coreService } = await import("./core.server");
    const { CoreApiError } = await import("./sdk");

    const { link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" as const, suppressions: [] };

    try {
      const { suppressions } = await coreService().suppressions.list(link.coreWorkspaceId);
      return {
        status: "ok" as const,
        suppressions: suppressions.map((s) => ({
          id: s.id,
          channel: s.channel,
          identifier: s.identifier,
          reason: s.reason,
          notes: s.notes,
          sourceAppId: s.source_app_id,
          createdAt: s.created_at,
        })),
      };
    } catch (e) {
      return {
        status: "error" as const,
        suppressions: [],
        reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
      };
    }
  });

/**
 * Record a suppression in Core. Opt-outs must reach Core so every app in the
 * family stops contacting the number, not just Master Closer.
 */
export const createCoreSuppression = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().min(7),
        reason: z.string().min(1).default("opt_out"),
        notes: z.string().max(500).optional(),
        channel: z.enum(["voice", "sms", "email", "messenger", "all"]).default("voice"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { resolveCoreLink, toE164 } = await import("./tenancy.server");
    const { coreService } = await import("./core.server");
    const { CoreApiError } = await import("./sdk");

    const { link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" as const };

    const identifier = toE164(data.phone);
    if (!identifier) return { status: "error" as const, reason: "unrecognized_phone_format" };

    try {
      const { suppression } = await coreService().suppressions.create({
        workspace_id: link.coreWorkspaceId,
        channel: data.channel,
        identifier,
        reason: data.reason,
        notes: data.notes,
      });
      return { status: "ok" as const, id: suppression.id, identifier };
    } catch (e) {
      return {
        status: "error" as const,
        reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
      };
    }
  });

/**
 * Advisory pre-screen of a call list against Core. Cleans the queue before
 * dialing; it never authorizes a dial on its own.
 */
export const screenCallListWithCore = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ listId: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { resolveCoreLink, toE164 } = await import("./tenancy.server");
    const { assertBulkAll, logScreenRows } = await import("./screening.server");
    const { CoreApiError } = await import("./sdk");

    const { workspaceId, link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" as const };

    const { data: list } = await context.supabase
      .from("call_lists")
      .select("id, name")
      .eq("id", data.listId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!list) throw new Error("That list is not in this workspace.");

    const { data: rows } = await context.supabase
      .from("list_contacts")
      .select("id, phone")
      .eq("list_id", data.listId)
      .eq("workspace_id", workspaceId);

    const map = new Map<string, string[]>();
    for (const r of rows ?? []) {
      const e164 = r.phone ? toE164(r.phone) : null;
      if (!e164) continue;
      map.set(e164, [...(map.get(e164) ?? []), r.id]);
    }
    const identifiers = [...map.keys()];
    if (identifiers.length === 0) {
      return { status: "ok" as const, listName: list.name, total: 0, allowed: 0, denied: 0, errors: 0, marked: 0, denies: [] };
    }

    let screened;
    try {
      screened = await assertBulkAll({
        coreWorkspaceId: link.coreWorkspaceId,
        identifiers,
        actorId: context.userId,
      });
    } catch (e) {
      return {
        status: "error" as const,
        reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
      };
    }

    await logScreenRows({
      workspaceId,
      coreWorkspaceId: link.coreWorkspaceId,
      actorId: context.userId,
      rows: screened.rows,
    });

    const denies = screened.rows.filter((r) => r.decision === "deny");
    const deniedIds = denies.flatMap((r) => map.get(r.identifier) ?? []);
    let marked = 0;
    if (deniedIds.length) {
      const { data: updated } = await context.supabase
        .from("list_contacts")
        .update({ consent: "opt_out" })
        .in("id", deniedIds)
        .select("id");
      marked = (updated ?? []).length;
    }

    return {
      status: "ok" as const,
      listName: list.name as string,
      total: screened.rows.length,
      allowed: screened.rows.filter((r) => r.decision === "allow").length,
      denied: denies.length,
      errors: screened.rows.filter((r) => r.decision === "error").length,
      marked,
      denies: denies.slice(0, 25).map((r) => ({
        identifier: r.identifier,
        deniedBy: r.deniedBy,
        reason: r.reason,
      })),
    };
  });

/** Mirrors Core's shared opt-out list into local Do Not Call and contacts. */
export const syncCoreSuppressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveCoreLink } = await import("./tenancy.server");
    const { mirrorSuppressions } = await import("./screening.server");
    const { CoreApiError } = await import("./sdk");

    const { workspaceId, orgId, link } = await resolveCoreLink(context.supabase, context.userId);
    if (!link) return { status: "unlinked" as const };

    try {
      const result = await mirrorSuppressions({
        supabase: context.supabase,
        workspaceId,
        orgId,
        coreWorkspaceId: link.coreWorkspaceId,
      });
      // A manual mirror belongs in the audit trail alongside the hourly sweep,
      // so the Compliance Center's "last mirror" line reflects it too.
      try {
        await context.supabase.from("events").insert({
          org_id: orgId,
          workspace_id: workspaceId,
          event_type: "job.completed",
          payload: {
            kind: "core.suppressions_synced",
            manual: true,
            mirrored: result.mirrored,
            added: result.added,
            removed: result.removed,
            contacts_suppressed: result.contactsSuppressed,
            contacts_released: result.contactsReleased,
            leads_flagged: result.leadsFlagged,
            leads_released: result.leadsReleased,
            list_contacts_flagged: result.listContactsFlagged,
            list_contacts_released: result.listContactsReleased,
          },
        });
      } catch {
        /* the audit write must never fail the mirror */
      }
      return { status: "ok" as const, ...result };

    } catch (e) {
      return {
        status: "error" as const,
        reason: e instanceof CoreApiError ? `core_${e.status}` : e instanceof Error ? e.message : "core_unreachable",
      };
    }
  });
