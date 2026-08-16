/** Server-only helpers for closer profile version history. */

/** The editable fields we snapshot. Ids, timestamps and ownership are excluded. */
export const PROFILE_SNAPSHOT_FIELDS = [
  "industry",
  "source",
  "name",
  "is_default",
  "opener",
  "context_framing",
  "objections",
  "screening_questions",
  "faqs",
  "tone",
  "escalation_triggers",
  "banned_topics",
  "dispositions",
] as const;

export const PROFILE_SNAPSHOT_SELECT = `id, ${PROFILE_SNAPSHOT_FIELDS.join(", ")}`;

export function toSnapshot(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const key of PROFILE_SNAPSHOT_FIELDS) out[key] = row?.[key] ?? null;
  return out;
}

function stable(value: unknown) {
  return JSON.stringify(value ?? null);
}

/**
 * Appends a snapshot for a closer profile. Returns the version number. Identical
 * consecutive snapshots are skipped so routine re-saves do not pad the history.
 */
export async function appendProfileVersion(
  supabase: any,
  args: {
    workspaceId: string;
    profileId: string;
    snapshot: Record<string, any>;
    source: "manual" | "restore" | "seed" | "import";
    note?: string | null;
    userId?: string | null;
  },
) {
  const { data: last } = await supabase
    .from("closer_profile_versions")
    .select("version, snapshot")
    .eq("profile_id", args.profileId)
    // Same tenant scoping as prompt versions: never diff or number a version
    // against another workspace's history.
    .eq("workspace_id", args.workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last && stable(last.snapshot) === stable(args.snapshot)) {
    return { version: last.version as number, created: false };
  }

  const version = (last?.version ?? 0) + 1;
  const { error } = await supabase.from("closer_profile_versions").insert({
    workspace_id: args.workspaceId,
    profile_id: args.profileId,
    version,
    snapshot: args.snapshot,
    source: args.source,
    note: args.note ?? null,
    created_by: args.userId ?? null,
  });
  if (error) throw new Error(error.message);
  return { version, created: true };
}
