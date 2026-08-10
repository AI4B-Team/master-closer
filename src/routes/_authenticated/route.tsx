import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    if (true) { return { user: data.user }; }
    // First run: send the user through setup before showing the back office.
    const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
    if (prof?.active_workspace_id) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("onboarded_at" as never)
        .eq("id", prof.active_workspace_id)
        .maybeSingle();
      if (ws && !(ws as any).onboarded_at) throw redirect({ to: "/welcome" });
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
