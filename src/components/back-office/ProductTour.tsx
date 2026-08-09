import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { X, Check, Crosshair, ArrowDown } from "lucide-react";
import { setTourStatus } from "@/lib/help.functions";

/**
 * Skippable ~60-second product tour with spotlight dimming, anchored to
 * [data-tour] targets in the shell. Status is persisted per user so the
 * tour can be replayed from Help → Tour.
 */
export type TourStep = { anchor: string; title: string; body: string };

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: "nav-dashboard",
    title: "Your Day At A Glance",
    body: "Connects, close rate, and pipeline movement land here the moment a call wraps.",
  },
  {
    anchor: "nav-leads",
    title: "Load Your Prospects",
    body: "Import a list or add leads by hand. Every record carries consent state and call history with it.",
  },
  {
    anchor: "nav-calls",
    title: "Run The Call",
    body: "The live cockpit dials, delivers the disclosure, and shows the next best line while the prospect talks.",
  },
  {
    anchor: "nav-campaigns",
    title: "Dial At Volume",
    body: "Queue a campaign against a list, set a daily cap, and let the dialer work the queue in order.",
  },
  {
    anchor: "nav-ai-closers",
    title: "Train Your Closer",
    body: "Pick a voice, an industry, and a mode — AI, Hybrid, or Copilot — then feed it your scripts and objections.",
  },
  {
    anchor: "nav-team",
    title: "Proof And Audit Trail",
    body: "Outcomes by mode and rep, with the disclosure record behind every recorded call.",
  },
  {
    anchor: "notifications",
    title: "Stay In The Loop",
    body: "Signed agreements, finished calls, and campaign activity show up here as they happen.",
  },
  {
    anchor: "help",
    title: "Replay Anytime",
    body: "This tour lives behind the question mark, along with tutorials and a direct line to us.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function anchorRect(anchor: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function ProductTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<"welcome" | "steps">("welcome");
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const save = useServerFn(setTourStatus);

  const step = TOUR_STEPS[i]!;

  useLayoutEffect(() => {
    if (!open || phase !== "steps") return;
    const measure = () => setRect(anchorRect(step.anchor));
    measure();
    const t = window.setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, phase, step]);

  useEffect(() => {
    if (open) {
      setPhase("welcome");
      setI(0);
    }
  }, [open]);

  const finish = useCallback(
    (status: "skipped" | "completed") => {
      save({ data: { status } }).catch(() => {});
      onClose();
    },
    [onClose, save],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("skipped");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;

  if (phase === "welcome") {
    return (
      <div className="tour-veil">
        <div className="tour-welcome">
          <div className="tour-rail">
            <div className="tour-brand">
              <span className="tour-mark">
                <Crosshair size={15} strokeWidth={2.6} />
              </span>
              <span className="font-display">Master Closer</span>
            </div>
            <div className="tour-flow">
              {["Leads", "Dial", "Close", "Sign"].map((label, idx) => (
                <div key={label}>
                  <div className="tour-flow-step">
                    <span>{idx + 1}</span>
                    {label}
                  </div>
                  {idx < 3 && (
                    <div className="tour-flow-arrow">
                      <ArrowDown size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="tour-rail-note">60-Second Guided Tour</p>
          </div>

          <div className="tour-welcome-body">
            <h2 className="font-display">Let's Close Your First Call</h2>
            <p className="tour-sub">
              See how Master Closer loads prospects, runs the call, and gets the agreement signed — in
              about a minute.
            </p>
            <ul className="tour-list">
              {[
                "Load a prospect list",
                "Run a live or simulated call",
                "Let AI feed the next best line",
                "Send and sign the agreement",
              ].map((item) => (
                <li key={item}>
                  <span className="tour-check">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button type="button" className="pm-cta pm-cta-primary tour-cta" onClick={() => setPhase("steps")}>
              Start 60-Second Tour
            </button>
            <button type="button" className="tour-skip-wide" onClick={() => finish("skipped")}>
              Skip For Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pad = 6;
  const cardWidth = 380;
  const spot = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  const cardStyle: React.CSSProperties = spot
    ? {
        top: Math.min(Math.max(spot.top, 12), Math.max(window.innerHeight - 260, 12)),
        left: Math.min(spot.left + spot.width + 16, Math.max(window.innerWidth - cardWidth - 16, 16)),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const last = i === TOUR_STEPS.length - 1;

  return (
    <div className="tour-layer">
      {spot ? (
        <div
          className="tour-spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : (
        <div className="tour-veil-flat" />
      )}

      <div className="tour-card" style={cardStyle}>
        <div className="tour-card-head">
          <span className="tour-step-label">
            Step {i + 1}/{TOUR_STEPS.length}
          </span>
          <button type="button" aria-label="Close tour" className="tour-x" onClick={() => finish("skipped")}>
            <X size={15} />
          </button>
        </div>
        <h3 className="font-display">{step.title}</h3>
        <p>{step.body}</p>

        <div className="tour-bar">
          <div style={{ width: `${((i + 1) / TOUR_STEPS.length) * 100}%` }} />
        </div>

        <div className="tour-foot">
          <button type="button" className="tour-skip" onClick={() => finish("skipped")}>
            Skip
          </button>
          <div className="tour-foot-right">
            {i > 0 && (
              <button type="button" className="pm-cta pm-cta-outline tour-btn" onClick={() => setI((n) => n - 1)}>
                Back
              </button>
            )}
            {last ? (
              <Link to="/dialer" className="pm-cta pm-cta-primary tour-btn" onClick={() => finish("completed")}>
                Open The Dialer
              </Link>
            ) : (
              <button type="button" className="pm-cta pm-cta-primary tour-btn" onClick={() => setI((n) => n + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The tour never auto-launches — it starts from Help → Tour. */
export function useProductTour() {
  const [open, setOpen] = useState(false);
  return { open, start: () => setOpen(true), close: () => setOpen(false) };
}
