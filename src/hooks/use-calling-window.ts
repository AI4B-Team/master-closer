import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  DEFAULT_CALLING_WINDOW,
  checkCallingWindow,
  normalizeWindow,
  type CallingWindow,
  type WindowVerdict,
} from "@/lib/calling-window";

export type CallingWindowRow = CallingWindow & {
  id?: string;
  default_timezone: string;
  enforce: boolean;
};

const FALLBACK: CallingWindowRow = {
  ...DEFAULT_CALLING_WINDOW,
  default_timezone: "America/New_York",
  enforce: true,
};

/**
 * The workspace calling window plus a ready-to-use verdict helper. Every dial
 * path reads the same row so the rule cannot drift between screens.
 */
export function useCallingWindow() {
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const q = useQuery({
    queryKey: ["calling-window", wsId],
    enabled: !!wsId,
    queryFn: async (): Promise<CallingWindowRow> => {
      const { data, error } = await supabase
        .from("calling_windows")
        .select("id, start_minute, end_minute, days, default_timezone, enforce")
        .eq("workspace_id", wsId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return FALLBACK;
      return {
        id: data.id,
        ...normalizeWindow({
          start_minute: data.start_minute,
          end_minute: data.end_minute,
          days: data.days ?? [],
        }),
        default_timezone: data.default_timezone,
        enforce: data.enforce,
      };
    },
  });

  const window = q.data ?? FALLBACK;

  const verdictFor = (
    lead: { timezone?: string | null; phone?: string | null },
    at?: Date,
  ): WindowVerdict =>
    checkCallingWindow({
      lead,
      window,
      workspaceDefaultTimezone: window.default_timezone,
      at,
    });

  return { window, verdictFor, isLoading: q.isLoading, workspaceId: wsId };
}
