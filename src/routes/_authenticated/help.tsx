import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/back-office/AppShell";
import {
  Rocket, PhoneCall, Bot, ShieldCheck, FileSignature, Megaphone, Users,
  BarChart3, CreditCard, PlayCircle, BookOpen, Mail,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help Center — Master Closer" },
      {
        name: "description",
        content: "Answers for setting up lists, running AI, Hybrid and Copilot calls, disclosures, and agreements.",
      },
      { property: "og:title", content: "Help Center — Master Closer" },
      {
        property: "og:description",
        content: "Answers for setting up lists, running AI, Hybrid and Copilot calls, disclosures, and agreements.",
      },
    ],
  }),
  component: HelpPage,
});

const TOPICS = [
  {
    icon: Rocket,
    title: "Getting Started",
    body: "Create a workspace, invite your closers, and load your first prospect list.",
    to: "/leads",
  },
  {
    icon: PhoneCall,
    title: "Running A Call",
    body: "Dial from the cockpit, switch modes mid-call, and read the next best response.",
    to: "/dialer",
  },
  {
    icon: Bot,
    title: "Training AI Closers",
    body: "Set voice, industry, and mode, then feed the closer your scripts and objections.",
    to: "/ai-closers",
  },
  {
    icon: ShieldCheck,
    title: "Disclosures & Consent",
    body: "Edit the disclosure script, choose delivery, and review state recording rules.",
    to: "/compliance",
  },
  {
    icon: FileSignature,
    title: "Agreements & Signing",
    body: "Build templates with merge fields, send from the call, and track signatures.",
    to: "/agreements",
  },
  {
    icon: Megaphone,
    title: "Campaigns & Lists",
    body: "Queue a list against a campaign, set daily caps, and pace your dialing.",
    to: "/campaigns",
  },
  {
    icon: Users,
    title: "Team & Roles",
    body: "Add reps, set permissions, and control who can dial, edit, or export.",
    to: "/members",
  },
  {
    icon: BarChart3,
    title: "Reports",
    body: "Compare outcomes by mode and rep, and track close rate over time.",
    to: "/team",
  },
  {
    icon: CreditCard,
    title: "Billing & Payments",
    body: "Manage your plan, payment methods, and in-call payment collection.",
    to: "/payments",
  },
];

const FAQ = [
  {
    q: "What's the difference between AI, Hybrid, and Copilot?",
    a: "AI runs the call end to end. Hybrid lets AI open and qualify, then hands a warm prospect to your closer. Copilot keeps your rep leading while AI feeds the exact next line.",
  },
  {
    q: "Do I need consent to record?",
    a: "It depends on the state. The Compliance Center lists all-party and one-party rules and marks where the disclosure is required before the call surface unlocks.",
  },
  {
    q: "Can I try the dialer without live phone numbers?",
    a: "Yes. Turn on Simulation in the dialer and Master Closer will run a scripted prospect through the real AI assist pipeline.",
  },
  {
    q: "How do agreements get signed?",
    a: "Send from inside the call. The prospect gets a private signing link, and the signature, timestamp, and IP land on the agreement record.",
  },
  {
    q: "Where do my leads live?",
    a: "In Leads. Import by CSV or add them by hand — each record carries consent state, call history, and pipeline stage.",
  },
];

function HelpPage() {
  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Short answers for getting set up, running calls, and staying compliant."
      />

      <div className="help-grid">
        {TOPICS.map((t) => (
          <Link key={t.title} to={t.to} className="help-card">
            <span className="help-ico">
              <t.icon size={18} strokeWidth={2.1} />
            </span>
            <h3 className="font-display">{t.title}</h3>
            <p>{t.body}</p>
          </Link>
        ))}
      </div>

      <div className="help-two">
        <section className="help-panel">
          <h2 className="font-display help-h2">Common Questions</h2>
          <div className="help-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="help-panel">
          <h2 className="font-display help-h2">More Ways To Learn</h2>
          <Link to="/tutorials" className="help-row">
            <BookOpen size={16} />
            <span>
              <strong>Tutorials</strong>
              Step-by-step walkthroughs of every module.
            </span>
          </Link>
          <Link to="/dialer" className="help-row">
            <PlayCircle size={16} />
            <span>
              <strong>Try Simulation Mode</strong>
              Run a full call without touching a live number.
            </span>
          </Link>
          <a href="mailto:support@masterclosers.ai" className="help-row">
            <Mail size={16} />
            <span>
              <strong>Talk To Us</strong>
              support@masterclosers.ai — we answer fast.
            </span>
          </a>
        </section>
      </div>
    </div>
  );
}
