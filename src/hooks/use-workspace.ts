import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  legal_business_name: string | null;
  business_state: string | null;
  default_caller_id: string | null;
  timezone: string;
};

export function useWorkspace() {
  return useQuery<Workspace | null, Error>({
    queryKey: ["active-workspace"],
    queryFn: async () => {
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("")
        .maybeSingle();
      if (profError) throw profError;
      if (!prof?.active_workspace_id) return null;

      const { data: ws, error: wsError } = await supabase
        .from("workspaces")
        .select("id, name, slug, brand_color, legal_business_name, business_state, default_caller_id, timezone")
        .eq("id", prof.active_workspace_id)
        .maybeSingle();
      if (wsError) throw wsError;
      return (ws as Workspace | null) ?? null;
    },
  });
}
