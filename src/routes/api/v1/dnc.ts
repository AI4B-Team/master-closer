import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "lead.flagged_dnc", {
            phone: body.phone,
            reason: data.reason,
            lead_id: leadIds[0] ?? null,
            leads_flagged: leadIds.length,
            contacts_suppressed: contactsSuppressed,
          });

          return Response.json({ dnc: data, leads_flagged: leadIds.length, contacts_suppressed: contactsSuppressed }, { status: 201 });

        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
