import { createFileRoute } from "@tanstack/react-router";

// Cron/hub-triggered retry of undelivered events. Protected by a shared secret
// header so only Real Elite (or the project's own scheduler) can trigger it.
export const Route = createFileRoute("/api/public/hub/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { checkCronAuth } = await import("@/lib/cron-auth.server");
        const denied = checkCronAuth(request, ["HUB_SIGNING_SECRET"], "x-hub-secret");
        if (denied) return denied;

        const { dispatchPending } = await import("@/lib/hub.server");
        const result = await dispatchPending();
        return Response.json(result);
      },
    },
  },
});
