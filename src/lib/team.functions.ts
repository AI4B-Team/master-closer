import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleSchema = z.enum(["admin", "manager", "rep"]);

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("No profile for the signed-in user.");

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, created_at")
        .eq("org_id", me.org_id)
        .order("created_at", { ascending: true }),
      context.supabase.from("user_roles").select("user_id, role").eq("org_id", me.org_id),
    ]);

    const roleFor = (id: string) => roles?.find((r) => r.user_id === id)?.role ?? "rep";
    const myRole = roleFor(context.userId);

    return {
      orgId: me.org_id,
      myRole,
      isAdmin: myRole === "admin",
      members: (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        avatarUrl: p.avatar_url,
        joinedAt: p.created_at,
        role: roleFor(p.id),
        isSelf: p.id === context.userId,
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
    const { assertAdmin } = await import("./team.server");
    const { orgId } = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, org_id")
      .eq("email", email)
      .maybeSingle();
    if (existing && existing.org_id === orgId) {
      throw new Error("That person is already in this workspace.");
    }
    if (existing) throw new Error("That email already belongs to another workspace.");

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: data.fullName || email.split("@")[0], invited_org_id: orgId },
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

    await supabaseAdmin.from("profiles").update({ org_id: orgId }).eq("id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, org_id: orgId, role: data.role });
    if (prof?.org_id && prof.org_id !== orgId) {
      await supabaseAdmin.from("organizations").delete().eq("id", prof.org_id);
    }

    return { userId, email, role: data.role };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./team.server");
    const { orgId } = await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, org_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.org_id !== orgId) throw new Error("That member is not in this workspace.");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { userId: data.userId };
  });
