import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point for the background-agent scheduler. Configure an external
 * scheduler to POST here every 5 minutes; each agent still only runs when its
 * own cadence is due.
 */
export const Route = createFileRoute("/api/public/agents/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.AGENTS_CRON_SECRET;
        if (!secret) return new Response("Scheduler not configured", { status: 503 });
        const provided = request.headers.get("x-cron-key") ?? "";
        let diff = provided.length ^ secret.length;
        for (let i = 0; i < secret.length; i++) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
        if (diff !== 0) return new Response("Unauthorized", { status: 401 });
        try {
          const { tickAgents } = await import("@/lib/governance.server");
          const result = await tickAgents();
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
        }
      },
    },
  },
});
