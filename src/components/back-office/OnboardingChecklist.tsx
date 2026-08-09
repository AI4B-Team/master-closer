import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Rocket, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";


const DISMISS_KEY = "mc_onboarding_dismissed";

type Step = {
  key: string;
  title: string;
  hint: string;
  to: string;
  cta: string;
  done: boolean;
};

async function count(table: string, workspaceId?: string) {
  let q = supabase.from(table as never).select("id", { count: "exact", head: true });
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { count: c } = await q;
  return c ?? 0;
}


export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true);
  const { data: workspace } = useWorkspace();

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const { data } = useQuery({
    queryKey: ["onboarding-progress", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const wsId = workspace!.id;
      const [agents, leads, campaigns, templates, calls] = await Promise.all([
        count("agents", wsId),
        count("leads", wsId),
        count("campaigns", wsId),
        count("agreement_templates"),
        count("calls", wsId),
      ]);
      return { agents, leads, campaigns, templates, calls };
    },
  });


  if (dismissed || !data) return null;

  const steps: Step[] = [
    {
      key: "agent",
      title: "Create Your First AI Closer",
      hint: "Pick a voice, industry, and autonomy mode.",
      to: "/ai-closers",
      cta: "Build Closer",
      done: data.agents > 0,
    },
    {
      key: "leads",
      title: "Import Your Leads",
      hint: "Upload a CSV or add leads by hand.",
      to: "/leads",
      cta: "Import Leads",
      done: data.leads > 0,
    },
    {
      key: "campaign",
      title: "Launch A Campaign",
      hint: "Attach a list and set your dialing window.",
      to: "/campaigns",
      cta: "New Campaign",
      done: data.campaigns > 0,
    },
    {
      key: "agreement",
      title: "Add An Agreement Template",
      hint: "Send contracts without leaving the call.",
      to: "/agreements",
      cta: "Add Template",
      done: data.templates > 0,
    },
    {
      key: "call",
      title: "Run Your First Call",
      hint: "Try simulation mode in the dialer first.",
      to: "/dialer",
      cta: "Open Dialer",
      done: data.calls > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const pct = Math.round((doneCount / steps.length) * 100);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <section className="onb">
      <div className="onb-head">
        <div className="onb-title">
          <span className="onb-icon"><Rocket size={16} strokeWidth={2.3} /></span>
          <div>
            <h2>Get Set Up</h2>
            <p>{doneCount} of {steps.length} done — finish these to start closing.</p>
          </div>
        </div>
        <button type="button" className="onb-x" onClick={dismiss} aria-label="Dismiss Checklist">
          <X size={15} />
        </button>
      </div>

      <div className="onb-bar"><span style={{ width: `${pct}%` }} /></div>

      <ul className="onb-list">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "onb-item is-done" : "onb-item"}>
            <span className="onb-check">{s.done ? <Check size={13} strokeWidth={3} /> : null}</span>
            <div className="onb-copy">
              <strong>{s.title}</strong>
              <small>{s.hint}</small>
            </div>
            {s.done ? (
              <span className="onb-done-tag">Done</span>
            ) : (
              <Link to={s.to} className="onb-cta">
                {s.cta} <ArrowRight size={13} strokeWidth={2.6} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
