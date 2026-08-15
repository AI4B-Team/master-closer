import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point that mirrors Core's shared opt-out list into every linked
 * workspace's local Do Not Call list.
 */
export const Route = createFileRoute("/api/public/core/sync-suppressions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkCronAuth } = await import("@/lib/cron-auth.server");
        const denied = checkCronAuth(request, ["CORE_CRON_SECRET"]);
        if (denied) return denied;
        try {
          const { syncAllCoreSuppressions } = await import("@/lib/core/sync.server");
          return Response.json(await syncAllCoreSuppressions());
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Unexpected error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
