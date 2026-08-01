import { createFileRoute } from "@tanstack/react-router";

// Cron/hub-triggered retry of undelivered events. Protected by a shared secret
// header so only Real Elite (or the project's own scheduler) can trigger it.
export const Route = createFileRoute("/api/public/hub/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.HUB_SIGNING_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });

        const provided = request.headers.get("x-hub-secret") ?? "";
        if (provided.length !== secret.length) return new Response("Unauthorized", { status: 401 });
        let same = 0;
        for (let i = 0; i < secret.length; i++) same |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
        if (same !== 0) return new Response("Unauthorized", { status: 401 });

        const { dispatchPending } = await import("@/lib/hub.server");
        const result = await dispatchPending();
        return Response.json(result);
      },
    },
  },
});
