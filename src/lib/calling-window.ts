/**
 * Calling windows live in the prospect's local time, not the workspace's.
 *
 * A closer that dials 9am Pacific from an Eastern desk is calling someone at 6am.
 * Everything here resolves a lead to a timezone — explicit field first, then area
 * code, then the workspace default — and answers one question: may we dial now?
 */

export type CallingWindow = {
  /** Minutes after local midnight the window opens. 8:00 → 480. */
  start_minute: number;
  /** Minutes after local midnight the window closes. 21:00 → 1260. */
  end_minute: number;
  /** 0 = Sunday … 6 = Saturday. Days not listed are closed all day. */
  days: number[];
};

export const DEFAULT_CALLING_WINDOW: CallingWindow = {
  start_minute: 8 * 60,
  end_minute: 21 * 60,
  days: [1, 2, 3, 4, 5],
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const US_TIMEZONES = [
  { key: "America/New_York", label: "Eastern" },
  { key: "America/Chicago", label: "Central" },
  { key: "America/Denver", label: "Mountain" },
  { key: "America/Phoenix", label: "Arizona" },
  { key: "America/Los_Angeles", label: "Pacific" },
  { key: "America/Anchorage", label: "Alaska" },
  { key: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export function timezoneLabel(tz?: string | null) {
  return US_TIMEZONES.find((t) => t.key === tz)?.label ?? tz ?? "Unknown";
}

/**
 * Area code → IANA zone. Deliberately partial: an unmapped area code falls
 * through to the workspace default rather than guessing a permissive zone.
 */
const AREA_CODE_TZ: Record<string, string> = {};
function mapCodes(zone: string, codes: string[]) {
  for (const code of codes) AREA_CODE_TZ[code] = zone;
}
mapCodes("America/New_York", [
  "201","202","203","207","212","215","216","220","223","229","234","239","240","267","272","276","301","302","304","305","321","326","330","332","339","346","347","351","352","364","380","386","401","404","407","410","412","413","419","423","434","440","443","445","470","475","478","484","513","516","518","540","551","557","561","567","570","571","585","586","592","603","606","607","609","610","614","615","616","617","631","646","667","678","680","681","689","703","704","706","716","717","718","724","727","732","734","737","740","743","754","757","762","770","772","774","781","786","802","803","804","810","813","814","820","828","829","835","839","843","845","848","850","854","856","857","859","862","863","864","865","878","904","908","910","912","914","915","917","919","929","931","937","941","947","954","959","970","971","973","978","980","984","989",
]);
mapCodes("America/Chicago", [
  "205","210","214","217","224","251","256","262","270","281","309","312","314","316","318","319","320","325","331","334","337","361","402","405","409","414","417","430","432","447","463","469","479","501","502","504","507","512","515","531","539","563","573","580","601","608","612","615","618","620","630","636","641","651","657","659","660","662","682","708","712","713","715","731","737","763","769","773","779","785","806","808","812","815","816","817","830","832","870","901","903","913","918","920","925","930","936","940","945","952","956","972","979","985",
]);
mapCodes("America/Denver", [
  "303","307","308","385","406","435","505","575","719","720","801","970",
]);
mapCodes("America/Phoenix", ["480", "520", "602", "623", "928"]);
mapCodes("America/Los_Angeles", [
  "206","209","213","253","279","310","323","341","360","408","415","424","425","442","458","503","509","510","530","541","559","619","626","628","650","657","661","669","702","707","714","725","747","753","760","775","805","818","820","831","840","858","909","916","924","925","935","949","951","971",
]);
mapCodes("America/Anchorage", ["907"]);
mapCodes("Pacific/Honolulu", ["808"]);

export function timezoneFromPhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length < 10) return null;
  return AREA_CODE_TZ[national.slice(0, 3)] ?? null;
}

export type TimezoneSource = "lead_field" | "area_code" | "workspace_default";

export function resolveLeadTimezone(
  lead: { timezone?: string | null; phone?: string | null },
  workspaceDefault = "America/New_York",
): { timezone: string; source: TimezoneSource } {
  if (lead.timezone) return { timezone: lead.timezone, source: "lead_field" };
  const fromPhone = timezoneFromPhone(lead.phone);
  if (fromPhone) return { timezone: fromPhone, source: "area_code" };
  return { timezone: workspaceDefault, source: "workspace_default" };
}

/** Local wall-clock weekday and minute-of-day for an instant in a given zone. */
export function localClock(at: Date, timezone: string): { weekday: number; minute: number; label: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = Math.max(0, WEEKDAY_LABELS.indexOf(get("weekday")));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    weekday,
    minute: hour * 60 + minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export function formatMinute(minute: number) {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export type WindowVerdict = {
  allowed: boolean;
  timezone: string;
  timezoneSource: TimezoneSource;
  /** Prospect's local time, e.g. "06:12". */
  localTime: string;
  localWeekday: string;
  reason: "inside_window" | "before_window" | "after_window" | "closed_day";
  message: string;
};

/**
 * The single gate every dial path must pass through. Quiet hours are evaluated
 * against the prospect's local clock, so the answer does not change with the
 * caller's location.
 */
export function checkCallingWindow(input: {
  lead: { timezone?: string | null; phone?: string | null };
  window?: CallingWindow | null;
  workspaceDefaultTimezone?: string | null;
  at?: Date;
}): WindowVerdict {
  const win = normalizeWindow(input.window);
  const { timezone, source } = resolveLeadTimezone(
    input.lead,
    input.workspaceDefaultTimezone ?? "America/New_York",
  );
  const now = input.at ?? new Date();
  const clock = localClock(now, timezone);
  const weekdayLabel = WEEKDAY_LABELS[clock.weekday]!;
  const base = {
    timezone,
    timezoneSource: source,
    localTime: clock.label,
    localWeekday: weekdayLabel,
  };

  if (!win.days.includes(clock.weekday)) {
    return {
      ...base,
      allowed: false,
      reason: "closed_day",
      message: `${weekdayLabel} is outside your calling days for ${timezoneLabel(timezone)} leads.`,
    };
  }
  if (clock.minute < win.start_minute) {
    return {
      ...base,
      allowed: false,
      reason: "before_window",
      message: `It is ${clock.label} for this lead. Calling opens at ${formatMinute(win.start_minute)} local.`,
    };
  }
  if (clock.minute >= win.end_minute) {
    return {
      ...base,
      allowed: false,
      reason: "after_window",
      message: `It is ${clock.label} for this lead. Calling closed at ${formatMinute(win.end_minute)} local.`,
    };
  }
  return {
    ...base,
    allowed: true,
    reason: "inside_window",
    message: `${clock.label} local for this lead — inside your calling window.`,
  };
}

export function normalizeWindow(win?: Partial<CallingWindow> | null): CallingWindow {
  const start = clampMinute(win?.start_minute ?? DEFAULT_CALLING_WINDOW.start_minute);
  const endRaw = clampMinute(win?.end_minute ?? DEFAULT_CALLING_WINDOW.end_minute);
  const days = (win?.days && win.days.length ? win.days : DEFAULT_CALLING_WINDOW.days)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  return {
    start_minute: start,
    // A window that ends before it starts would never open; keep it a real span.
    end_minute: endRaw > start ? endRaw : Math.min(1440, start + 60),
    days: days.length ? Array.from(new Set(days)) : DEFAULT_CALLING_WINDOW.days,
  };
}

function clampMinute(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1440, Math.max(0, Math.round(v)));
}

/**
 * Next moment the window opens for this lead, so a blocked dial becomes a
 * scheduled follow-up instead of a dead end.
 */
export function nextOpenAt(input: {
  lead: { timezone?: string | null; phone?: string | null };
  window?: CallingWindow | null;
  workspaceDefaultTimezone?: string | null;
  at?: Date;
}): Date {
  const win = normalizeWindow(input.window);
  const { timezone } = resolveLeadTimezone(
    input.lead,
    input.workspaceDefaultTimezone ?? "America/New_York",
  );
  const start = input.at ?? new Date();
  // Step in 15-minute increments for up to 8 days: cheap, DST-safe, and exact enough
  // for a follow-up time a human will read.
  for (let i = 0; i <= 8 * 24 * 4; i++) {
    const probe = new Date(start.getTime() + i * 15 * 60_000);
    const clock = localClock(probe, timezone);
    if (win.days.includes(clock.weekday) && clock.minute >= win.start_minute && clock.minute < win.end_minute) {
      return probe;
    }
  }
  return new Date(start.getTime() + 24 * 60 * 60_000);
}
