import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const FEEDBACK_CATEGORIES = [
  "Bug",
  "Feature Request",
  "Confusing",
  "Compliance",
  "Billing",
  "Something Else",
] as const;

/** Resolves the caller's workspace so feedback lands on the right org. */
export async function callerOrg(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  if (!data) throw new Error("No profile for the signed-in user.");
  return data.org_id as string;
}

export function polishPrompt(body: string, category: string | null) {
  return (
    `Rewrite this product feedback for a sales-AI platform so the team can act on it. ` +
    `Keep the author's meaning and voice, stay first person, be specific and calm, no flattery, no headings.\n` +
    (category ? `Category: ${category}\n` : "") +
    `Feedback: """${body}"""\n\n` +
    `Return only the rewritten feedback, under 120 words.`
  );
}
