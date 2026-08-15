import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Shared helper for the authenticated /api/v1 surface. Every meaningful UI action
 * is also callable over HTTP with a bearer token, so Real Elite can consume it.
 */
export async function apiClient(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Response("Backend not configured", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.split(".").length !== 3) throw new Response("Unauthorized", { status: 401 });

  const supabase = createClient<Database>(url, key, {
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", key);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Response("Unauthorized", { status: 401 });

  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", data.claims.sub as string)
    .maybeSingle();
  if (!prof) throw new Response("No workspace for this user", { status: 403 });
  if (!prof.active_workspace_id) throw new Response("No active workspace", { status: 403 });

  // The profile pointer can outlive the membership row, so re-check it here the
  // same way the server-function path does before trusting the workspace.
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", prof.active_workspace_id)
    .eq("user_id", data.claims.sub as string)
    .maybeSingle();
  if (!member) throw new Response("Not a member of the active workspace", { status: 403 });

  return { supabase, userId: data.claims.sub as string, orgId: prof.org_id, workspaceId: prof.active_workspace_id };
}

export function apiError(e: unknown) {
  if (e instanceof Response) return e;
  return Response.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
}

/**
 * Parses a `limit` query param defensively: junk, empty, zero, and negative
 * values fall back to the default instead of producing a NaN row limit.
 */
export function parseLimit(raw: string | null, fallback = 100, max = 500) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}
