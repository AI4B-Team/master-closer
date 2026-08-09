import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Creates a new workspace owned by the caller and switches them into it. */
export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof) throw new Error("No profile for the signed-in user.");

    const base = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${base || "workspace"}-${Math.random().toString(36).slice(2, 8)}`;

    const { data: ws, error } = await supabaseAdmin
      .from("workspaces")
      .insert({
        org_id: prof.org_id,
        owner_id: context.userId,
        name: data.name,
        slug,
        brand_color: "#CC0000",
        legal_business_name: data.name,
        timezone: "America/New_York",
      })
      .select("id, name, slug")
      .single();
    if (error || !ws) throw new Error(error?.message ?? "Could not create the workspace.");

    await supabaseAdmin
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: context.userId, role: "owner" });

    await supabaseAdmin
      .from("profiles")
      .update({ active_workspace_id: ws.id })
      .eq("id", context.userId);

    return { id: ws.id, name: ws.name, slug: ws.slug };
  });

/** Renames the caller's active workspace (owners and admins only). */
export const renameWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(2).max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertWorkspaceAdmin } = await import("./team.server");
    const { wsId } = await assertWorkspaceAdmin(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("workspaces")
      .update({ name: data.name })
      .eq("id", wsId);
    if (error) throw new Error(error.message);

    return { id: wsId, name: data.name };
  });

/** Leaves the active workspace. Owners must hand over ownership first. */
export const leaveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveWorkspace } = await import("./team.server");
    const { wsId, wsRole } = await resolveWorkspace(context.supabase, context.userId);
    if (wsRole === "owner") {
      throw new Error("Transfer ownership from Members before leaving this workspace.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mine } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId);
    const others = (mine ?? []).filter((m) => m.workspace_id !== wsId);
    if (others.length === 0) throw new Error("You cannot leave your only workspace.");

    await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", wsId)
      .eq("user_id", context.userId);
    await supabaseAdmin
      .from("profiles")
      .update({ active_workspace_id: others[0].workspace_id })
      .eq("id", context.userId);

    return { leftWorkspaceId: wsId, activeWorkspaceId: others[0].workspace_id };
  });

/** Permanently deletes the active workspace. Owner only, and never the last one. */
export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ confirmName: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { resolveWorkspace } = await import("./team.server");
    const { wsId, wsRole } = await resolveWorkspace(context.supabase, context.userId);
    if (wsRole !== "owner") throw new Error("Only the workspace owner can delete a workspace.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("id, name")
      .eq("id", wsId)
      .maybeSingle();
    if (!ws) throw new Error("That workspace no longer exists.");
    if (data.confirmName.trim() !== ws.name) {
      throw new Error("Type the workspace name exactly to confirm deletion.");
    }

    const { data: mine } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", context.userId);
    const others = (mine ?? []).filter((m) => m.workspace_id !== wsId);
    if (others.length === 0) throw new Error("You cannot delete your only workspace.");

    // Move everyone who was pointed at this workspace off it first.
    const { data: members } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", wsId);
    for (const m of members ?? []) {
      const { data: rest } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", m.user_id)
        .neq("workspace_id", wsId);
      await supabaseAdmin
        .from("profiles")
        .update({ active_workspace_id: rest?.[0]?.workspace_id ?? null })
        .eq("id", m.user_id)
        .eq("active_workspace_id", wsId);
    }

    const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", wsId);
    if (error) throw new Error(error.message);

    return { deletedWorkspaceId: wsId, activeWorkspaceId: others[0].workspace_id };
  });
