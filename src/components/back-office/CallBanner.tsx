import { Mic, MicOff, Pause, PhoneForwarded, PhoneOff, Radio, UserPlus } from "lucide-react";

export type CallMode = "full_ai" | "hybrid" | "copilot";

const MODES: { key: CallMode; label: string }[] = [
  { key: "full_ai", label: "AI" },
  { key: "hybrid", label: "Hybrid" },
  { key: "copilot", label: "Copilot" },
];

export function CallBanner({
  name,
  phone,
  campaign,
  timer,
  mode,
  onModeChange,
  onEnd,
  muted,
  onToggleMute,
  onHold,
  onMerge,
  onTransfer,
}: {
  name: string;
  phone: string;
  campaign?: string;
  timer: string;
  mode: CallMode;
  onModeChange: (m: CallMode) => void;
  onEnd?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  onHold?: () => void;
  onMerge?: () => void;
  onTransfer?: () => void;
}) {
  return (
    <div className="banner">
      <div className="banner-lead">
        <div className="banner-name">
          <span className="font-display">{name}</span>
          <span className="banner-num font-num">{phone}</span>
          <span className="banner-live-dot" />
          {campaign && <span className="banner-camp">{campaign}</span>}
        </div>
        <div className="banner-status font-num">
          <Radio size={12} /> Ongoing {timer}
        </div>
      </div>

      <div className="banner-mid">
        <span className="banner-mode-label">MODE</span>
        <div className="mode-seg">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={"mode-btn " + (mode === m.key ? "mode-on" : "")}
              onClick={() => onModeChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="banner-actions">
        <button type="button" className="banner-act" onClick={onMerge}>
          <UserPlus size={16} />
          <span>Merge</span>
        </button>
        <button type="button" className="banner-act" onClick={onTransfer}>
          <PhoneForwarded size={16} />
          <span>Transfer</span>
        </button>
        <button
          type="button"
          className={"banner-icon " + (muted ? "on" : "")}
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button type="button" className="banner-icon" onClick={onHold} aria-label="Hold">
          <Pause size={16} />
        </button>
        <button type="button" className="banner-end" onClick={onEnd}>
          <PhoneOff size={15} /> End Call
        </button>
      </div>
    </div>
  );
}
