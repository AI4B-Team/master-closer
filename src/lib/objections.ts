import { supabase } from "@/integrations/supabase/client";

export type ObjectionLibraryItem = { trigger: string; response: string };

/**
 * Loads the org's approved objection library (Playbook → Objections) so live AI
 * responses reuse approved language instead of inventing new lines.
 */
export async function fetchObjectionLibrary(wsId?: string | null, limit = 25): Promise<ObjectionLibraryItem[]> {
  let workspaceId = wsId ?? null;
  if (!workspaceId) {
    const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
    workspaceId = prof?.active_workspace_id ?? null;
  }
  if (!workspaceId) return [];
  const { data } = await supabase
    .from("objections")
    .select("trigger, response")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((o) => o.trigger && o.response)
    .map((o) => ({
      trigger: String(o.trigger).slice(0, 300),
      response: String(o.response).slice(0, 1200),
    }));
}
