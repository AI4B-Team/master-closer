import { useEffect } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

/** Sends brand-new workspaces through first-run setup, without blocking render. */
function useFirstRunRedirect() {
  const navigate = useNavigate();

  const { data: needsSetup } = useQuery({
    queryKey: ["workspace-onboarded"],
    staleTime: 60_000,
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
    if (needsSetup) navigate({ to: "/welcome" });
  }, [needsSetup, navigate]);
}

function AuthenticatedLayout() {
  useFirstRunRedirect();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
