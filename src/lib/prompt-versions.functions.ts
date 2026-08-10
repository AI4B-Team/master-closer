import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPromptVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { activeWorkspaceId } = await import("./prompt-versions.server");
    const workspaceId = await activeWorkspaceId(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("agent_prompt_versions")
      .select("id, version, system_prompt, source, note, created_at, created_by")
      .eq("workspace_id", workspaceId)
      .eq("agent_id", data.agentId)
      .order("version", { ascending: false })
      .limit(30);
    return { versions: rows ?? [] };
  });

/** Records the prompt a human just saved on a closer as a new version. */
export const recordPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        agentId: z.string().uuid(),
        prompt: z.string().max(20000),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { activeWorkspaceId, appendPromptVersion } = await import("./prompt-versions.server");
    const workspaceId = await activeWorkspaceId(context.supabase, context.userId);
    const { data: agent } = await context.supabase
      .from("agents")
      .select("id")
      .eq("id", data.agentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!agent) throw new Error("Closer not found in this workspace.");

    return appendPromptVersion(context.supabase, {
      workspaceId,
      agentId: data.agentId,
      prompt: data.prompt,
      source: "manual",
      note: data.note ?? null,
      userId: context.userId,
    });
  });

/** Restores an earlier prompt and logs the restore as its own version. */
export const revertPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { activeWorkspaceId, appendPromptVersion } = await import("./prompt-versions.server");
    const workspaceId = await activeWorkspaceId(context.supabase, context.userId);
    const { data: v } = await context.supabase
      .from("agent_prompt_versions")
      .select("id, agent_id, version, system_prompt")
      .eq("id", data.versionId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!v) throw new Error("Version not found.");

    const { error } = await context.supabase
      .from("agents")
      .update({ system_prompt: v.system_prompt })
      .eq("id", v.agent_id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);

    await appendPromptVersion(context.supabase, {
      workspaceId,
      agentId: v.agent_id,
      prompt: v.system_prompt,
      source: "revert",
      note: `Restored from version ${v.version}.`,
      userId: context.userId,
    });

    return { ok: true, restoredFrom: v.version as number };
  });
