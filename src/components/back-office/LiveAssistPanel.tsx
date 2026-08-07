import { useState } from "react";
import { ArrowUp, AudioLines, Lock, Sparkles } from "lucide-react";
import type { CallMode } from "./CallBanner";

export type AssistLine = { speaker: string; text: string; tone?: "disclosure" | "normal" };

const TAG: Record<CallMode, string> = {
  full_ai: "AI Says To Prospect",
  hybrid: "AI Briefs Your Closer",
  copilot: "Whispered To Your Rep",
};

export function LiveAssistPanel({
  mode,
  lines,
  suggestions,
  jurisdiction,
  delivered,
  locked,
  thinking,
  onAsk,
}: {
  mode: CallMode;
  lines: AssistLine[];
  suggestions: string[];
  jurisdiction: string;
  delivered: boolean;
  locked?: boolean;
  thinking?: boolean;
  onAsk?: (q: string) => void;
}) {
  const [live, setLive] = useState(true);
  const [q, setQ] = useState("");


  return (
    <aside className="assist">
      <div className="assist-head">
        <span className="assist-live">
          <span className="assist-dot" /> Live Transcription
        </span>
        <button
          type="button"
          className={"switch " + (live ? "on" : "")}
          onClick={() => setLive((v) => !v)}
          aria-label="Toggle live transcription"
        />
      </div>

      <div className={"assist-consent " + (delivered ? "" : "pending")}>
        <Lock size={12} />
        {delivered ? `Disclosure Delivered · ${jurisdiction}` : `Disclosure Pending · ${jurisdiction}`}
      </div>

      <div className="assist-scroll">
        {locked ? (
          <div className="mc-empty">
            <Lock size={22} />
            <p className="font-display">Live Surface Locked</p>
            <span>
              {jurisdiction} is an all-party consent state. Deliver the disclosure to reveal the
              transcript and suggestions.
            </span>
          </div>
        ) : !live ? (
          <div className="mc-empty">
            <AudioLines size={22} />
            <p className="font-display">Transcription Paused</p>
            <span>Turn the switch back on to resume the live feed.</span>
          </div>
        ) : (
          <>
            {lines.map((l, i) => (
              <div
                key={i}
                className={
                  "t-line " +
                  (l.speaker === "You" ? "t-you " : "") +
                  (l.tone === "disclosure" ? "t-disclosure" : "")
                }
              >
                <span className="t-name">
                  {l.speaker}
                  {l.tone === "disclosure" ? " · Disclosure" : ""}
                </span>
                <p>{l.text}</p>
              </div>
            ))}

            {suggestions.map((s, i) => (
              <div key={`s-${i}`} className="sugg">
                <div className="sugg-head">
                  <Sparkles size={13} strokeWidth={2.5} />
                  <span>{TAG[mode]}</span>
                </div>
                <p>{s}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          onAsk?.(q.trim());
          setQ("");
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Copilot Anything…" />
        <button type="submit" className="ask-send" aria-label="Send">
          <ArrowUp size={15} strokeWidth={2.5} />
        </button>
      </form>
    </aside>
  );
}
