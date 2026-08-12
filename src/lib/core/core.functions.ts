import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Client-safe read of the Core session (identity, workspace, role, entitlement).
 * Sourced entirely from the Core-signed JWT — never from a local table.
 */
export const getCoreSession = createServerFn({ method: "GET" }).handler(async () => {
  const { coreSession, coreConfigStatus } = await import("@/lib/core/core.server");
  const status = coreConfigStatus();
  if (!status.configured) {
    return { configured: false as const, status, session: null };
  }
  const request = getRequest();
  const session = await coreSession(request);
  return {
    configured: true as const,
    status,
    session: session
      ? {
          userId: session.claims.sub,
          workspaceId: session.claims.workspace_id,
          legalEntityId: session.claims.legal_entity_id,
          accountId: session.claims.account_id,
          role: session.claims.role,
          entitlements: session.claims.entitlements ?? [],
          entitled: session.entitled,
        }
      : null,
  };
});

/**
 * Connectivity + entitlement probe against the live Core instance, using the
 * app's service credential. Returns exactly what Core said — no optimistic
 * assumptions, no local fallback.
 */
export const checkCoreConnectivity = createServerFn({ method: "POST" }).handler(async () => {
  const { coreConfig, coreService, CoreUnavailableError } = await import("@/lib/core/core.server");
  const { CoreApiError } = await import("@/lib/core/sdk");
  const { appId } = coreConfig();

  try {
    const core = coreService();
    const { workspaces } = await core.workspaces();
    return {
      ok: true as const,
      appId,
      entitledWorkspaces: workspaces.length,
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name, status: w.status ?? null })),
    };
  } catch (e) {
    if (e instanceof CoreUnavailableError) {
      return { ok: false as const, appId, reason: "not_configured", detail: e.message };
    }
    if (e instanceof CoreApiError) {
      return { ok: false as const, appId, reason: `core_${e.status}`, detail: JSON.stringify(e.body) };
    }
    return { ok: false as const, appId, reason: "unreachable", detail: e instanceof Error ? e.message : "unknown" };
  }
});
