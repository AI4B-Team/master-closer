/**
 * Core integration layer (server-only).
 *
 * Core is the identity, tenancy and policy authority. This module is the single
 * place Master Closer reaches it from. Every helper fails closed: if Core is not
 * configured or not reachable, callers get an error — never a local substitute.
 *
 * Verified against the CORE API source:
 * - user JWTs are HS256, signed with CORE_SIGNING_SECRET
 * - claims: sub, account_id, legal_entity_id, workspace_id, app_id, role,
 *   entitlements[], iss, iat, exp
 * - entitlement state is carried in the `entitlements` claim and re-checked by
 *   Core on every /v1 call (assertWorkspaceScope); there is no standalone
 *   entitlement-check endpoint to call.
 */

import { createCoreClient, normalizeCoreBase, type CoreClient } from "./sdk";

export const CORE_APP_ID_DEFAULT = "master-closer";

export type CoreClaims = {
  sub: string;
  account_id: string;
  legal_entity_id: string;
  workspace_id: string;
  app_id: string;
  role: string;
  entitlements: string[];
  iss?: string;
  iat?: number;
  exp?: number;
};

export class CoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoreUnavailableError";
  }
}

export function coreConfig() {
  const rawApiUrl = process.env["CORE_API_URL"];
  const apiUrl = rawApiUrl ? normalizeCoreBase(rawApiUrl) : rawApiUrl;
  const authUrl = process.env["CORE_AUTH_URL"];
  const appId = process.env["CORE_APP_ID"] || CORE_APP_ID_DEFAULT;
  const serviceKey = process.env["CORE_SERVICE_KEY"];
  const signingSecret = process.env["CORE_SIGNING_SECRET"];
  return { apiUrl, authUrl, appId, serviceKey, signingSecret };
}

export function coreConfigStatus() {
  const c = coreConfig();
  return {
    appId: c.appId,
    apiUrl: Boolean(c.apiUrl),
    authUrl: Boolean(c.authUrl),
    serviceKey: Boolean(c.serviceKey),
    signingSecret: Boolean(c.signingSecret),
    configured: Boolean(c.apiUrl && c.authUrl && c.serviceKey && c.signingSecret),
  };
}

/** Service-credential client. Fails closed when Core is not configured. */
export function coreService(): CoreClient {
  const { apiUrl, serviceKey } = coreConfig();
  if (!apiUrl) throw new CoreUnavailableError("CORE_API_URL is not configured.");
  if (!serviceKey) throw new CoreUnavailableError("CORE_SERVICE_KEY is not configured.");
  return createCoreClient({ baseUrl: apiUrl, token: serviceKey });
}

/** Client acting as the signed-in user, using their Core access token. */
export function coreAsUser(accessToken: string): CoreClient {
  const { apiUrl } = coreConfig();
  if (!apiUrl) throw new CoreUnavailableError("CORE_API_URL is not configured.");
  return createCoreClient({ baseUrl: apiUrl, token: accessToken });
}

// ---------------------------------------------------------------- JWT (HS256)

const enc = new TextEncoder();

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const raw = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/** Verify a Core-issued access token. Returns null when invalid or expired. */
export async function verifyCoreToken(token: string): Promise<CoreClaims | null> {
  const { signingSecret } = coreConfig();
  if (!signingSecret) throw new CoreUnavailableError("CORE_SIGNING_SECRET is not configured.");

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, claims, sig] = parts as [string, string, string];

  let header: { alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(head))) as { alg?: string };
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;

  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(signingSecret),
    b64urlDecode(sig),
    enc.encode(`${head}.${claims}`),
  );
  if (!ok) return null;

  let payload: CoreClaims;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(claims))) as CoreClaims;
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.sub || !payload.workspace_id || !payload.legal_entity_id) return null;
  return payload;
}

// ------------------------------------------------------------------- Cookies

export const CORE_ACCESS_COOKIE = "mc_core_at";
export const CORE_REFRESH_COOKIE = "mc_core_rt";

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

// -------------------------------------------------------------- Entitlements

export type CoreSession = {
  claims: CoreClaims;
  accessToken: string;
  entitled: boolean;
};

/**
 * Resolve the Core session on an incoming request. Returns null when there is
 * no valid Core token; the caller decides whether that is fatal.
 */
export async function coreSession(request: Request): Promise<CoreSession | null> {
  const token = readCookie(request, CORE_ACCESS_COOKIE);
  if (!token) return null;
  const claims = await verifyCoreToken(token);
  if (!claims) return null;
  const { appId } = coreConfig();
  return {
    claims,
    accessToken: token,
    entitled: (claims.entitlements ?? []).includes(appId),
  };
}

/**
 * Entitlement gate. Core re-checks entitlement on every /v1 call, so this is a
 * fast local read of the signed claim, not a second source of truth.
 */
export async function requireCoreEntitlement(request: Request): Promise<CoreSession> {
  const session = await coreSession(request);
  if (!session) throw new Response("Core session required", { status: 401 });
  if (!session.entitled) throw new Response("App not entitled for this workspace", { status: 403 });
  return session;
}

/** Role check sourced from the Core JWT claim, never from a local table. */
export function coreHasRole(claims: CoreClaims, roles: string[]): boolean {
  return roles.includes(claims.role);
}
