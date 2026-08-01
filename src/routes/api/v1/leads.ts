import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/v1/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase } = await apiClient(request);
          const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 100), 500);
          const { data, error } = await supabase
            .from("leads")
            .select("*")
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
          const { supabase, orgId } = await apiClient(request);
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

          const { data, error } = await supabase
            .from("leads")
            .insert({ ...body, org_id: orgId })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          const { emitEvent } = await import("@/lib/hub.server");
          await emitEvent(orgId, "leads.new", { lead_id: data.id, name: data.name, source: data.source });

          return Response.json({ lead: data }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
