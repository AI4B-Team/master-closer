import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Master Closer" },
      { name: "description", content: "Set a new password for your Master Closer account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    // Supabase recovery links put the tokens in the URL hash as access_token + type=recovery.
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    if (type !== "recovery") {
      setValid(false);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(error.message ?? "Could not update password.");
      return;
    }

    setDone(true);
    toast.success("Password updated.");
    setTimeout(() => {
      navigate({ to: "/auth" });
    }, 2000);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F4F4F6]">
      {/* Left panel — promo */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-center bg-[#0B0B0E] text-white p-10 xl:p-14 relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <Link to="/" className="absolute -top-8 left-0 inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
            <Crosshair className="h-6 w-6 text-[#CC0000]" strokeWidth={2.5} />
            <span className="text-lg font-bold tracking-tight">Master Closer</span>
          </Link>

          <p className="text-[#CC0000] font-semibold tracking-wide uppercase text-sm mb-4 mt-16">
            Secure Account Recovery
          </p>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Set A New Password.
            <br />
            Get Back To Closing.
          </h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-md">
            Choose a strong password and you'll be right back in your workspace, ready to run calls.
          </p>
        </div>

        <div
          className="pointer-events-none absolute -bottom-32 -right-32 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #CC0000 0%, transparent 70%)" }}
        />
      </div>

      {/* Right panel — reset form */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Card className="p-8 rounded-2xl border-[#E7E7EC] shadow-sm bg-white">
            {!valid ? (
              <>
                <h1 className="text-2xl font-bold mb-2">Invalid Recovery Link</h1>
                <p className="text-sm text-[#6B6B76] mb-6">
                  This password reset link is missing or expired. Request a new one from the sign-in page.
                </p>
                <Link to="/auth">
                  <Button className="w-full h-11 rounded-xl bg-[#CC0000] hover:bg-[#A30000]">
                    Go To Sign In
                  </Button>
                </Link>
              </>
            ) : done ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#0E9F6E]/10 text-[#0E9F6E]">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Password Updated</h1>
                <p className="text-sm text-[#6B6B76] mb-6">
                  Your password has been reset. Redirecting you to sign in…
                </p>
                <Link to="/auth">
                  <Button className="w-full h-11 rounded-xl bg-[#CC0000] hover:bg-[#A30000]">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-1">Set New Password</h1>
                <p className="text-sm text-[#6B6B76] mb-6">
                  Choose a new password for your Master Closer account.
                </p>

                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="mt-1 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm">Confirm Password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={6}
                      className="mt-1 h-11"
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-[#CC0000] hover:bg-[#A30000]">
                    {busy ? "Updating…" : "Update Password"}
                  </Button>
                </form>

                <Link
                  to="/auth"
                  className="mt-4 inline-flex items-center gap-1 text-sm text-[#6B6B76] hover:text-[#17171B]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </>
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
