import { supabase } from "@/integrations/supabase/client";
import { phoneKey } from "@/lib/phone";

/**
 * Mirrors a local opt-out onto the contact record.
 *
 * The Do Not Call list is keyed by phone number, but nomination, worklist and
 * lead-line logic reads `contacts.suppressed`. Without this, a number added to
 * Do Not Call could still be nominated through its contact row. Numbers are
 * matched on their core digits so a stored +1 prefix never hides a match.
 *
 * Returns the number of contact rows flagged. Best-effort: callers should not
 * fail the opt-out if this step errors.
 */
export async function suppressContactsForPhones(wsId: string, phones: (string | null | undefined)[]) {
  const keys = new Set(phones.map((p) => phoneKey(p)).filter(Boolean) as string[]);
  if (!keys.size) return 0;

  const { data, error } = await supabase
    .from("contacts")
    .select("id, phone, suppressed")
    .eq("workspace_id", wsId)
    .eq("suppressed", false);
  if (error || !data?.length) return 0;

  const ids = data.filter((c) => {
    const k = phoneKey(c.phone);
    return !!k && keys.has(k);
  }).map((c) => c.id);
  if (!ids.length) return 0;

  const { error: upErr } = await supabase
    .from("contacts")
    .update({ suppressed: true, suppressed_at: new Date().toISOString() })
    .in("id", ids);
  if (upErr) return 0;
  return ids.length;
}

/**
 * Returns the set of normalized phone keys that must not receive outreach in a
 * workspace: local Do Not Call entries plus contacts suppressed family-wide by
 * Core. Shared by the leads, lists, campaign, worklist and agreement surfaces
 * so every entry point applies the same rule.
 */
export async function fetchBlockedPhoneKeys(wsId: string) {
  const [dnc, contacts] = await Promise.all([
    supabase.from("dnc_list").select("phone").eq("workspace_id", wsId),
    supabase.from("contacts").select("phone").eq("workspace_id", wsId).eq("suppressed", true),
  ]);
  const keys = new Set<string>();
  for (const row of [...(dnc.data ?? []), ...(contacts.data ?? [])]) {
    const k = phoneKey((row as any).phone);
    if (k) keys.add(k);
  }
  return keys;
}

