import { createFileRoute } from "@tanstack/react-router";

/**
 * Refresh the Core access token from the stored refresh token, optionally
 * switching workspace (POST {CORE_API_URL}/api/public/v1/auth/refresh).
 * Core rotates the refresh token on every use, so both cookies are rewritten.
 */
export const Route = createFileRoute("/api/public/core/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          coreConfig,
          CORE_ACCESS_COOKIE,
          CORE_REFRESH_COOKIE,
          readCookie,
          setCookie,
        } = await import("@/lib/core/core.server");
        const { apiUrl } = coreConfig();
        if (!apiUrl) {
          return Response.json({ error: "core_not_configured" }, { status: 503 });
        }

        const refreshToken = readCookie(request, CORE_REFRESH_COOKIE);
        if (!refreshToken) return Response.json({ error: "no_refresh_token" }, { status: 401 });

        const requested = (await request.json().catch(() => null)) as { workspace_id?: string } | null;

        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/public/v1/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            refresh_token: refreshToken,
            ...(requested?.workspace_id ? { workspace_id: requested.workspace_id } : {}),
          }),
        });
        const body = (await res.json().catch(() => null)) as
          | { access_token: string; refresh_token: string; expires_in: number; workspace_id: string }
          | { error: string }
          | null;

        if (!res.ok || !body || !("access_token" in body)) {
          return Response.json({ error: "core_refresh_failed", status: res.status, detail: body }, { status: 502 });
        }

        const headers = new Headers({ "content-type": "application/json" });
        headers.append("set-cookie", setCookie(CORE_ACCESS_COOKIE, body.access_token, body.expires_in));
        headers.append("set-cookie", setCookie(CORE_REFRESH_COOKIE, body.refresh_token, 30 * 24 * 60 * 60));
        return new Response(JSON.stringify({ workspace_id: body.workspace_id }), { status: 200, headers });
      },
    },
  },
});
