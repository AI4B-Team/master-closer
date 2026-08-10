import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function activeWorkspace(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return data.active_workspace_id as string;
}

/** Dated snapshots for one closer profile, newest first. */
export const listProfileVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("closer_profile_versions")
      .select("id, version, snapshot, source, note, created_at, created_by")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", data.profileId)
      .order("version", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { versions: rows ?? [] };
  });

/** Puts an earlier snapshot back in force, recording the restore as its own version. */
export const restoreProfileVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { appendProfileVersion, PROFILE_SNAPSHOT_SELECT, toSnapshot } = await import(
      "./profile-versions.server"
    );
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const { data: version } = await context.supabase
      .from("closer_profile_versions")
      .select("id, profile_id, version, snapshot")
      .eq("id", data.versionId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!version) throw new Error("That version is no longer available.");

    const { data: current } = await context.supabase
      .from("closer_profiles")
      .select(PROFILE_SNAPSHOT_SELECT)
      .eq("id", version.profile_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!current) throw new Error("This profile no longer exists in your workspace.");

    // Keep the copy that is live right now so a restore is itself reversible.
    await appendProfileVersion(context.supabase, {
      workspaceId,
      profileId: version.profile_id,
      snapshot: toSnapshot(current),
      source: "seed",
      note: `Copy in use before version ${version.version} was restored.`,
      userId: context.userId,
    });

    const snapshot = toSnapshot(version.snapshot as Record<string, any>);
    if (snapshot.is_default) {
      await context.supabase
        .from("closer_profiles")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId);
    }

    const { error } = await context.supabase
      .from("closer_profiles")
      .update(snapshot as never)
      .eq("id", version.profile_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);

    await appendProfileVersion(context.supabase, {
      workspaceId,
      profileId: version.profile_id,
      snapshot,
      source: "restore",
      note: `Restored from version ${version.version}.`,
      userId: context.userId,
    });

    return { profileId: version.profile_id as string, restoredFrom: version.version as number };
  });
