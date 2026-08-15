import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, Mic, Users, TrendingUp, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import team1 from "@/assets/team-1.jpg";
import team2 from "@/assets/team-2.jpg";
import team3 from "@/assets/team-3.jpg";
import team4 from "@/assets/team-4.jpg";

const TEAM_AVATARS = [
  { src: team1, alt: "Sales team member" },
  { src: team2, alt: "Sales team member" },
  { src: team3, alt: "Sales team member" },
  { src: team4, alt: "Sales team member" },
];

export const Route = createFileRoute("/auth")({
  // Rendered client-side only: this page is reached both directly and via the
  // protected-route redirect, and SSR-ing it there produced a hydration
  // mismatch (server streamed the lazy placeholder, client had the component).
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Master Closer" },
      { name: "description", content: "Sign in to your Master Closer back office." },
    ],
  }),
  component: AuthPage,
});

const PROMO_STATS = [
  { icon: Mic, label: "AI closes calls end-to-end" },
  { icon: Users, label: "Hybrid handoff to your best reps" },
  { icon: TrendingUp, label: "Copilot whispers the next best line" },
  { icon: ShieldCheck, label: "Built-in consent & compliance" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/welcome",
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm, or sign in below.");
        setMode("signin");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setForgotSent(true);
        toast.success("Password reset link sent.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed.");
      setBusy(false);
      return;
    }
    if (!result.redirected) navigate({ to: "/dashboard" });
  };

  const switchMode = (next: "signin" | "signup" | "forgot") => {
    setMode(next);
    setForgotSent(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F4F4F6]">
      {/* Left panel — promo */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between bg-[#0B0B0E] text-white p-10 xl:p-14 relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
            <Crosshair className="h-6 w-6 text-[#CC0000]" strokeWidth={2.5} />
            <span className="text-lg font-bold tracking-tight">Master Closer</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="text-[#CC0000] font-semibold tracking-wide uppercase text-sm mb-4">
            AI-Powered Sales Calls
          </p>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] mb-6">
            One Platform.
            <br />
            Every Call Closed.
          </h1>
          <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-md">
            Master Closer runs your sales calls end to end, hands off to a human closer, or whispers the next best line while your rep talks.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROMO_STATS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#CC0000]/15 text-[#CC0000]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-white/90 leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {TEAM_AVATARS.map(({ src, alt }) => (
                <img
                  key={src}
                  src={src}
                  alt={alt}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="h-10 w-10 rounded-full border-2 border-[#0B0B0E] object-cover"
                />
              ))}
            </div>
            <div className="text-sm text-white/60">
              <span className="font-semibold text-white">500+</span> sales teams already dialing
            </div>
          </div>
        </div>

      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Card className="p-8 rounded-2xl border-[#E7E7EC] shadow-sm bg-white">
            <h1 className="text-2xl font-bold mb-1">
              {mode === "forgot" ? "Reset Password" : mode === "signin" ? "Sign In" : "Create Your Account"}
            </h1>
            <p className="text-sm text-[#6B6B76] mb-6">
              {mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : mode === "signin"
                ? "Welcome back to Master Closer."
                : "Spin up your workspace in seconds."}
            </p>

            {mode !== "forgot" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={google}
                  disabled={busy}
                  className="w-full mb-4 h-11 rounded-xl border-[#E7E7EC] hover:bg-[#F4F4F6]"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continue With Google
                </Button>

                <div className="flex items-center gap-3 my-4">
                  <div className="h-px flex-1 bg-[#E7E7EC]" />
                  <span className="text-xs text-[#6B6B76]">Or</span>
                  <div className="h-px flex-1 bg-[#E7E7EC]" />
                </div>
              </>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1 h-11" />
                </div>
              )}
              {(mode === "signin" || mode === "forgot" || mode === "signup") && (
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 h-11" />
                </div>
              )}
              {(mode === "signin" || mode === "signup") && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1 h-11" />
                </div>
              )}
              <Button type="submit" disabled={busy || (mode === "forgot" && forgotSent)} className="w-full h-11 rounded-xl bg-[#CC0000] hover:bg-[#A30000]">
                {busy
                  ? "Please Wait…"
                  : mode === "forgot"
                  ? forgotSent
                    ? "Link Sent"
                    : "Send Reset Link"
                  : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>

            {mode === "signin" && (
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  className="text-sm text-[#CC0000] font-medium hover:underline"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="text-sm text-[#6B6B76] hover:text-[#17171B]"
                  onClick={() => switchMode("signup")}
                >
                  Create account
                </button>
              </div>
            )}

            {mode === "signup" && (
              <p className="text-sm text-center mt-4 text-[#6B6B76]">
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-[#CC0000] font-medium hover:underline"
                  onClick={() => switchMode("signin")}
                >
                  Sign In
                </button>
              </p>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-1 text-sm text-[#6B6B76] hover:text-[#17171B]"
                onClick={() => switchMode("signin")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            )}
          </Card>
          <p className="text-xs text-center text-[#6B6B76] mt-6">
            <Link to="/" className="hover:underline">← Back To Home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

