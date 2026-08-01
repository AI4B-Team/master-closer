import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { hubSignIn, hubLink } from "@/lib/hub.functions";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/auth/hub")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    next: typeof search.next === "string" ? search.next : "/dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Connecting Real Elite — Master Closer" },
      { name: "description", content: "Secure single sign-on handoff from Real Elite into Master Closer." },
      { property: "og:title", content: "Connecting Real Elite — Master Closer" },
      { property: "og:description", content: "Secure single sign-on handoff from Real Elite into Master Closer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HubHandoff,
});

function HubHandoff() {
  const { token, next } = Route.useSearch();
  const router = useRouter();
  const signIn = useServerFn(hubSignIn);
  const link = useServerFn(hubLink);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      if (!token) {
        setError("Missing hub token.");
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        // Logged in already → additive account linking, never a duplicate org.
        if (sessionData.session) {
          await link({ data: { token } });
          router.navigate({ to: next as string, replace: true });
          return;
        }

        const { email, tokenHash } = await signIn({ data: { token } });
        const { error: otpError } = await supabase.auth.verifyOtp({
          type: "email",
          token_hash: tokenHash,
          email,
        });
        if (otpError) throw otpError;
        router.navigate({ to: next as string, replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete the Real Elite handoff.");
      }
    })();
  }, [token, next, link, signIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFB] px-6">
      <div className="max-w-md w-full rounded-2xl border border-[#E7E7EC] bg-white p-8 text-center">
        {error ? (
          <>
            <TriangleAlert className="h-8 w-8 text-[#CC0000] mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Handoff Failed</h1>
            <p className="text-sm text-[#6B6B76]">{error}</p>
            <a href="/auth" className="inline-block mt-6 text-sm font-medium text-[#CC0000]">
              Sign in directly instead
            </a>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-4">
              <ShieldCheck className="h-6 w-6 text-[#0E9F6E]" />
              <Loader2 className="h-5 w-5 animate-spin text-[#6B6B76]" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Connecting Real Elite</h1>
            <p className="text-sm text-[#6B6B76]">Verifying your secure handoff token…</p>
          </>
        )}
      </div>
    </div>
  );
}
