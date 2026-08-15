import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) // reloadDocument: a soft redirect during SSR streams the sign-in page as a
      // lazy placeholder and then hydrates it, which React reports as a
      // hydration mismatch. A document redirect renders /auth cleanly.
      throw redirect({ to: "/auth", reloadDocument: true });
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
