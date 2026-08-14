/**
 * Core tenancy resolution (server-only).
 *
 * Master Closer workspaces are local records; Core owns the tenant. A workspace
 * is "governed" once it carries a core_workspace_id. Until then Core is not the
 * authority for that workspace and policy calls are reported as unlinked rather
 * than faked — there is no local substitute for a Core decision.
 */

export type CoreLink = {
  workspaceId: string;
  coreWorkspaceId: string;
  coreLegalEntityId: string | null;
  linkedAt: string | null;
};

/** Reads the caller's active workspace and its Core linkage. */
export async function resolveCoreLink(
  supabase: any,
  userId: string,
): Promise<{ workspaceId: string; orgId: string; link: CoreLink | null }> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.active_workspace_id) throw new Error("No active workspace for this user.");

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, core_workspace_id, core_legal_entity_id, core_linked_at")
    .eq("id", prof.active_workspace_id)
    .maybeSingle();

  const link: CoreLink | null = ws?.core_workspace_id
    ? {
        workspaceId: ws.id as string,
        coreWorkspaceId: ws.core_workspace_id as string,
        coreLegalEntityId: (ws.core_legal_entity_id as string | null) ?? null,
        linkedAt: (ws.core_linked_at as string | null) ?? null,
      }
    : null;

  return { workspaceId: prof.active_workspace_id as string, orgId: prof.org_id as string, link };
}

/** E.164 for US/CA 10- and 11-digit input; passes through anything already prefixed. */
export function toE164(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
