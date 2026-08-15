import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Mirrors an API-taken opt-out onto Core's family-wide suppression list.
 * Never throws: the local Do Not Call entry already blocks the number, so a Core
 * outage is reported back to the caller rather than failing the request.
 */
async function pushToCore(
  supabase: any,
  workspaceId: string,
  phone: string,
  reason?: string,
): Promise<{ status: "ok" | "unlinked" | "error"; reason?: string }> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("core_workspace_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws?.core_workspace_id) return { status: "unlinked" };

    const { toE164 } = await import("@/lib/core/tenancy.server");
    const identifier = toE164(phone);
    if (!identifier) return { status: "error", reason: "unrecognized_phone_format" };

    const { coreService } = await import("@/lib/core/core.server");
    const { CoreApiError } = await import("@/lib/core/sdk");
    try {
      await coreService().suppressions.create({
        workspace_id: ws.core_workspace_id as string,
        channel: "voice",
        identifier,
        reason: reason || "opt_out",
      });
      // Same audit trail the email path writes, so API-taken voice opt-outs show
      // up in the governance panel's "Opt-Outs Added" view.
      await auditSuppressionWrite(
        supabase,
        workspaceId,
        ws.core_workspace_id as string,
        "suppression.create",
        identifier,
        "dial",
        reason || undefined,
      );
      return { status: "ok" };

    } catch (e) {
      return {
        status: "error",
        reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
      };
    }
  } catch {
    return { status: "error", reason: "core_unreachable" };
  }
}

/**
 * Asks Core whether it still holds a family-wide opt-out for a number.
 * Unknown (unlinked or Core unreachable) is reported as-is so callers never
 * treat an outage as "released".
 */
async function coreBlocks(
  supabase: any,
  workspaceId: string,
  phone: string,
): Promise<{ status: "blocked" | "clear" | "unlinked" | "unknown"; reason?: string }> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("core_workspace_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws?.core_workspace_id) return { status: "unlinked" };

    const { toE164 } = await import("@/lib/core/tenancy.server");
    const identifier = toE164(phone);
    if (!identifier) return { status: "unknown", reason: "unrecognized_phone_format" };

    const { coreService } = await import("@/lib/core/core.server");
    const { suppressions } = await coreService().suppressions.list(
      ws.core_workspace_id as string,
      identifier,
    );
    return { status: suppressions.length ? "blocked" : "clear" };
  } catch {
    return { status: "unknown", reason: "core_unreachable" };
  }
}

/**
 * Lifts Core's family-wide voice opt-out for a number, so an API release can be
 * as complete as the one in the Compliance Center. Audited in core_policy_checks
 * exactly like the in-app release, and never fatal: the caller is told what
 * happened so an outage is never read as "released".
 */
async function releaseCoreVoice(
  supabase: any,
  workspaceId: string,
  phone: string,
  notes?: string,
): Promise<{ status: "released" | "none" | "unlinked" | "error"; reason?: string; released?: number }> {
  try {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("core_workspace_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws?.core_workspace_id) return { status: "unlinked" };

    const { toE164 } = await import("@/lib/core/tenancy.server");
    const identifier = toE164(phone);
    if (!identifier) return { status: "error", reason: "unrecognized_phone_format" };

    const { coreService } = await import("@/lib/core/core.server");
    const { CoreApiError } = await import("@/lib/core/sdk");
    const svc = coreService();
    try {
      const { suppressions } = await svc.suppressions.list(
        ws.core_workspace_id as string,
        identifier,
      );
      const voice = suppressions.filter((s) => s.channel !== "email");
      if (!voice.length) return { status: "none", released: 0 };

      for (const s of voice) await svc.suppressions.remove(s.id);

      for (const s of voice) {
        await supabase.from("core_policy_checks").insert({
          workspace_id: workspaceId,
          core_workspace_id: ws.core_workspace_id,
          action: "suppression.release",
          channel: "dial",
          identifier: s.identifier,
          decision: "allow",
          denied_by: null,
          reason: `suppression_released${notes ? `: ${notes}` : ""}`,
          actor_type: "automation",
        });
      }
      return { status: "released", released: voice.length };
    } catch (e) {
      return {
        status: "error",
        reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
      };
    }
  } catch {
    return { status: "error", reason: "core_unreachable" };
  }
}

/**
 * Email-channel opt-outs have no local table: Core holds the family-wide list
 * and every surface screens against it. These helpers keep the API's email
 * behaviour identical to the Compliance Center's Email Opt-Outs panel.
 */
async function coreWorkspaceOf(supabase: any, workspaceId: string): Promise<string | null> {
  const { data: ws } = await supabase
    .from("workspaces")
    .select("core_workspace_id")
    .eq("id", workspaceId)
    .maybeSingle();
  return (ws?.core_workspace_id as string | null) ?? null;
}

async function auditSuppressionWrite(
  supabase: any,
  workspaceId: string,
  coreWorkspaceId: string,
  action: "suppression.create" | "suppression.release",
  identifier: string,
  channel: "send" | "dial",
  notes?: string,
) {
  try {
    await supabase.from("core_policy_checks").insert({
      workspace_id: workspaceId,
      core_workspace_id: coreWorkspaceId,
      action,
      channel,
      identifier,
      decision: "allow",
      denied_by: null,
      reason: `${action === "suppression.create" ? "suppression_created" : "suppression_released"}${notes ? `: ${notes}` : ""}`,
      actor_type: "automation",
    });
  } catch {
    /* the audit row must never fail the compliance action */
  }
}

async function emailSuppressions(
  supabase: any,
  workspaceId: string,
  email?: string,
): Promise<
  | { status: "ok"; coreWorkspaceId: string; rows: { id: string; identifier: string; reason: string | null; created_at?: string }[] }
  | { status: "unlinked" }
  | { status: "error"; reason: string }
> {
  const coreWorkspaceId = await coreWorkspaceOf(supabase, workspaceId);
  if (!coreWorkspaceId) return { status: "unlinked" };
  const { coreService } = await import("@/lib/core/core.server");
  const { CoreApiError } = await import("@/lib/core/sdk");
  try {
    const { suppressions } = await coreService().suppressions.list(
      coreWorkspaceId,
      email ? email.trim().toLowerCase() : undefined,
    );
    return {
      status: "ok",
      coreWorkspaceId,
      rows: suppressions
        .filter((s) => s.channel === "email")
        .map((s) => ({ id: s.id, identifier: s.identifier, reason: s.reason ?? null, created_at: s.created_at })),
    };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
    };
  }
}




export const Route = createFileRoute("/api/v1/dnc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const channel = new URL(request.url).searchParams.get("channel") ?? "voice";

          // Email opt-outs live only on Core's family-wide list.
          if (channel === "email") {
            const result = await emailSuppressions(supabase, workspaceId);
            if (result.status === "unlinked") {
              return Response.json({ channel: "email", core: "unlinked", suppressions: [] });
            }
            if (result.status === "error") {
              return Response.json(
                { error: "Core could not list email opt-outs.", core: result.reason },
                { status: 502 },
              );
            }
            return Response.json({ channel: "email", core: "ok", suppressions: result.rows });
          }

          const { data, error } = await supabase
            .from("dnc_list")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("added_at", { ascending: false })
            .limit(500);
          if (error) throw new Error(error.message);
          return Response.json({ dnc: data ?? [] });
        } catch (e) {
          return apiError(e);
        }
      },
      POST: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, orgId, workspaceId } = await apiClient(request);
          const body = z
            .object({
              phone: z.string().min(5).max(32).optional(),
              email: z.string().email().max(200).optional(),
              reason: z.string().max(500).nullish(),
            })
            .refine((b) => !!(b.phone || b.email), { message: "phone or email is required" })
            .parse(await request.json());

          // Email opt-outs are family-wide by nature: Core is the only store, so
          // a Core failure is fatal here rather than reported — otherwise the
          // caller would think the address was suppressed when nothing blocks it.
          if (body.email && !body.phone) {
            const email = body.email.trim().toLowerCase();
            const coreWorkspaceId = await coreWorkspaceOf(supabase, workspaceId);
            if (!coreWorkspaceId) {
              return Response.json(
                { error: "This workspace is not linked to Core, so email opt-outs cannot be recorded.", core: "unlinked" },
                { status: 409 },
              );
            }
            const { coreService } = await import("@/lib/core/core.server");
            const { CoreApiError } = await import("@/lib/core/sdk");
            try {
              await coreService().suppressions.create({
                workspace_id: coreWorkspaceId,
                channel: "email",
                identifier: email,
                reason: body.reason || "opt_out",
              });
            } catch (e) {
              return Response.json(
                {
                  error: "Core could not record the email opt-out.",
                  core: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
                },
                { status: 502 },
              );
            }
            await auditSuppressionWrite(
              supabase,
              workspaceId,
              coreWorkspaceId,
              "suppression.create",
              email,
              "send",
              body.reason ?? undefined,
            );

            const { emitEvent } = await import("@/lib/hub.server");
            await emitEvent(orgId, "lead.flagged_dnc", {
              email,
              channel: "email",
              reason: body.reason ?? null,
              core: "ok",
              family_wide: true,
            });

            return Response.json({ channel: "email", email, core: "ok", family_wide: true }, { status: 201 });
          }

          const phone = body.phone!;



          const { data, error } = await supabase
            .from("dnc_list")
            .insert({ org_id: orgId, workspace_id: workspaceId, phone, reason: body.reason ?? null })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          // Match leads on their core digits so a stored +1 prefix never hides a hit.
          const { phoneKey } = await import("@/lib/phone");
          const key = phoneKey(phone);
          const { data: candidates } = await supabase
            .from("leads")
            .select("id, phone")
            .eq("workspace_id", workspaceId)
            .not("phone", "is", null);
          const leadIds = (candidates ?? [])
            .filter((l) => !!key && phoneKey(l.phone) === key)
            .map((l) => l.id);
          if (leadIds.length) {
            await supabase.from("leads").update({ consent: "opt_out" }).in("id", leadIds);
          }

          // Flagging the contact is what stops nominations and worklists from
          // resurfacing the number (and pauses live lines via trigger).
          const { suppressContactsForPhonesServer } = await import("@/lib/dnc.server");
          const contactsSuppressed = await suppressContactsForPhonesServer(
            supabase,
            workspaceId,
            [phone],
          );

          // An opt-out taken over the API is the same promise as one taken in the
          // UI, so it must reach Core's family-wide list too. Reported, not
          // fatal: the local block already stands.
          const core = await pushToCore(supabase, workspaceId, phone, body.reason ?? undefined);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "lead.flagged_dnc", {
            phone,
            reason: data.reason,
            lead_id: leadIds[0] ?? null,
            leads_flagged: leadIds.length,
            contacts_suppressed: contactsSuppressed,
            core: core.status,
          });

          return Response.json(
            { dnc: data, leads_flagged: leadIds.length, contacts_suppressed: contactsSuppressed, core },
            { status: 201 },
          );


        } catch (e) {
          return apiError(e);
        }
      },
      /**
       * Release a number. By default only the local Do Not Call entry is lifted:
       * if Core still holds the family-wide opt-out the contact stays suppressed
       * and the response says so — never imply the number is dialable. Pass
       * `family_wide=true` to also ask Core to lift its suppression (audited).
       * Pass `email=` to lift a family-wide email opt-out instead.
       */
      DELETE: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, orgId, workspaceId } = await apiClient(request);
          const url = new URL(request.url);
          const body = z
            .object({
              id: z.string().uuid().optional(),
              phone: z.string().min(5).max(32).optional(),
              email: z.string().email().max(200).optional(),
              family_wide: z.boolean().default(false),
              notes: z.string().max(500).optional(),
            })
            .refine((b) => !!(b.id || b.phone || b.email), { message: "id, phone or email is required" })
            .parse({
              id: url.searchParams.get("id") ?? undefined,
              phone: url.searchParams.get("phone") ?? undefined,
              email: url.searchParams.get("email") ?? undefined,
              family_wide: url.searchParams.get("family_wide") === "true",
              notes: url.searchParams.get("notes") ?? undefined,
            });

          // Email opt-outs exist only on Core, so releasing one is a Core call
          // and nothing local changes.
          if (body.email && !body.phone && !body.id) {
            const email = body.email.trim().toLowerCase();
            const found = await emailSuppressions(supabase, workspaceId, email);
            if (found.status === "unlinked") {
              return Response.json({ error: "This workspace is not linked to Core.", core: "unlinked" }, { status: 409 });
            }
            if (found.status === "error") {
              return Response.json(
                { error: "Core could not be reached to lift the email opt-out.", core: found.reason },
                { status: 502 },
              );
            }
            if (!found.rows.length) {
              return Response.json({ error: "No email opt-out found for that address." }, { status: 404 });
            }

            const { coreService } = await import("@/lib/core/core.server");
            const { CoreApiError } = await import("@/lib/core/sdk");
            const svc = coreService();
            try {
              for (const row of found.rows) await svc.suppressions.remove(row.id);
            } catch (e) {
              return Response.json(
                {
                  error: "Core could not lift the email opt-out.",
                  core: e instanceof CoreApiError ? `core_${e.status}` : "core_unreachable",
                },
                { status: 502 },
              );
            }
            for (const row of found.rows) {
              await auditSuppressionWrite(
                supabase,
                workspaceId,
                found.coreWorkspaceId,
                "suppression.release",
                row.identifier,
                "send",
                body.notes,
              );
            }

            const { emitEvent } = await import("@/lib/hub.server");
            await emitEvent(orgId, "lead.released_dnc", {
              email,
              channel: "email",
              released: found.rows.length,
              family_wide: true,
              core: "released",
            });

            return Response.json({ channel: "email", email, released: found.rows.length, family_wide: true });
          }



          let q = supabase.from("dnc_list").select("id, phone").eq("workspace_id", workspaceId);
          q = body.id ? q.eq("id", body.id) : q.eq("phone", body.phone!);
          const { data: rows, error: findErr } = await q;
          if (findErr) throw new Error(findErr.message);
          if (!rows?.length) return Response.json({ error: "Not found" }, { status: 404 });

          // Core first: if the caller asked for a family-wide release and Core
          // refuses, the local entry stays put rather than half-releasing.
          const coreRelease = body.family_wide
            ? await releaseCoreVoice(supabase, workspaceId, rows[0].phone, body.notes)
            : null;
          if (coreRelease && coreRelease.status === "error") {
            return Response.json(
              { error: "Core could not lift the family-wide opt-out.", core: coreRelease, released: 0 },
              { status: 502 },
            );
          }

          const { error: delErr } = await supabase
            .from("dnc_list")
            .delete()
            .in("id", rows.map((r) => r.id));
          if (delErr) throw new Error(delErr.message);

          const coreStillBlocks = await coreBlocks(supabase, workspaceId, rows[0].phone);



          const { phoneKey } = await import("@/lib/phone");
          const key = phoneKey(rows[0].phone);
          let contactsReleased = 0;
          if (coreStillBlocks.status !== "blocked" && key) {
            const { data: contacts } = await supabase
              .from("contacts")
              .select("id, phone")
              .eq("workspace_id", workspaceId)
              .eq("suppressed", true);
            const ids = (contacts ?? [])
              .filter((c: { phone: string | null }) => phoneKey(c.phone) === key)
              .map((c: { id: string }) => c.id);
            if (ids.length) {
              const { error: upErr } = await supabase
                .from("contacts")
                .update({ suppressed: false, suppressed_at: null })
                .in("id", ids);
              if (!upErr) contactsReleased = ids.length;
            }
          }

          // POST flags matching leads as opted out, so a release has to undo it —
          // otherwise the number leaves Do Not Call but every lead surface still
          // refuses to dial it. Only when Core no longer blocks the number.
          let leadsReleased = 0;
          if (coreStillBlocks.status !== "blocked" && key) {
            const { data: optedOut } = await supabase
              .from("leads")
              .select("id, phone")
              .eq("workspace_id", workspaceId)
              .eq("consent", "opt_out")
              .not("phone", "is", null);
            const leadIds = (optedOut ?? [])
              .filter((l: { phone: string | null }) => phoneKey(l.phone) === key)
              .map((l: { id: string }) => l.id);
            if (leadIds.length) {
              const { error: upErr } = await supabase
                .from("leads")
                .update({ consent: "unknown" })
                .in("id", leadIds);
              if (!upErr) leadsReleased = leadIds.length;
            }
          }


          // Suppression pauses live follow-up lines through a database trigger.
          // Resuming them is a human decision, so report how many stay paused
          // rather than silently reactivating outreach.
          let linesPaused = 0;
          if (contactsReleased > 0 && key) {
            const { data: contacts } = await supabase
              .from("contacts")
              .select("id, phone")
              .eq("workspace_id", workspaceId);
            const ids = (contacts ?? [])
              .filter((c: { phone: string | null }) => phoneKey(c.phone) === key)
              .map((c: { id: string }) => c.id);
            if (ids.length) {
              const { count } = await supabase
                .from("lead_lines")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("status", "paused")
                .in("contact_id", ids);
              linesPaused = count ?? 0;
            }
          }

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "lead.released_dnc", {
            phone: rows[0].phone,
            entry_id: rows[0].id,
            contacts_released: contactsReleased,
            leads_released: leadsReleased,
            lines_paused: linesPaused,
            core: coreStillBlocks.status,
            family_wide: !!coreRelease && coreRelease.status === "released",
            core_released: coreRelease?.released ?? 0,
          });

          return Response.json({
            released: rows.length,
            contacts_released: contactsReleased,
            leads_released: leadsReleased,
            lines_still_paused: linesPaused,
            core: coreStillBlocks,
            family_wide_release: coreRelease,
          });


        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});

