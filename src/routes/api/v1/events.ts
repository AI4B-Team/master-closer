import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const EVENT_TYPES = [
  "job.completed",
  "leads.new",
  "lead.flagged_dnc",
  "lead.flagged_litigator",
  "campaign.launched",
  "message.reply_received",
  "brand.approved",
  "credits.low",
] as const;

export const Route = createFileRoute("/api/v1/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError, parseLimit } = await import("@/lib/api-auth.server");
        try {
          const { supabase, workspaceId } = await apiClient(request);
          const params = new URL(request.url).searchParams;
          const limit = parseLimit(params.get("limit"));
          const type = params.get("event_type");
          let query = supabase
            .from("events")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (type) query = query.eq("event_type", type);
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          return Response.json({ events: data ?? [] });
        } catch (e) {
          return apiError(e);
        }
      },
      POST: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { orgId, workspaceId } = await apiClient(request);
          const body = z
            .object({
              event_type: z.enum(EVENT_TYPES),
              payload: z.record(z.string(), z.unknown()).default({}),
            })
            .parse(await request.json());
          const { emitEvent } = await import("@/lib/hub.server");
          const event = await emitEvent(orgId, body.event_type, body.payload, workspaceId);
          return Response.json({ event }, { status: 201 });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
