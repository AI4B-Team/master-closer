import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Confirms the caller is an admin of their own workspace and returns that org id. */
export async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ orgId: string }> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) throw new Error("No profile for the signed-in user.");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", prof.org_id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Only workspace admins can manage members.");

  return { orgId: prof.org_id };
}

/**
 * Resolves the caller's active workspace and their role inside it.
 * Membership management requires owner/admin on that workspace.
 */
export async function assertWorkspaceAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ orgId: string; wsId: string; wsRole: string }> {
  const ctx = await resolveWorkspace(supabase, userId);
  if (ctx.wsRole !== "owner" && ctx.wsRole !== "admin") {
    throw new Error("Only workspace owners and admins can manage members.");
  }
  return ctx;
}

export async function resolveWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ orgId: string; wsId: string; wsRole: string }> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) throw new Error("No profile for the signed-in user.");
  if (!prof.active_workspace_id) throw new Error("No active workspace selected.");

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", prof.active_workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("You are not a member of the active workspace.");

  return { orgId: prof.org_id, wsId: prof.active_workspace_id, wsRole: member.role };
}
