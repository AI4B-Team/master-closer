import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point for scheduled report digests. The built-in database
 * scheduler POSTs here every 15 minutes; each schedule only fires when its own
 * next_run_at is due.
 */
export const Route = createFileRoute("/api/public/reports/digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkCronAuth } = await import("@/lib/cron-auth.server");
        const denied = checkCronAuth(request, ["AGENTS_CRON_SECRET"]);
        if (denied) return denied;
        try {
          const { runDueDigests } = await import("@/lib/reports.server");
          return Response.json(await runDueDigests());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
        }
      },
    },
  },
});
