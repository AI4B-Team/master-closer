// Real Elite hub federation helpers (server-only).
// Implements the shared App Family Platform Standards contract.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HubClaims = {
  reo_org_id: string;
  reo_user_id: string;
  email: string;
  name?: string;
  org_name?: string;
  role?: string;
  exp: number;
};

const enc = new TextEncoder();

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await hmacKey(secret);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
}

/** Verify the short-lived HS256 handoff JWT minted by Real Elite. */
export async function verifyHubToken(token: string): Promise<HubClaims> {
  const secret = process.env.HUB_SIGNING_SECRET;
  if (!secret) throw new Error("Hub linking is not configured on this app.");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid hub token.");
  const [h, p, s] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { alg?: string };
  } catch {
    throw new Error("Invalid hub token.");
  }
  if (header.alg !== "HS256") throw new Error("Invalid hub token algorithm.");

  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error("Invalid hub token signature.");

  let claims: HubClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as HubClaims;
  } catch {
    throw new Error("Invalid hub token.");
  }
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("Hub token expired.");
  if (!claims.reo_org_id || !claims.reo_user_id || !claims.email) throw new Error("Hub token is missing fields.");
  return claims;
}

/** Emit a standard family event and fan it out to enabled org webhooks. */
export async function emitEvent(
  orgId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  workspaceId?: string,
) {
  const [{ data: org }, { data: workspace }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("real_elite_org_id")
      .eq("id", orgId)
      .maybeSingle(),
    // Fallback only: events must carry the workspace that produced them, so
    // the workspace-scoped activity feeds show them in the right place.
    workspaceId
      ? Promise.resolve({ data: { id: workspaceId } })
      : supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("org_id", orgId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
  ]);

  // Never fall back to the org id here: it isn't a workspace, so the event
  // would be invisible to every workspace-scoped feed and report.
  const resolvedWorkspaceId = workspace?.id;
  if (!resolvedWorkspaceId) {
    throw new Error("Cannot record this event: no workspace could be resolved.");
  }

  const body = {
    ...payload,
    ...(org?.real_elite_org_id ? { real_elite_org_id: org.real_elite_org_id } : {}),
  };

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .insert({
      org_id: orgId,
      workspace_id: resolvedWorkspaceId,

      event_type: eventType,
      payload: body,
    })
    .select("id, org_id, workspace_id, event_type, payload, created_at")
    .single();
  if (error) throw error;

  await dispatchEvent(event);
  return event;
}

type EventRow = {
  id: string;
  org_id: string;
  workspace_id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

/**
 * POST one event to every enabled webhook for its workspace, with an HMAC
 * signature header. `skipHookIds` lets a retry pass leave endpoints that already
 * took this event alone, so a retry never double-delivers to a healthy endpoint.
 */
export async function dispatchEvent(event: EventRow, skipHookIds?: Set<string>) {
  // Webhooks are configured per workspace, so an event must only reach the
  // endpoints of the workspace that produced it — never sibling workspaces
  // in the same organization.
  const { data: all } = await supabaseAdmin
    .from("org_webhooks")
    .select("id, url, secret")
    .eq("org_id", event.org_id)
    .eq("workspace_id", event.workspace_id)
    .eq("enabled", true);

  const hooks = (all ?? []).filter((h) => !skipHookIds?.has(h.id));

  if (!hooks.length) return 0;


  const body = JSON.stringify({
    id: event.id,
    event_type: event.event_type,
    created_at: event.created_at,
    payload: event.payload,
  });

  let delivered = 0;
  for (const hook of hooks) {
    let status: number | null = null;
    let errorText: string | null = null;
    try {
      const signature = await hmacHex(hook.secret, body);
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-app": "master-closer",
          "x-app-event": event.event_type,
          "x-webhook-signature": signature,
        },
        body,
      });
      status = res.status;
      if (res.ok) delivered++;
    } catch (e) {
      errorText = e instanceof Error ? e.message : String(e);
    }
    await supabaseAdmin
      .from("webhook_deliveries")
      .upsert(
        {
          event_id: event.id,
          webhook_id: hook.id,
          workspace_id: event.workspace_id,
          status_code: status,
          error: errorText,
        },
        { onConflict: "event_id,webhook_id" },
      );
  }
  return delivered;
}

/**
 * Retry/backfill: re-deliver events that still have an endpoint waiting on them.
 *
 * Two things keep this queue from jamming. It only looks at workspaces that
 * actually have an enabled webhook — otherwise the oldest events in a workspace
 * with no endpoints (which never get a delivery row) would fill every page
 * forever and nothing new would ever be retried. And success is tracked per
 * endpoint, so one failing endpoint out of two still gets retried while the
 * healthy one is not sent a duplicate.
 */
export async function dispatchPending(limit = 100, sinceDays = 7) {
  const { data: hooks } = await supabaseAdmin
    .from("org_webhooks")
    .select("id, workspace_id")
    .eq("enabled", true);

  const hookIdsByWorkspace = new Map<string, string[]>();
  for (const h of hooks ?? []) {
    if (!h.workspace_id) continue;
    const list = hookIdsByWorkspace.get(h.workspace_id) ?? [];
    list.push(h.id);
    hookIdsByWorkspace.set(h.workspace_id, list);
  }
  if (hookIdsByWorkspace.size === 0) return { events: 0, delivered: 0 };

  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, org_id, workspace_id, event_type, payload, created_at")
    .in("workspace_id", [...hookIdsByWorkspace.keys()])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!events?.length) return { events: 0, delivered: 0 };

  const { data: done } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("event_id, webhook_id, status_code")
    .in(
      "event_id",
      events.map((e) => e.id),
    );

  // event id -> endpoints that already accepted it.
  const okByEvent = new Map<string, Set<string>>();
  for (const d of done ?? []) {
    if (!d.status_code || d.status_code >= 300) continue;
    const set = okByEvent.get(d.event_id) ?? new Set<string>();
    set.add(d.webhook_id);
    okByEvent.set(d.event_id, set);
  }

  let delivered = 0;
  let processed = 0;
  for (const event of events) {
    const wsHooks = event.workspace_id ? hookIdsByWorkspace.get(event.workspace_id) ?? [] : [];
    const okHooks = okByEvent.get(event.id) ?? new Set<string>();
    if (wsHooks.length === 0 || wsHooks.every((id) => okHooks.has(id))) continue;
    processed++;
    delivered += await dispatchEvent(event, okHooks);
  }
  return { events: processed, delivered };
}

