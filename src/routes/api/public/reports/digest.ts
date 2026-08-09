import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point for scheduled report digests. Point an external scheduler at
 * this every 15 minutes; each schedule only fires when its own next_run_at is due.
 */
export const Route = createFileRoute("/api/public/reports/digest")({
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
          const { runDueDigests } = await import("@/lib/reports.server");
          return Response.json(await runDueDigests());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
        }
      },
    },
  },
});
