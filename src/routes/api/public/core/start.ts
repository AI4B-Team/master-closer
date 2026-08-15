import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 1 of the Core auth handoff: send the user to Core's consent screen so
 * they can pick the workspace Master Closer may act inside.
 *
 * Core's authorize screen lives at {CORE_AUTH_URL}/authorize and expects
 * app_id, redirect_uri and an optional state (verified in CORE's
 * src/routes/_authenticated/authorize.tsx).
 */
export const Route = createFileRoute("/api/public/core/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { coreConfig } = await import("@/lib/core/core.server");
        const { authUrl, appId } = coreConfig();
        if (!authUrl) {
          return Response.json({ error: "core_not_configured", detail: "CORE_AUTH_URL is missing." }, { status: 503 });
        }

        const url = new URL(request.url);
        const requestedNext = url.searchParams.get("next") ?? "/dashboard";
        const next =
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//") &&
          !requestedNext.startsWith("/\\")
            ? requestedNext
            : "/dashboard";
        const redirectUri = new URL("/api/public/core/callback", url.origin).toString();

        const target = new URL("/authorize", authUrl.replace(/\/$/, ""));
        target.searchParams.set("app_id", appId);
        target.searchParams.set("redirect_uri", redirectUri);
        target.searchParams.set("state", next);

        return new Response(null, { status: 302, headers: { location: target.toString() } });
      },
    },
  },
});
