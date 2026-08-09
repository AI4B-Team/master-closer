import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Do-not-call: add a number and flag the matching lead, emitting the family event. */
export const Route = createFileRoute("/api/v1/dnc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase } = await apiClient(request);
          const { data, error } = await supabase
            .from("dnc_list")
            .select("*")
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

          const { data: lead } = await supabase
            .from("leads")
            .update({ consent: "opt_out" })
            .eq("phone", body.phone)
            .select("id")
            .maybeSingle();

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "lead.flagged_dnc", {
            phone: body.phone,
            reason: data.reason,
            lead_id: lead?.id ?? null,
          });

          return Response.json({ dnc: data }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
