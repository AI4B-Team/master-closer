import { supabase } from "@/integrations/supabase/client";

export type ObjectionLibraryItem = { trigger: string; response: string };

/**
 * Loads the org's approved objection library (Playbook → Objections) so live AI
 * responses reuse approved language instead of inventing new lines.
 */
export async function fetchObjectionLibrary(limit = 25): Promise<ObjectionLibraryItem[]> {
  const { data } = await supabase
    .from("objections")
    .select("trigger, response")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((o) => o.trigger && o.response)
    .map((o) => ({
      trigger: String(o.trigger).slice(0, 300),
      response: String(o.response).slice(0, 1200),
    }));
}
