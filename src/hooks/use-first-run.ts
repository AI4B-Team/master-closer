import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a brand-new workspace through first-run setup at /welcome.
 * Runs as a normal query so it never blocks the back office from rendering.
 */
export function useFirstRunSetup() {
  const navigate = useNavigate();

  const { data: needsSetup } = useQuery({
    queryKey: ["workspace-onboarded"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
      if (!prof?.active_workspace_id) return false;
      const { data: ws } = await supabase
        .from("workspaces")
        .select("onboarded_at" as never)
        .eq("id", prof.active_workspace_id)
        .maybeSingle();
      return !!ws && !(ws as any).onboarded_at;
    },
  });

  useEffect(() => {
    if (needsSetup) navigate({ to: "/welcome", replace: true });
  }, [needsSetup, navigate]);
}
