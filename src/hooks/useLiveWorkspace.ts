import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";

/** Event types worth interrupting the user for, with the copy to show. */
const ALERTS: Record<string, string> = {
  "call.handoff": "Handoff Requested",
  "call.transfer": "Call Transferred",
  "agreement.signed": "Agreement Signed",
  "deal.won": "Deal Won",
  "lead.flagged_dnc": "Lead Flagged Do Not Call",
  "consent.missing": "Consent Missing",
};

function alertFor(row: any): string | null {
  const kind = String(row?.payload?.kind ?? row?.event_type ?? "");
  if (ALERTS[kind]) return ALERTS[kind];
  if (kind.includes("handoff")) return "Handoff Requested";
  return null;
}

/**
 * Subscribes to workspace activity (events) and follow-up tasks and refreshes
 * the feeds that render them, so new rows appear without a page refresh.
 * High-priority events also raise a toast.
 */
export function useLiveWorkspace(extraKeys: string[] = []) {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  useEffect(() => {
    if (!wsId) return;
    // Only listen to rows in the active workspace so toasts and refetches never
    // fire for a sibling workspace in the same org.
    const scope = (table: string, event: "*" | "INSERT" = "*") =>
      ({ event, schema: "public", table, filter: `workspace_id=eq.${wsId}` }) as const;
    const prefixes = [
      "notifications",
      "org-events",
      "activity",
      "activity-panel",
      "activity-latest",
      "dashboard-stats",
      "dashboard-tasks",
      "dashboard-activity",
      "tasks",
      "followups",
      "calls",
      "deals",
      "pipeline",
      "leads",
      "agreements",
      "bg-agents",
      "bg-proposals",
      "bg-worklist",
      "bg-report",
      "dashboard-worklist",
      ...extraKeys,
    ];
    const bump = () => {
      qc.invalidateQueries({
        predicate: (q) => prefixes.includes(String(q.queryKey[0])),
      });
    };

    const channel = supabase
      .channel(`workspace-live-${wsId}`)
      .on("postgres_changes", scope("events"), (payload) => {
        bump();
        if (payload.eventType !== "INSERT") return;
        const label = alertFor(payload.new);
        const detail = (payload.new as any)?.payload ?? {};
        if (label) {
          toast(label, {
            description: detail.name || detail.lead_name || detail.title || detail.phone || undefined,
          });
        }
      })
      .on("postgres_changes", scope("tasks"), bump)
      .on("postgres_changes", scope("calls"), bump)
      .on("postgres_changes", scope("deals"), bump)
      .on("postgres_changes", scope("leads"), bump)
      .on("postgres_changes", scope("agent_runs"), bump)
      .on("postgres_changes", scope("worklist_nominations"), bump)
      .on("postgres_changes", scope("agent_proposals", "INSERT"), (payload) => {
        bump();
        const row = payload.new as any;
        toast("Agent Proposal Waiting", {
          description: row?.title || row?.target_field || "A background agent drafted a change for review.",
        });
      })
      .on("postgres_changes", scope("agreements"), (payload) => {
        bump();
        if (payload.eventType !== "UPDATE") return;
        const row = payload.new as any;
        const prev = payload.old as any;
        if (row?.status === "signed" && prev?.status !== "signed") {
          toast("Agreement Signed", { description: row.title || row.signer_name || undefined });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, wsId, extraKeys.join("|")]);
}
