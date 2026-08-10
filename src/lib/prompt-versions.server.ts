/** Server-only helpers for agent prompt versioning. */

export async function activeWorkspaceId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("No active workspace for this user.");
  return data.active_workspace_id as string;
}

/** Appends a version row for an agent prompt. Returns the resulting version number. */
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
