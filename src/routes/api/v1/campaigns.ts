import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Campaigns are creatable/launchable over HTTP so the hub can act, not rebuild. */
export const Route = createFileRoute("/api/v1/campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const { data, error } = await supabase
            .from("campaigns")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw new Error(error.message);
          return Response.json({ campaigns: data ?? [] });
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
              name: z.string().min(1).max(200),
              mode: z.enum(["full_ai", "hybrid", "copilot"]).default("copilot"),
              agent_id: z.string().uuid().nullish(),
              launch: z.boolean().default(true),
            })
            .parse(await request.json());

          const { data, error } = await supabase
            .from("campaigns")
            .insert({
              org_id: orgId,
              workspace_id: workspaceId,
              name: body.name,
              mode: body.mode,
              agent_id: body.agent_id ?? null,
              status: body.launch ? "active" : "draft",
            })
            .select("*")
            .single();
          if (error) throw new Error(error.message);

          if (body.launch) {
            const { emitEvent } = await import("@/lib/hub.server");
            await emitEvent(orgId, "campaign.launched", {
              campaign_id: data.id,
              name: data.name,
              mode: data.mode,
            });
          }

          return Response.json({ campaign: data }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
