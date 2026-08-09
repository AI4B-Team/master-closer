import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleSchema = z.enum(["admin", "manager", "rep"]);

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveWorkspace } = await import("./team.server");
    const { orgId, wsId, wsRole } = await resolveWorkspace(context.supabase, context.userId);

    const [{ data: members }, { data: roles }] = await Promise.all([
      context.supabase
        .from("workspace_members")
        .select("user_id, role, created_at, profiles:user_id(id, email, full_name, avatar_url)")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: true }),
      context.supabase.from("user_roles").select("user_id, role").eq("org_id", orgId),
    ]);

    const orgRoleFor = (id: string) => roles?.find((r) => r.user_id === id)?.role ?? "rep";
    const isAdmin = wsRole === "owner" || wsRole === "admin";

    return {
      orgId,
      workspaceId: wsId,
      myRole: orgRoleFor(context.userId),
      workspaceRole: wsRole,
      isAdmin,
      members: (members ?? []).map((m: any) => ({
        id: m.user_id as string,
        email: m.profiles?.email ?? null,
        fullName: m.profiles?.full_name ?? null,
        avatarUrl: m.profiles?.avatar_url ?? null,
        joinedAt: m.created_at as string,
        role: orgRoleFor(m.user_id),
        workspaceRole: m.role as string,
        isSelf: m.user_id === context.userId,
      })),
    };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), role: RoleSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./team.server");
    const { orgId } = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, org_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.org_id !== orgId) throw new Error("That member is not in this workspace.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("org_id", orgId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, org_id: orgId, role: data.role });
    if (error) throw new Error(error.message);

    return { userId: data.userId, role: data.role };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email(), role: RoleSchema, fullName: z.string().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertWorkspaceAdmin } = await import("./team.server");
    const { orgId, wsId } = await assertWorkspaceAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, org_id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      const { data: already } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", wsId)
        .eq("user_id", existing.id)
        .maybeSingle();
      if (already) throw new Error("That person is already in this workspace.");

      await supabaseAdmin
        .from("workspace_members")
        .insert({ workspace_id: wsId, user_id: existing.id, role: data.role === "admin" ? "admin" : "member" });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", existing.id).eq("org_id", orgId);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: existing.id, org_id: orgId, role: data.role });

      return { userId: existing.id, email, role: data.role, added: true };
    }

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: data.fullName || email.split("@")[0],
        invited_org_id: orgId,
        invited_workspace_id: wsId,
      },
    });
    if (invited.error || !invited.data.user) {
      throw new Error(invited.error?.message ?? "Could not send the invite.");
    }
    const userId = invited.data.user.id;

    // The signup trigger always spins up a fresh org — fold the new profile into ours.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({ org_id: orgId, active_workspace_id: wsId })
      .eq("id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, org_id: orgId, role: data.role });
    await supabaseAdmin
      .from("workspace_members")
      .insert({ workspace_id: wsId, user_id: userId, role: data.role === "admin" ? "admin" : "member" });

    // The signup trigger spins up a throwaway org/workspace — clean it up.
    if (prof?.org_id && prof.org_id !== orgId) {
      await supabaseAdmin.from("workspaces").delete().eq("org_id", prof.org_id);
      await supabaseAdmin.from("organizations").delete().eq("id", prof.org_id);
    }

    return { userId, email, role: data.role, added: false };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspaceAdmin } = await import("./team.server");
    const { orgId, wsId } = await assertWorkspaceAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", wsId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!membership) throw new Error("That member is not in this workspace.");
    if (membership.role === "owner") throw new Error("You cannot remove the workspace owner.");

    const { error } = await supabaseAdmin.from("workspace_members").delete().eq("id", membership.id);
    if (error) throw new Error(error.message);

    // No workspaces left in this org for them — drop the org role and the account.
    const { data: remaining } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", data.userId);
    if (!remaining || remaining.length === 0) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("org_id", orgId);
      await supabaseAdmin.auth.admin.deleteUser(data.userId);
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({ active_workspace_id: remaining[0].workspace_id })
        .eq("id", data.userId)
        .eq("active_workspace_id", wsId);
    }

    return { userId: data.userId };
  });

const WsRoleSchema = z.enum(["owner", "admin", "member"]);

/** Changes a teammate's access level inside the caller's active workspace. */
export const setWorkspaceRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), role: WsRoleSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertWorkspaceAdmin } = await import("./team.server");
    const { wsId, wsRole } = await assertWorkspaceAdmin(context.supabase, context.userId);
    if (data.role === "owner" && wsRole !== "owner") {
      throw new Error("Only the workspace owner can hand over ownership.");
    }
    if (data.userId === context.userId) throw new Error("You cannot change your own access.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", wsId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!membership) throw new Error("That member is not in this workspace.");
    if (membership.role === "owner") throw new Error("The workspace owner's access cannot be changed.");

    const { error } = await supabaseAdmin
      .from("workspace_members")
      .update({ role: data.role })
      .eq("id", membership.id);
    if (error) throw new Error(error.message);

    // Ownership transfer moves the workspace owner_id too.
    if (data.role === "owner") {
      await supabaseAdmin.from("workspaces").update({ owner_id: data.userId }).eq("id", wsId);
      await supabaseAdmin
        .from("workspace_members")
        .update({ role: "admin" })
        .eq("workspace_id", wsId)
        .eq("user_id", context.userId);
    }

    return { userId: data.userId, role: data.role };
  });
