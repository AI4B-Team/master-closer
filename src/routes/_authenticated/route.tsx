import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (typeof window !== "undefined") {
        // Hard navigation: swapping in the sign-in page mid-hydration makes
        // React report a hydration mismatch, since the server streamed the
        // protected shell for this URL.
        window.location.replace("/auth");
        throw new Promise(() => {});
      }
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
