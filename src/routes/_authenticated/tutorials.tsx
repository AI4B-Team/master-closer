import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/back-office/AppShell";
import { Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutorials")({
  head: () => ({
    meta: [
      { title: "Tutorials — Master Closer" },
      {
        name: "description",
        content: "Short walkthroughs: import leads, run AI and Copilot calls, send agreements, and read your reports.",
      },
      { property: "og:title", content: "Tutorials — Master Closer" },
      {
        property: "og:description",
        content: "Short walkthroughs: import leads, run AI and Copilot calls, send agreements, and read your reports.",
      },
    ],
  }),
  component: TutorialsPage,
});

const TRACKS = [
  {
    track: "Setup",
    items: [
      { title: "Import Your First List", mins: 3, to: "/lists", steps: ["Upload a CSV", "Map the columns", "Check consent state"] },
      { title: "Invite Your Closers", mins: 2, to: "/members", steps: ["Add a rep", "Pick a role", "Set dialing limits"] },
      { title: "Write Your Disclosure", mins: 4, to: "/compliance", steps: ["Edit the script", "Choose delivery", "Review state rules"] },
    ],
  },
  {
    track: "Calling",
    items: [
      { title: "Run A Simulated Call", mins: 5, to: "/dialer", steps: ["Turn on Simulation", "Answer an objection", "Read the next best line"] },
      { title: "Switch Modes Mid-Call", mins: 3, to: "/dialer", steps: ["Start in AI", "Hand off in Hybrid", "Take over in Copilot"] },
      { title: "Queue A Campaign", mins: 4, to: "/campaigns", steps: ["Attach a list", "Set a daily cap", "Start the queue"] },
    ],
  },
  {
    track: "Closing",
    items: [
      { title: "Build An Agreement Template", mins: 5, to: "/agreements", steps: ["Add merge fields", "Set the default", "Preview it"] },
      { title: "Send And Track A Signature", mins: 3, to: "/agreements", steps: ["Send from the call", "Watch the view event", "Confirm the signature"] },
      { title: "Read Your Close Rate", mins: 4, to: "/team", steps: ["Compare modes", "Filter by rep", "Export the numbers"] },
    ],
  },
];

function TutorialsPage() {
  return (
    <div>
      <PageHeader
        title="Tutorials"
        description="Short, practical walkthroughs — most take under five minutes."
      />

      {TRACKS.map((group) => (
        <section key={group.track} className="tut-section">
          <h2 className="font-display tut-h2">{group.track}</h2>
          <div className="tut-grid">
            {group.items.map((t) => (
              <Link key={t.title} to={t.to} className="tut-card">
                <div className="tut-top">
                  <span className="tut-mins">
                    <Clock size={12} /> {t.mins} min
                  </span>
                  <ArrowRight size={15} className="tut-arrow" />
                </div>
                <h3 className="font-display">{t.title}</h3>
                <ol className="tut-steps">
                  {t.steps.map((s, i) => (
                    <li key={s}>
                      <span>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
