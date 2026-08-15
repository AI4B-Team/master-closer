import { supabase } from "@/integrations/supabase/client";
import { isDisclosureRequired } from "@/lib/compliance";

export type DisclosureMethod =
  | "pre_call_disclosure"
  | "outbound_pre_connect_audio"
  | "rep_delivered_disclosure";

export async function logDisclosure(params: {
  callId?: string | null;
  jurisdiction: string;
  line: string;
  method: DisclosureMethod;
  /** Core's recording verdict for the called party's jurisdiction, when it answered. */
  consentBasis?: { consentType: string; requiresAnnouncement: boolean } | null;
}) {
  const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
  if (!prof) throw new Error("No workspace found.");
  if (!prof.active_workspace_id) throw new Error("No active workspace");
  const { error } = await supabase.from("consent_logs").insert({
    org_id: prof.org_id, workspace_id: prof.active_workspace_id,
    call_id: params.callId ?? null,
    method: params.method,
    jurisdiction: params.jurisdiction.toUpperCase(),
    notes: params.consentBasis
      ? `${params.line}\n\n[Core: ${params.consentBasis.consentType} consent, announcement ${params.consentBasis.requiresAnnouncement ? "required" : "not required"}]`
      : params.line,
  });
  if (error) throw error;
}

/** Copilot: hide the live surface only while a Required state is undisclosed. */
export function shouldBlockLiveSurface(jurisdiction: string, delivered: boolean) {
  return isDisclosureRequired(jurisdiction) && !delivered;
}
