import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TokenInput = z.object({ token: z.string().min(10) });

/**
 * Standalone hub handoff: verify the Real Elite token, resolve or provision the
 * org + user, then hand the browser a one-time credential to start a local session.
 */
export const hubSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TokenInput.parse(data))
  .handler(async ({ data }) => {
    const { verifyHubToken } = await import("./hub.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = await verifyHubToken(data.token);

    // 1) Existing linked profile → just sign in.
    const { data: linked } = await supabaseAdmin
      .from("profiles")
      .select("id, email, org_id")
      .eq("real_elite_user_id", claims.reo_user_id)
      .maybeSingle();

    let email = claims.email;

    if (!linked) {
      // 2) Does the hub org already exist here?
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("real_elite_org_id", claims.reo_org_id)
        .maybeSingle();

      // Existing local user with this email?
      const { data: existingByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id, org_id")
        .eq("email", claims.email)
        .maybeSingle();

      let userId = existingByEmail?.id ?? null;

      if (!userId) {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: claims.email,
          email_confirm: true,
          user_metadata: {
            full_name: claims.name ?? claims.email,
            org_name: claims.org_name ?? "Real Elite Workspace",
          },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message ?? "Could not provision the account.");
        }
        userId = created.data.user.id;
      }

      // The signup trigger always creates a fresh org. If the hub org already
      // exists locally, move the profile into it and drop the throwaway org.
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("org_id")
        .eq("id", userId)
        .maybeSingle();

      let orgId = org?.id ?? prof?.org_id ?? null;

      if (org?.id && prof?.org_id && prof.org_id !== org.id) {
        await supabaseAdmin.from("profiles").update({ org_id: org.id }).eq("id", userId);
        await supabaseAdmin.from("user_roles").update({ org_id: org.id }).eq("user_id", userId);
        await supabaseAdmin.from("organizations").delete().eq("id", prof.org_id);
        orgId = org.id;
      }

      if (!orgId) throw new Error("Could not resolve a workspace for this account.");

      // 3) Stamp the canonical ids.
      await supabaseAdmin
        .from("organizations")
        .update({
          real_elite_org_id: claims.reo_org_id,
          ...(claims.org_name ? { name: claims.org_name } : {}),
        })
        .eq("id", orgId)
        .is("real_elite_org_id", null);

      await supabaseAdmin
        .from("profiles")
        .update({ real_elite_user_id: claims.reo_user_id })
        .eq("id", userId)
        .is("real_elite_user_id", null);
    } else {
      email = linked.email ?? claims.email;
    }

    // Start a normal local session via a one-time email credential.
    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data.properties?.hashed_token) {
      throw new Error(link.error?.message ?? "Could not start a session.");
    }

    return { email, tokenHash: link.data.properties.hashed_token };
  });

/**
 * Account linking from Settings: stamp the canonical ids onto the CURRENT org
 * and profile. Never creates a duplicate org.
 */
export const hubLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TokenInput.parse(data))
  .handler(async ({ data, context }) => {
    const { verifyHubToken } = await import("./hub.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claims = await verifyHubToken(data.token);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("org_id, real_elite_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof) throw new Error("No profile for the signed-in user.");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, real_elite_org_id")
      .eq("id", prof.org_id)
      .maybeSingle();

    if (org?.real_elite_org_id && org.real_elite_org_id !== claims.reo_org_id) {
      throw new Error("This workspace is already connected to a different Real Elite organization.");
    }

    if (!org?.real_elite_org_id) {
      await supabaseAdmin
        .from("organizations")
        .update({ real_elite_org_id: claims.reo_org_id })
        .eq("id", prof.org_id)
        .is("real_elite_org_id", null);
    }

    if (!prof.real_elite_user_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ real_elite_user_id: claims.reo_user_id })
        .eq("id", context.userId)
        .is("real_elite_user_id", null);
    }

    return { orgId: prof.org_id, reoOrgId: claims.reo_org_id };
  });

/** Connection status for the Settings panel. */
export const hubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("real_elite_user_id, org_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: org } = prof
      ? await context.supabase
          .from("organizations")
          .select("name, real_elite_org_id")
          .eq("id", prof.org_id)
          .maybeSingle()
      : { data: null };

    return {
      connected: Boolean(org?.real_elite_org_id),
      orgName: org?.name ?? null,
      reoOrgId: org?.real_elite_org_id ?? null,
      reoUserId: prof?.real_elite_user_id ?? null,
    };
  });

/** Emit a standard family event for the caller's org (also fans out to webhooks). */
export const emitOrgEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        event_type: z.enum([
          "job.completed",
          "leads.new",
          "lead.flagged_dnc",
          "lead.flagged_litigator",
          "campaign.launched",
          "message.reply_received",
          "brand.approved",
          "credits.low",
        ]),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { emitEvent } = await import("./hub.server");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof) throw new Error("No profile for the signed-in user.");
    return emitEvent(prof.org_id, data.event_type, data.payload);
  });
