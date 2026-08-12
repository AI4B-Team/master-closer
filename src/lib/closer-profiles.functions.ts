import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT =
  "id, workspace_id, industry, source, name, is_default, opener, context_framing, objections, screening_questions, faqs, tone, escalation_triggers, banned_topics, dispositions, default_campaign_id, updated_at";

const ObjectionSchema = z.object({
  trigger: z.string().trim().min(1).max(300),
  approved_response: z.string().trim().min(1).max(1200),
});

const ProfileInput = z.object({
  id: z.string().uuid().nullish(),
  industry: z.string().trim().max(60).nullish(),
  source: z.string().trim().max(60).nullish(),
  name: z.string().trim().min(2).max(120),
  is_default: z.boolean().default(false),
  opener: z.string().trim().min(5).max(2000),
  context_framing: z.string().trim().max(2000).nullish(),
  objections: z.array(ObjectionSchema).max(60).default([]),
  screening_questions: z.array(z.string().trim().min(1).max(300)).max(40).default([]),
  faqs: z.array(z.string().trim().min(1).max(600)).max(60).default([]),
  tone: z.string().trim().max(300).nullish(),
  escalation_triggers: z.array(z.string().trim().min(1).max(160)).max(60).default([]),
  banned_topics: z.array(z.string().trim().min(1).max(160)).max(60).default([]),
  dispositions: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
});

async function activeWorkspace(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return data.active_workspace_id as string;
}

/** Workspace profiles plus the platform defaults they inherit from. */
export const listCloserProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const [{ data: mine }, { data: platform }] = await Promise.all([
      context.supabase
        .from("closer_profiles")
        .select(SELECT)
        .eq("workspace_id", workspaceId)
        .order("industry", { ascending: true }),
      context.supabase
        .from("closer_profiles")
        .select(SELECT)
        .is("workspace_id", null)
        .order("industry", { ascending: true }),
    ]);
    return { workspaceId, profiles: mine ?? [], platform: platform ?? [] };
  });

/** Creates or updates a workspace profile. Platform defaults are read-only. */
export const saveCloserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { appendProfileVersion, PROFILE_SNAPSHOT_SELECT, toSnapshot } = await import(
      "./profile-versions.server"
    );
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const row = {
      workspace_id: workspaceId,
      industry: data.industry || null,
      source: data.source || null,
      name: data.name,
      is_default: data.is_default,
      opener: data.opener,
      context_framing: data.context_framing || null,
      objections: data.objections,
      screening_questions: data.screening_questions,
      faqs: data.faqs,
      tone: data.tone || null,
      escalation_triggers: data.escalation_triggers,
      banned_topics: data.banned_topics,
      dispositions: data.dispositions,
    };

    if (data.is_default) {
      await context.supabase
        .from("closer_profiles")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId);
    }

    if (data.id) {
      // Snapshot the copy being replaced first, so an edit is always reversible.
      const { data: before } = await context.supabase
        .from("closer_profiles")
        .select(PROFILE_SNAPSHOT_SELECT)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (before) {
        await appendProfileVersion(context.supabase, {
          workspaceId,
          profileId: data.id,
          snapshot: toSnapshot(before),
          source: "seed",
          note: "Copy in use before this edit.",
          userId: context.userId,
        });
      }

      const { error } = await context.supabase
        .from("closer_profiles")
        .update(row)
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);

      await appendProfileVersion(context.supabase, {
        workspaceId,
        profileId: data.id,
        snapshot: toSnapshot(row),
        source: "manual",
        note: "Saved from the Closer Profiles editor.",
        userId: context.userId,
      });
      return { id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("closer_profiles")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        throw new Error("A profile already covers that industry and source. Edit it instead.");
      }
      throw new Error(error.message);
    }
    if (inserted?.id) {
      await appendProfileVersion(context.supabase, {
        workspaceId,
        profileId: inserted.id,
        snapshot: toSnapshot(row),
        source: "manual",
        note: "Profile created.",
        userId: context.userId,
      });
    }
    return { id: inserted?.id as string };
  });


export const deleteCloserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("closer_profiles")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copies any profile (including a platform default) into this workspace under a new industry. */
export const duplicateCloserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sourceId: z.string().uuid(),
        industry: z.string().trim().min(2).max(60),
        source: z.string().trim().max(60).nullish(),
        name: z.string().trim().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const { data: src } = await context.supabase
      .from("closer_profiles")
      .select(SELECT)
      .eq("id", data.sourceId)
      // Only this workspace's profiles or the platform defaults may be copied.
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .maybeSingle();
    if (!src) throw new Error("That profile is no longer available.");

    const { data: inserted, error } = await context.supabase
      .from("closer_profiles")
      .insert({
        workspace_id: workspaceId,
        industry: data.industry,
        source: data.source || null,
        name: data.name,
        is_default: false,
        opener: src.opener,
        context_framing: src.context_framing,
        objections: src.objections,
        screening_questions: src.screening_questions,
        faqs: src.faqs,
        tone: src.tone,
        escalation_triggers: src.escalation_triggers,
        banned_topics: src.banned_topics,
        dispositions: src.dispositions,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        throw new Error("This workspace already has a profile for that industry and source.");
      }
      throw new Error(error.message);
    }
    return { id: inserted?.id as string };
  });

/** Which profile a lead resolves to, and the prompt that gets assembled for it. */
export const resolveProfileForLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const engine = await import("./closer-profiles");
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const [{ data: lead }, { data: mine }, { data: platform }] = await Promise.all([
      context.supabase
        .from("leads")
        .select("id, name, company, status, source, industry, timezone, notes, consent")
        .eq("id", data.leadId)
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      context.supabase.from("closer_profiles").select(SELECT).eq("workspace_id", workspaceId),
      context.supabase.from("closer_profiles").select(SELECT).is("workspace_id", null),
    ]);
    if (!lead) throw new Error("Lead not found.");

    try {
      const { profile, matchedBy } = engine.resolveCloserProfile(
        [...(mine ?? []), ...(platform ?? [])] as never,
        { industry: lead.industry, source: lead.source },
      );
      return {
        ok: true as const,
        profileId: profile.id,
        profileName: profile.name,
        industry: profile.industry,
        isPlatformDefault: profile.workspace_id === null,
        matchedBy,
        matchedLabel: engine.RESOLUTION_LABEL[matchedBy],
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

/** Renders the assembled system prompt for a profile so an operator can read it. */
export const previewAssembledPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        profileId: z.string().uuid(),
        mode: z.enum(["full_ai", "hybrid", "copilot"]).default("hybrid"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const engine = await import("./closer-profiles");
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const [{ data: profile }, { data: ws }] = await Promise.all([
      context.supabase
        .from("closer_profiles")
        .select(SELECT)
        .eq("id", data.profileId)
        .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
        .maybeSingle(),
      context.supabase
        .from("workspaces")
        .select("name, legal_business_name, business_state")
        .eq("id", workspaceId)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("Profile not found.");

    return {
      prompt: engine.assembleSystemPrompt({
        profile: profile as never,
        workspace: ws ?? undefined,
        lead: {
          name: "Sample Prospect",
          company: "Northbridge Systems",
          status: "new",
          industry: profile.industry,
          source: profile.source,
        },
        mode: data.mode,
      }),
    };
  });

/**
 * Train From URL — governed. Reads a public page and drafts profile copy.
 * The draft is returned for review; it is never written live on its own.
 */
export const draftProfileFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        url: z.string().url().max(500),
        industry: z.string().trim().min(2).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on this workspace.");
    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    let pageText = "";
    try {
      const res = await fetch(data.url, {
        headers: { "user-agent": "MasterCloser/1.0 (+profile-draft)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`The page returned ${res.status}.`);
      const html = await res.text();
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000);
    } catch (e) {
      throw new Error(`Could not read that page: ${(e as Error).message}`);
    }
    if (pageText.length < 200) throw new Error("That page had too little readable text to learn from.");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3.6-flash"),
      prompt:
        `You draft closer profiles for a sales calling platform. Industry: ${data.industry}.\n` +
        `Source material from the business's own website:\n"""\n${pageText}\n"""\n\n` +
        `Return ONLY JSON, no fences, shaped:\n` +
        `{"name":"...","opener":"...","context_framing":"...","tone":"...","faqs":["..."],"screening_questions":["..."],"objections":[{"trigger":"...","approved_response":"..."}]}\n` +
        `Rules: opener is one or two spoken sentences using {{first_name}}, {{agent_name}} and {{business_name}} placeholders. ` +
        `Five objections in the prospect's own voice with the exact words a closer says back. Three to six FAQs, each a question and its answer in one line. ` +
        `Only claim things the source material supports. Never guarantee savings, approval or results. Never claim to be licensed.`,
      maxOutputTokens: 1800,
      temperature: 0.5,
      providerOptions: { lovable: { reasoning: { enabled: false } } },
    });

    const cleaned = text.replace(/```[a-z]*|```/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    let parsed: unknown;
    try {
      parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    } catch {
      throw new Error("The draft came back in an unexpected format. Try again.");
    }

    const draft = z
      .object({
        name: z.string().max(120).default("Drafted Closer"),
        opener: z.string().max(2000),
        context_framing: z.string().max(2000).nullish(),
        tone: z.string().max(300).nullish(),
        faqs: z.array(z.string().max(600)).max(12).default([]),
        screening_questions: z.array(z.string().max(300)).max(12).default([]),
        objections: z.array(ObjectionSchema).max(12).default([]),
      })
      .parse(parsed);

    return { draft, status: "pending_review" as const };
  });

/**
 * Call-time entry point for the horizontal engine: resolve the closer that owns
 * this call, then hand back the assembled brief plus the approved objection
 * lines so the live dialer speaks the same words the Studio previews.
 */
export const assemblePromptForCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        industry: z.string().trim().max(60).nullish(),
        source: z.string().trim().max(60).nullish(),
        leadName: z.string().trim().max(160).nullish(),
        mode: z.enum(["full_ai", "hybrid", "copilot"]).default("hybrid"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const engine = await import("./closer-profiles");
    const workspaceId = await activeWorkspace(context.supabase, context.userId);

    const [{ data: mine }, { data: platform }, { data: ws }, { data: disc }] = await Promise.all([
      context.supabase.from("closer_profiles").select(SELECT).eq("workspace_id", workspaceId),
      context.supabase.from("closer_profiles").select(SELECT).is("workspace_id", null),
      context.supabase
        .from("workspaces")
        .select("name, legal_business_name, business_state")
        .eq("id", workspaceId)
        .maybeSingle(),
      context.supabase
        .from("disclosure_settings")
        .select("script")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    try {
      const { profile, matchedBy } = engine.resolveCloserProfile(
        [...(mine ?? []), ...(platform ?? [])] as never,
        { industry: data.industry ?? null, source: data.source ?? null },
      );
      return {
        ok: true as const,
        profileId: profile.id,
        profileName: profile.name,
        matchedBy,
        matchedLabel: engine.RESOLUTION_LABEL[matchedBy],
        isPlatformDefault: profile.workspace_id === null,
        prompt: engine.assembleSystemPrompt({
          profile: profile as never,
          workspace: ws ?? undefined,
          lead: {
            name: data.leadName ?? undefined,
            industry: data.industry ?? profile.industry,
            source: data.source ?? profile.source,
          } as never,
          mode: data.mode,
          disclosure: disc?.script ?? null,
        }),
        objections: (profile.objections ?? []).map((o: any) => ({
          trigger: o.trigger,
          response: o.approved_response,
        })),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });
