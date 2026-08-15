import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/v1/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError, parseLimit } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const limit = parseLimit(new URL(request.url).searchParams.get("limit"));

          const { data, error } = await supabase
            .from("leads")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) throw new Error(error.message);
          return Response.json({ leads: data ?? [] });
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
              name: z.string().min(1),
              email: z.string().email().nullish(),
              phone: z.string().nullish(),
              company: z.string().nullish(),
              title: z.string().nullish(),
              source: z.string().nullish(),
              notes: z.string().nullish(),
            })
            .parse(await request.json());

          // A lead arriving through the API can already be on Do Not Call or
          // suppressed family-wide by Core: record it opted out so no surface
          // dials it.
          const { fetchBlockedPhoneKeysServer } = await import("@/lib/dnc.server");
          const { phoneKey } = await import("@/lib/phone");
          const key = phoneKey(body.phone);
          const blocked = key ? (await fetchBlockedPhoneKeysServer(supabase, workspaceId)).has(key) : false;

          // Same for the email side of the family-wide opt-out list.
          const { screenInboundEmail } = await import("@/lib/core/screening.server");
          const emailScreen = body.email
            ? await screenInboundEmail({ workspaceId, email: body.email })
            : { suppressed: false, reason: null };

          const { data, error } = await supabase
            .from("leads")
            .insert({
              ...body,
              org_id: orgId,
              workspace_id: workspaceId,
              ...(blocked ? { consent: "opt_out" as const } : {}),
            })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "leads.new", { lead_id: data.id, name: data.name, source: data.source }, workspaceId);

          return Response.json(
            { lead: data, suppressed: blocked, email_suppressed: emailScreen.suppressed },
            { status: 201 },
          );

        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
