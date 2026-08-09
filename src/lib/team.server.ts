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
