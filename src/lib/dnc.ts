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

  // Paged: the Data API caps an unbounded select, so a workspace with more
  // unsuppressed contacts than one page would silently skip the matches that
  // fell past the cap and leave those people dialable.
  const rows = await pageAll<{ id: string; phone: string | null }>((from, to) =>
    supabase
      .from("contacts")
      .select("id, phone")
      .eq("workspace_id", wsId)
      .eq("suppressed", false)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!rows.length) return 0;

  const ids = rows.filter((c) => {
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

const PAGE = 1000;

/**
 * Reads every row of a workspace-scoped query, page by page.
 *
 * Compliance screening cannot use a single unbounded select: the Data API
 * returns only the first page, so any blocked number past it would read as
 * "clear". A read failure throws so callers fail closed instead of screening
 * against a partial list.
 */
async function pageAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) return out;
  }
}

/**
 * Returns the set of normalized phone keys that must not receive outreach in a
 * workspace: local Do Not Call entries plus contacts suppressed family-wide by
 * Core. Shared by the leads, lists, campaign, worklist and agreement surfaces
 * so every entry point applies the same rule.
 */
export async function fetchBlockedPhoneKeys(wsId: string) {
  const [dnc, contacts] = await Promise.all([
    pageAll<{ phone: string | null }>((from, to) =>
      supabase.from("dnc_list").select("phone").eq("workspace_id", wsId).order("phone", { ascending: true }).range(from, to),
    ),
    pageAll<{ phone: string | null }>((from, to) =>
      supabase
        .from("contacts")
        .select("phone")
        .eq("workspace_id", wsId)
        .eq("suppressed", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  const keys = new Set<string>();
  for (const row of [...dnc, ...contacts]) {
    const k = phoneKey(row.phone);
    if (k) keys.add(k);
  }
  return keys;

}


/**
 * Undoes the local side-effects of an opt-out: contacts flagged `suppressed`
 * and leads forced to `opt_out` when the number was added to Do Not Call.
 *
 * Only call this when Core no longer holds a family-wide opt-out — Core owns
 * that list and a local release cannot lift it. Best-effort; returns counts.
 */
export async function releasePhoneLocally(wsId: string, phone: string | null | undefined) {
  const key = phoneKey(phone);
  if (!key) return { contacts: 0, leads: 0, linesPaused: 0 };

  const [contacts, leads] = await Promise.all([
    supabase.from("contacts").select("id, phone").eq("workspace_id", wsId).eq("suppressed", true),
    supabase.from("leads").select("id, phone").eq("workspace_id", wsId).eq("consent", "opt_out").not("phone", "is", null),
  ]);

  const contactIds = (contacts.data ?? []).filter((c) => phoneKey(c.phone) === key).map((c) => c.id);
  const leadIds = (leads.data ?? []).filter((l) => phoneKey(l.phone) === key).map((l) => l.id);

  if (contactIds.length) {
    await supabase.from("contacts").update({ suppressed: false, suppressed_at: null }).in("id", contactIds);
  }
  if (leadIds.length) {
    await supabase.from("leads").update({ consent: "unknown" }).in("id", leadIds);
  }

  // Suppression pauses live follow-up lines through a database trigger.
  // Resuming them is a human decision, so report the count instead of
  // silently restarting outreach.
  let linesPaused = 0;
  if (contactIds.length) {
    const { count } = await supabase
      .from("lead_lines")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .eq("status", "paused")
      .in("contact_id", contactIds);
    linesPaused = count ?? 0;
  }

  return { contacts: contactIds.length, leads: leadIds.length, linesPaused };
}
