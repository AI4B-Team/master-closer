import { usePrefs } from "@/hooks/use-prefs";
import type { CSSProperties, ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";

/* Shared Hooked-style primitives for the back office. */

const AVATAR_COLORS = ["#0E9F6E", "#2563EB", "#CC0000", "#D97706", "#7C3AED", "#111318"];

export function initialsOf(text: string) {
  return (text || "?")
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function titleCase(text: string) {
  return String(text ?? "")
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const seed = Array.from(name || "?").reduce((s, c) => s + c.charCodeAt(0), 0);
  const color = AVATAR_COLORS[seed % AVATAR_COLORS.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color }}>
      {initialsOf(name)}
    </span>
  );
}

const PILL_TONES = {
  red: { background: "#FBEAEA", color: "#CC0000" },
  green: { background: "#E6F6EE", color: "#0E9F6E" },
  blue: { background: "#EAF0FB", color: "#2563EB" },
  amber: { background: "#FDF2E3", color: "#B45309" },
  neutral: { background: "#F0F1F4", color: "#4A505C" },
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  return (
    <span className="pill" style={PILL_TONES[tone]}>
      {label}
    </span>
  );
}

/** Maps common CRM statuses/stages to a pill tone. */
export function toneForStatus(status?: string | null): PillTone {
  const s = (status ?? "").toLowerCase();
  if (["won", "closed", "completed", "connected", "active"].some((k) => s.includes(k))) return "green";
  if (["missed", "lost", "failed", "dnc", "no_answer"].some((k) => s.includes(k))) return "red";
  if (["open", "new", "in_progress", "contacted"].some((k) => s.includes(k))) return "blue";
  if (["pending", "qualified", "proposal", "negotiation"].some((k) => s.includes(k))) return "amber";
  return "neutral";
}

export function Kpi({
  label,
  value,
  icon: Icon,
  tint,
  iconColor,
  delta,
  up = true,
  to,
  search,
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  icon: any;
  tint: string;
  iconColor: string;
  delta?: string;
  up?: boolean;
  to?: string;
  search?: Record<string, unknown>;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <div className="kpi-top">
        <span className="kpi-ico" style={{ color: iconColor }}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
        {delta && (
          <span className={"kpi-delta " + (up ? "up" : "down")}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta}
          </span>
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="font-num kpi-value">{value}</div>
    </>
  );

  const cls = "kpi kpi-link" + (active ? " kpi-active" : "");
  const tintStyle = { "--kpi-tint": tint } as CSSProperties;

  if (to) {
    return (
      <Link to={to as any} search={search as any} className={cls} style={tintStyle}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls + " text-left"} style={tintStyle}>
        {body}
      </button>
    );
  }

  return (
    <div className="kpi" style={tintStyle}>
      {body}
    </div>
  );

}


export const KPI_TINTS = {
  blue: { tint: "#EAF0FB", iconColor: "#2563EB" },
  red: { tint: "#FBEAEA", iconColor: "#CC0000" },
  mint: { tint: "#E6F6EE", iconColor: "#0E9F6E" },
  lavender: { tint: "#F0EBFA", iconColor: "#7C3AED" },
} as const;

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"mc-card " + className}>
      {(title || action) && (
        <div className="card-head">
          {title && <h3 className="font-display card-h">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  const { t } = usePrefs();
  return (
    <div className="mc-empty">
      <Icon size={26} />
      <p className="font-display">{t(title)}</p>
      {hint && <span>{t(hint)}</span>}
    </div>
  );
}

export function EmptyPanel({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: any;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  const { t } = usePrefs();
  return (
    <div className="mc-empty-panel">
      <span className="mc-empty-ring" aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <p className="font-display">{t(title)}</p>
      {hint ? <span>{t(hint)}</span> : null}
      {action ? <div className="mc-empty-actions">{action}</div> : null}
    </div>
  );
}

/** Shimmering placeholder rows shown while a list query is in flight. */
export function SkeletonRows({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={"mc-skel " + className} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="mc-skel-row" key={i}>
          <span className="mc-skel-bar" style={{ width: "34%" }} />
          <span className="mc-skel-bar" style={{ width: "22%" }} />
          <span className="mc-skel-bar" style={{ width: "16%" }} />
          <span className="mc-skel-bar" style={{ width: "12%" }} />
        </div>
      ))}
    </div>
  );
}

/** Shimmering placeholder cards for grid/board layouts. */
export function SkeletonCards({ count = 6, height = 120 }: { count?: number; height?: number }) {
  return (
    <div className="mc-skel-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span className="mc-skel-card" key={i} style={{ height }} />
      ))}
    </div>
  );
}
