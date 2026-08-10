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

/** Appends a version row for an agent prompt. Returns the new version number. */
export async function appendPromptVersion(
  supabase: any,
  args: {
    workspaceId: string;
    agentId: string;
    prompt: string;
    source: "manual" | "proposal" | "revert" | "seed";
    note?: string | null;
    proposalId?: string | null;
    userId?: string | null;
  },
) {
  const { data: last } = await supabase
    .from("agent_prompt_versions")
    .select("version, system_prompt")
    .eq("agent_id", args.agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.system_prompt === args.prompt) return { version: last.version as number, created: false };

  const version = (last?.version ?? 0) + 1;
  const { error } = await supabase.from("agent_prompt_versions").insert({
    workspace_id: args.workspaceId,
    agent_id: args.agentId,
    version,
    system_prompt: args.prompt,
    source: args.source,
    proposal_id: args.proposalId ?? null,
    note: args.note ?? null,
    created_by: args.userId ?? null,
  });
  if (error) throw new Error(error.message);
  return { version, created: true };
}

export const listPromptVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ agentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("agent_prompt_versions")
      .select("id, version, system_prompt, source, note, created_at, created_by")
      .eq("workspace_id", workspaceId)
      .eq("agent_id", data.agentId)
      .order("version", { ascending: false })
      .limit(30);
    return { versions: rows ?? [] };
  });

/** Records the prompt currently stored on the agent as a new version. */
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
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
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
    const workspaceId = await activeWorkspace(context.supabase, context.userId);
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
