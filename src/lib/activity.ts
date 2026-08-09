import { emitOrgEvent } from "@/lib/hub.functions";

/**
 * Fire-and-forget activity emission. Every workspace action that should show up
 * in the Activity Log (and fan out to org webhooks) routes through here.
 * Failures are swallowed: logging must never break the user's action.
 */
export async function logActivity(kind: string, payload: Record<string, unknown> = {}) {
  try {
    await emitOrgEvent({ data: { event_type: "job.completed", payload: { kind, ...payload } } });
  } catch {
    /* non-blocking */
  }
}
