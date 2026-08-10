import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point for the intelligence-agent scheduler. The built-in database
 * scheduler POSTs here every 5 minutes; each agent still only runs when its own
 * cadence is due.
 */
export const Route = createFileRoute("/api/public/agents/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkCronAuth } = await import("@/lib/cron-auth.server");
        const denied = checkCronAuth(request, ["AGENTS_CRON_SECRET"]);
        if (denied) return denied;
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
