import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleHelp, LifeBuoy, PlayCircle, BookOpen, MessageSquarePlus,
  Sparkles, Loader2, CircleCheckBig, X,
} from "lucide-react";
import { toast } from "sonner";
import { submitFeedback, polishFeedback, FEEDBACK_CATEGORIES } from "@/lib/help.functions";

/** Question-mark menu in the top bar: Help · Tour · Tutorials · Feedback. */
export function HelpMenu({ onStartTour }: { onStartTour: () => void }) {
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [sent, setSent] = useState(false);

  const send = useServerFn(submitFeedback);
  const polish = useServerFn(polishFeedback);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  const reset = () => {
    setBody("");
    setCategory(null);
    setSent(false);
  };

  const improve = async () => {
    if (body.trim().length < 3) return toast.error("Write A Little First");
    setPolishing(true);
    try {
      const res = await polish({ data: { body, category } });
      if (res.text) {
        setBody(res.text);
        toast.success("Sharpened Your Feedback");
      } else toast.error("Couldn't Improve That Right Now");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't Improve That Right Now");
    } finally {
      setPolishing(false);
    }
  };

  const submit = async () => {
    if (body.trim().length < 3) return toast.error("Tell Us A Little More");
    setBusy(true);
    try {
      await send({
        data: { body, category, page: typeof window !== "undefined" ? window.location.pathname : null },
      });
      setSent(true);
      toast.success("Thanks — Feedback Received");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something Went Wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="profile-wrap" ref={wrap}>
        <button
          type="button"
          data-tour="help"
          className="icon-btn has-tip tip-below"
          data-tip="Help, tour and feedback"
          aria-label="Open Help Menu"
          onClick={() => setOpen((v) => !v)}
        >
          <CircleHelp size={17} />
        </button>

        {open && (
          <div className="drop-menu">
            <Item icon={<LifeBuoy size={15} />} label="Help" onClick={() => go("/help")} />
            <Item
              icon={<PlayCircle size={15} />}
              label="Tour"
              onClick={() => {
                setOpen(false);
                onStartTour();
              }}
            />
            <Item icon={<BookOpen size={15} />} label="Tutorials" onClick={() => go("/tutorials")} />
            <Item
              icon={<MessageSquarePlus size={15} />}
              label="Feedback"
              onClick={() => {
                setOpen(false);
                reset();
                setFeedbackOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {feedbackOpen && (
        <div
          className="fb-veil"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setFeedbackOpen(false);
              reset();
            }
          }}
        >
          <div className="fb-modal" role="dialog" aria-modal="true" aria-label="Send Feedback">
            <button
              type="button"
              className="fb-x"
              aria-label="Close"
              onClick={() => {
                setFeedbackOpen(false);
                reset();
              }}
            >
              <X size={16} />
            </button>

            {sent ? (
              <div className="fb-done">
                <span className="fb-done-ico">
                  <CircleCheckBig size={22} />
                </span>
                <h3 className="font-display">Thanks!</h3>
                <p>
                  We read every submission. Your feedback shapes what ships next in Master Closer.
                </p>
                <button
                  type="button"
                  className="pm-cta pm-cta-outline"
                  onClick={() => setFeedbackOpen(false)}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-display fb-title">Help Us Improve Master Closer</h3>
                <p className="fb-sub">
                  Found something confusing? Missing a feature? Have an idea? We read every submission —
                  and many updates come straight from customer feedback.
                </p>

                <div className="fb-cats">
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={category === c}
                      data-on={category === c}
                      className="fb-cat"
                      onClick={() => setCategory(category === c ? null : c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <textarea
                  className="fb-text"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe your idea or issue… What were you trying to do? What would make it better?"
                />

                <div className="fb-row">
                  <button
                    type="button"
                    className="fb-improve"
                    disabled={polishing}
                    onClick={() => void improve()}
                  >
                    {polishing ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    {polishing ? "Improving…" : "Improve My Feedback"}
                  </button>
                </div>

                <button
                  type="button"
                  className="pm-cta pm-cta-primary fb-submit"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? "Submitting…" : "Submit Feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Item({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="pm-row" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
