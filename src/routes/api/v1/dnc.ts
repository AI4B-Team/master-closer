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

/** Do-not-call: add a number and flag the matching lead, emitting the family event. */


export const Route = createFileRoute("/api/v1/dnc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
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
            .object({ phone: z.string().min(5).max(32), reason: z.string().max(500).nullish() })
            .parse(await request.json());

          const { data, error } = await supabase
            .from("dnc_list")
            .insert({ org_id: orgId, workspace_id: workspaceId, phone: body.phone, reason: body.reason ?? null })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          // Match leads on their core digits so a stored +1 prefix never hides a hit.
          const { phoneKey } = await import("@/lib/phone");
          const key = phoneKey(body.phone);
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
            [body.phone],
          );

          // An opt-out taken over the API is the same promise as one taken in the
          // UI, so it must reach Core's family-wide list too. Reported, not
          // fatal: the local block already stands.
          const core = await pushToCore(supabase, workspaceId, body.phone, body.reason ?? undefined);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "lead.flagged_dnc", {
            phone: body.phone,
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
              family_wide: z.boolean().default(false),
              notes: z.string().max(500).optional(),
            })
            .refine((b) => !!(b.id || b.phone), { message: "id or phone is required" })
            .parse({
              id: url.searchParams.get("id") ?? undefined,
              phone: url.searchParams.get("phone") ?? undefined,
              family_wide: url.searchParams.get("family_wide") === "true",
              notes: url.searchParams.get("notes") ?? undefined,
            });

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

