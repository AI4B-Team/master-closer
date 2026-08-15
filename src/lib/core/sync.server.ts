/**
 * Scheduled Core suppression mirroring (server-only).
 *
 * Every workspace bound to a Core tenant gets Core's shared opt-outs copied into
 * its local Do Not Call list, so local rules agree with Core even when Core is
 * unreachable at dial time. Runs unattended, so one failing workspace must never
 * stop the rest.
 */

export type WorkspaceSyncResult = {
  workspaceId: string;
  name: string;
  status: "ok" | "error";
  mirrored?: number;
  added?: number;
  contactsSuppressed?: number;
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
    } catch (e) {
      results.push({
        workspaceId: ws.id,
        name: ws.name,
        status: "error",
        reason: e instanceof Error ? e.message : "Core unavailable",
      });
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
