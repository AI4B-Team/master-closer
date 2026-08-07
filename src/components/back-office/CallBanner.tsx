import { Mic, MicOff, Pause, PhoneForwarded, PhoneOff, Radio, UserPlus } from "lucide-react";

export type CallMode = "full_ai" | "hybrid" | "copilot";

const MODES: { key: CallMode; label: string }[] = [
  { key: "full_ai", label: "AI" },
  { key: "hybrid", label: "Hybrid" },
  { key: "copilot", label: "Copilot" },
];

const MODE_TIPS: Record<CallMode, string> = {
  full_ai: "AI runs the whole call on its own",
  hybrid: "AI opens, then hands off to your closer",
  copilot: "You lead, AI feeds you the next line",
};

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
        </div>
        <div className="banner-status font-num">
          <span className="banner-num font-num">{phone}</span>
          <span className="banner-live-dot" />
          {campaign && <span className="banner-camp">{campaign}</span>}
        </div>
        <div className="banner-status">
          <span className="banner-ongoing">
            <Radio size={12} /> Ongoing {timer}
          </span>
        </div>


      </div>

      <div className="banner-mid">
        <span className="banner-mode-label">MODE</span>
        <div className="mode-seg">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={"mode-btn has-tip " + (mode === m.key ? "mode-on" : "")}
              data-tip={MODE_TIPS[m.key]}
              onClick={() => onModeChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="banner-actions">
        <button type="button" className="banner-act has-tip" data-tip="Merge another line into this call" onClick={onMerge}>
          <UserPlus size={16} />
          <span>Merge</span>
        </button>
        <button type="button" className="banner-act has-tip" data-tip="Transfer the call to a teammate" onClick={onTransfer}>
          <PhoneForwarded size={16} />
          <span>Transfer</span>
        </button>
        <button
          type="button"
          className={"banner-icon has-tip " + (muted ? "on" : "")}
          data-tip={muted ? "Unmute your microphone" : "Mute your microphone"}
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button type="button" className="banner-icon has-tip" data-tip="Put the prospect on hold" onClick={onHold} aria-label="Hold">
          <Pause size={16} />
        </button>
        <button type="button" className="banner-end has-tip" data-tip="Hang up and wrap the call" onClick={onEnd}>
          <PhoneOff size={15} /> End Call
        </button>
      </div>
    </div>
  );
}
