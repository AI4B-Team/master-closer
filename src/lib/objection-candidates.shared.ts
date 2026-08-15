/** Column list + dedupe key for the objection review queue. */
export const CANDIDATE_SELECT =
  "id, workspace_id, profile_id, industry, prospect_text, ai_response, label, mode, occurrences, call_id, status, reviewed_at, first_seen_at, last_seen_at";

/** Rough dedupe key so the same objection asked twice becomes one queue row. */
export function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
