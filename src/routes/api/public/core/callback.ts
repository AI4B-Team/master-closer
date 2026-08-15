import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 2 of the Core auth handoff: exchange the single-use code for a
 * Core-signed access token (POST {CORE_API_URL}/api/public/v1/auth/token) and
 * store it in HttpOnly cookies.
 *
 * Fails closed: no code, no Core, or a rejected grant means no session.
 */
export const Route = createFileRoute("/api/public/core/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          coreConfig,
          CORE_ACCESS_COOKIE,
          CORE_REFRESH_COOKIE,
          setCookie,
        } = await import("@/lib/core/core.server");
        const { apiUrl, appId } = coreConfig();
        if (!apiUrl) {
          return Response.json({ error: "core_not_configured", detail: "CORE_API_URL is missing." }, { status: 503 });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const next = url.searchParams.get("state") || "/dashboard";
        if (!code) return Response.json({ error: "missing_code" }, { status: 400 });

        const redirectUri = new URL("/api/public/core/callback", url.origin).toString();

        const res = await fetch(`${apiUrl}/api/public/v1/auth/token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, redirect_uri: redirectUri, app_id: appId }),
        });
        const body = (await res.json().catch(() => null)) as
          | { access_token: string; refresh_token: string; expires_in: number; workspace_id: string }
          | { error: string }
          | null;

        if (!res.ok || !body || !("access_token" in body)) {
          return Response.json(
            { error: "core_grant_failed", status: res.status, detail: body },
            { status: 502 },
          );
        }

        // Only allow same-site paths: "//evil.com" and "/\\evil.com" are
        // protocol-relative/backslash escapes that browsers treat as absolute.
        const safeNext =
          next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
        const headers = new Headers({ location: safeNext });
        headers.append("set-cookie", setCookie(CORE_ACCESS_COOKIE, body.access_token, body.expires_in));
        headers.append("set-cookie", setCookie(CORE_REFRESH_COOKIE, body.refresh_token, 30 * 24 * 60 * 60));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
