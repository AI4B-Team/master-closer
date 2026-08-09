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
export async function emitEvent(orgId: string, eventType: string, payload: Record<string, unknown> = {}) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("real_elite_org_id, active_workspace_id")
    .eq("id", orgId)
    .maybeSingle();

  const body = {
    ...payload,
    ...(org?.real_elite_org_id ? { real_elite_org_id: org.real_elite_org_id } : {}),
  };

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .insert({ org_id: orgId, event_type: eventType, payload: body })
    .select("id, org_id, active_workspace_id, event_type, payload, created_at")
    .single();
  if (error) throw error;

  await dispatchEvent(event);
  return event;
}

type EventRow = {
  id: string;
  org_id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

/** POST one event to every enabled webhook for its org, with an HMAC signature header. */
export async function dispatchEvent(event: EventRow) {
  const { data: hooks } = await supabaseAdmin
    .from("org_webhooks")
    .select("id, url, secret")
    .eq("org_id", event.org_id)
    .eq("enabled", true);

  if (!hooks?.length) return 0;

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
        { event_id: event.id, webhook_id: hook.id, status_code: status, error: errorText },
        { onConflict: "event_id,webhook_id" },
      );
  }
  return delivered;
}

/** Retry/backfill: deliver every event that has no successful delivery yet. */
export async function dispatchPending(limit = 100) {
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, org_id, active_workspace_id, event_type, payload, created_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!events?.length) return { events: 0, delivered: 0 };

  const { data: done } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("event_id, status_code")
    .in("event_id", events.map((e) => e.id));

  const ok = new Set(
    (done ?? []).filter((d) => d.status_code && d.status_code < 300).map((d) => d.event_id),
  );

  let delivered = 0;
  let processed = 0;
  for (const event of events) {
    if (ok.has(event.id)) continue;
    processed++;
    delivered += await dispatchEvent(event);
  }
  return { events: processed, delivered };
}
