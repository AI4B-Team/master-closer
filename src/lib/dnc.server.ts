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
    const { data, error } = await supabase
      .from("contacts")
      .select("id, phone")
      .eq("workspace_id", workspaceId)
      .eq("suppressed", false);
    if (error || !data?.length) return 0;

    const ids = (data as { id: string; phone: string | null }[])
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
