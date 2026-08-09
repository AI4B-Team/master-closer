import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to workspace activity (events) and follow-up tasks and refreshes
 * the feeds that render them, so new rows appear without a page refresh.
 */
export function useLiveWorkspace(extraKeys: string[] = []) {
  const qc = useQueryClient();

  useEffect(() => {
    const prefixes = [
      "notifications",
      "org-events",
      "activity",
      "dashboard-stats",
      "dashboard-tasks",
      "dashboard-activity",
      "tasks",
      "followups",
      ...extraKeys,
    ];
    const bump = () => {
      qc.invalidateQueries({
        predicate: (q) => prefixes.includes(String(q.queryKey[0])),
      });
    };

    const channel = supabase
      .channel("workspace-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, bump)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, extraKeys.join("|")]);
}
