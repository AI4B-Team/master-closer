import { phoneKey } from "@/lib/phone";

/**
 * Server-side twin of `suppressContactsForPhones` in `@/lib/dnc`, for callers that
 * bring their own Supabase client (the /api/v1 surface, cron jobs).
 *
 * The Do Not Call list is keyed by phone, but nominations, worklists and lead
 * lines read `contacts.suppressed`. Flagging the contact is what actually stops
 * a suppressed person from being re-queued (a DB trigger then pauses live
 * lines). Numbers match on their core digits so a stored +1 never hides a hit.
 *
 * Best-effort: returns the number of contacts flagged, never throws.
 */
export async function suppressContactsForPhonesServer(
  supabase: any,
  workspaceId: string,
  phones: (string | null | undefined)[],
): Promise<number> {
  const keys = new Set(phones.map((p) => phoneKey(p)).filter(Boolean) as string[]);
  if (!keys.size) return 0;

  try {
    // Paged: an unbounded select returns only the first page, so contacts past
    // the cap would stay dialable after an opt-out.
    const rows = await pageAll<{ id: string; phone: string | null }>((from, to) =>
      supabase
        .from("contacts")
        .select("id, phone")
        .eq("workspace_id", workspaceId)
        .eq("suppressed", false)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (!rows.length) return 0;

    const ids = rows
      .filter((c) => {
        const k = phoneKey(c.phone);
        return !!k && keys.has(k);
      })
      .map((c) => c.id);
    if (!ids.length) return 0;

    const { error: upErr } = await supabase
      .from("contacts")
      .update({ suppressed: true, suppressed_at: new Date().toISOString() })
      .in("id", ids);
    if (upErr) return 0;
    return ids.length;
  } catch {
    return 0;
  }
}

const PAGE = 1000;

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
 * Server-side twin of `fetchBlockedPhoneKeys` in `@/lib/dnc`, for callers that
 * bring their own Supabase client (the /api/v1 surface, cron jobs).
 *
 * Returns the normalized phone keys that must not receive outreach: local Do
 * Not Call entries plus contacts suppressed family-wide by Core. Reads are
 * paged and a failure throws, so a partial list can never read as "clear".
 */
export async function fetchBlockedPhoneKeysServer(
  supabase: any,
  workspaceId: string,
): Promise<Set<string>> {
  const keys = new Set<string>();
  const [dnc, contacts] = await Promise.all([
    pageAll<{ phone: string | null }>((from, to) =>
      supabase
        .from("dnc_list")
        .select("phone")
        .eq("workspace_id", workspaceId)
        .order("phone", { ascending: true })
        .range(from, to),
    ),
    pageAll<{ phone: string | null }>((from, to) =>
      supabase
        .from("contacts")
        .select("phone")
        .eq("workspace_id", workspaceId)
        .eq("suppressed", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  for (const row of [...dnc, ...contacts]) {
    const k = phoneKey(row.phone);
    if (k) keys.add(k);
  }
  return keys;
}

