import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Calls: status/history for the hub, mirroring what the Calls screen shows. */
export const Route = createFileRoute("/api/v1/calls")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { apiClient, apiError } = await import("@/lib/api-auth.server");
        try {
          const { supabase } = await apiClient(request);
          const params = new URL(request.url).searchParams;
          const id = params.get("id");
          const limit = Math.min(Number(params.get("limit") ?? 100), 500);

          let query = supabase
            .from("calls")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(limit);
          if (id) query = query.eq("id", id);

          const { data, error } = await query;
          if (error) throw new Error(error.message);
          if (id) {
            const call = data?.[0];
            if (!call) return Response.json({ error: "Call not found" }, { status: 404 });
            return Response.json({ call });
          }
          return Response.json({ calls: data ?? [] });
        } catch (e) {
          return apiError(e);
        }
      },
    },
  },
});
