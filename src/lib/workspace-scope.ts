/**
 * Shared scope helpers for server functions.
 *
 * These live outside the *.functions.ts modules on purpose: the server-function
 * bundler splits those files and only keeps the exported createServerFn
 * declarations, so runtime helpers defined alongside them can disappear and
 * blow up with a ReferenceError at call time. Imported modules survive.
 *
 * Every helper takes an already-scoped Supabase client, so nothing here is
 * server-only and the module is safe in any bundle.
 */

/** Active workspace of the caller, or a hard error when none is set. */
export async function activeWorkspace(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return data.active_workspace_id as string;
}

/** Org + workspace of the caller, for writes that need both. */
export async function callerScope(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return { orgId: data.org_id as string, workspaceId: data.active_workspace_id as string };
}

/**
 * Server-side twin of logActivity: governance decisions are audit-relevant, so
 * they are written from the handler rather than trusted to the browser.
 */
export async function logGovernance(
  supabase: any,
  scope: { orgId: string; workspaceId: string },
  kind: string,
  payload: Record<string, unknown> = {},
) {
  try {
    await supabase.from("events").insert({
      org_id: scope.orgId,
      workspace_id: scope.workspaceId,
      event_type: "job.completed",
      payload: { kind, ...payload },
    });
  } catch {
    /* non-blocking */
  }
}
