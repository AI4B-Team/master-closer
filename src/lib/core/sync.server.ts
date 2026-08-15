/**
 * Scheduled Core suppression mirroring (server-only).
 *
 * Every workspace bound to a Core tenant gets Core's shared opt-outs copied into
 * its local Do Not Call list, so local rules agree with Core even when Core is
 * unreachable at dial time. Runs unattended, so one failing workspace must never
 * stop the rest.
 */

/**
 * Writes the mirror outcome into the workspace's own event feed so operators can
 * see the unattended job in the Activity Log. Never throws: a logging failure
 * must not abort the sweep.
 */
async function logSyncEvent(
  supabase: any,
  ws: { id: string; org_id: unknown },
  payload: Record<string, unknown>,
) {
  try {
    await supabase.from("events").insert({
      org_id: ws.org_id as string,
      workspace_id: ws.id,
      event_type: "job.completed",
      payload,
    });
  } catch {
    /* non-blocking */
  }
}

export type WorkspaceSyncResult = {
  workspaceId: string;
  name: string;
  status: "ok" | "error";
  mirrored?: number;
  added?: number;
  removed?: number;
  contactsSuppressed?: number;
  contactsReleased?: number;
  reason?: string;
};


export async function syncAllCoreSuppressions(): Promise<{
  workspaces: number;
  synced: number;
  failed: number;
  added: number;
  contactsSuppressed: number;
  results: WorkspaceSyncResult[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { mirrorSuppressions } = await import("./screening.server");

  const { data: linked, error } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, org_id, core_workspace_id")
    .not("core_workspace_id", "is", null);
  if (error) throw new Error(error.message);

  const results: WorkspaceSyncResult[] = [];
  let added = 0;
  let contactsSuppressed = 0;

  for (const ws of linked ?? []) {
    try {
      const out = await mirrorSuppressions({
        supabase: supabaseAdmin,
        workspaceId: ws.id,
        orgId: ws.org_id as string,
        coreWorkspaceId: ws.core_workspace_id as string,
      });
      added += out.added;
      contactsSuppressed += out.contactsSuppressed;
      results.push({ workspaceId: ws.id, name: ws.name, status: "ok", ...out });
      await logSyncEvent(supabaseAdmin, ws, {
        kind: "core.suppressions_synced",
        mirrored: out.mirrored,
        added: out.added,
        contacts_suppressed: out.contactsSuppressed,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Core unavailable";
      results.push({ workspaceId: ws.id, name: ws.name, status: "error", reason });
      await logSyncEvent(supabaseAdmin, ws, { kind: "core.suppression_sync_failed", reason });
    }
  }

  return {
    workspaces: (linked ?? []).length,
    synced: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status === "error").length,
    added,
    contactsSuppressed,
    results,
  };
}
