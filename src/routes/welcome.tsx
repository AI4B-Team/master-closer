import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Bot, Building2, Check, Loader2, Rocket, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATE_RULES, disclosureStatus } from "@/lib/compliance";
import { seedStarterWorkspace } from "@/lib/starter.functions";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set Up Your Workspace — Master Closer" },
      { name: "description", content: "Name your workspace, set your calling state and time zone, then load starter data to make your first AI call." },
      { property: "og:title", content: "Set Up Your Workspace — Master Closer" },
      { property: "og:description", content: "Name your workspace, set your calling state and time zone, then load starter data to make your first AI call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

const GUESSED_TZ = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
};

function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [state, setState] = useState("");
  const [timezone, setTimezone] = useState(GUESSED_TZ());

  const runSeed = useServerFn(seedStarterWorkspace);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
      if (!prof?.active_workspace_id) {
        navigate({ to: "/dashboard" });
        return;
      }
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, legal_business_name, business_state, timezone")
        .eq("id", prof.active_workspace_id)
        .maybeSingle();
      if (!active) return;
      setWsId(ws?.id ?? null);
      setName(ws?.name ?? "");
      setLegalName(ws?.legal_business_name ?? "");
      setState(ws?.business_state ?? "");
      if (ws?.timezone) setTimezone(ws.timezone);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const saveBusiness = async () => {
    if (!wsId) return;
    if (!name.trim()) {
      toast.error("Give your workspace a name.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({
          name: name.trim(),
          legal_business_name: legalName.trim() || null,
          business_state: state || null,
          timezone: timezone.trim() || "America/New_York",
        })
        .eq("id", wsId);
      if (error) throw error;
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save your workspace.");
    } finally {
      setBusy(false);
    }
  };

  /** Marks setup complete so the back office stops redirecting here. */
  const finish = async () => {
    if (!wsId) return;
    await supabase
      .from("workspaces")
      .update({ onboarded_at: new Date().toISOString() } as never)
      .eq("id", wsId);
    setStep(3);
  };

  const seed = async (withData: boolean) => {
    if (!withData) {
      await finish();
      return;
    }
    setBusy(true);
    try {
      const res: any = await runSeed({ data: undefined } as any);
      const created: string[] = res?.created ?? [];
      if (created.length === 0) toast("Your workspace already has data — nothing to add.");
      else toast.success(`Starter data loaded: ${created.join(", ")}.`);
      await finish();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not load starter data.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Promo panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-foreground text-background p-12">
        <div className="text-lg font-semibold tracking-tight">Master Closer</div>
        <div className="space-y-8 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Three quick steps. Then your first call.
          </h1>
          <ul className="space-y-5 text-background/80">
            {[
              { icon: Building2, title: "Your business", body: "Name, jurisdiction, and time zone so dialing stays compliant." },
              { icon: ShieldCheck, title: "Disclosure ready", body: "We set the right consent rules for your state automatically." },
              { icon: Bot, title: "A closer to test", body: "Load starter leads and a playbook so the dialer works instantly." },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <f.icon className="size-5 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <div className="font-medium text-background">{f.title}</div>
                  <div className="text-sm">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-background/60">You can change any of this later in Settings.</p>
      </aside>

      {/* Wizard panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          {!ready ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading your workspace…
            </div>
          ) : step === 1 ? (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void saveBusiness();
              }}
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Tell us about your business</h2>
                <p className="text-muted-foreground text-sm mt-1">This sets your workspace name and calling defaults.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace name</Label>
                <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Sales" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-legal">Legal business name</Label>
                <Input id="ws-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Acme Holdings, LLC" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-state">Primary state</Label>
                  <select
                    id="ws-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a state</option>
                    {STATE_RULES.map((r) => (
                      <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-tz">Time zone</Label>
                  <Input id="ws-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
                </div>
              </div>
              {state ? (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="size-4 mt-0.5 shrink-0" aria-hidden />
                  Disclosure is <strong className="font-medium text-foreground">{disclosureStatus(state)}</strong> in this state.
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  void (async () => {
                    await finish();
                    navigate({ to: "/dashboard" });
                  })();
                }}
              >
                Skip setup for now
              </button>
            </form>
          ) : step === 2 ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Want starter data?</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  We can add one AI closer, a lead list, sample leads, and a playbook so you can test the dialer right away.
                </p>
              </div>
              <Button className="w-full" onClick={() => void seed(true)} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
                Load starter data
              </Button>
              <Button variant="outline" className="w-full" onClick={() => void seed(false)} disabled={busy}>
                Start empty
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">You're set up</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Open the dialer to run a simulated call, or head to your dashboard.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate({ to: "/dialer" })}>
                Open the dialer <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
