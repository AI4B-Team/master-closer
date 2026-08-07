import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

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
}: {
  label: string;
  value: string;
  icon: any;
  tint: string;
  iconColor: string;
  delta?: string;
  up?: boolean;
}) {
  return (
    <div className="kpi" style={{ background: tint }}>
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
  return (
    <div className="mc-empty">
      <Icon size={26} />
      <p className="font-display">{title}</p>
      {hint && <span>{hint}</span>}
    </div>
  );
}
