import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALLING_WINDOW,
  checkCallingWindow,
  nextOpenAt,
  normalizeWindow,
  resolveLeadTimezone,
  timezoneFromPhone,
} from "./calling-window";

describe("timezone resolution", () => {
  it("prefers the lead's own timezone", () => {
    expect(
      resolveLeadTimezone({ timezone: "America/Denver", phone: "+1 212 555 0134" }),
    ).toEqual({ timezone: "America/Denver", source: "lead_field" });
  });

  it("falls back to the area code", () => {
    expect(resolveLeadTimezone({ phone: "(415) 555-0134" }).timezone).toBe("America/Los_Angeles");
    expect(resolveLeadTimezone({ phone: "16025550134" }).timezone).toBe("America/Phoenix");
  });

  it("falls back to the workspace default for unknown numbers", () => {
    expect(resolveLeadTimezone({ phone: "555" }, "America/Chicago")).toEqual({
      timezone: "America/Chicago",
      source: "workspace_default",
    });
  });

  it("ignores short or missing numbers", () => {
    expect(timezoneFromPhone(null)).toBeNull();
    expect(timezoneFromPhone("415555")).toBeNull();
  });
});

describe("quiet hours run on the prospect's clock", () => {
  // 2026-08-10 is a Monday. 15:30 UTC = 11:30 Eastern, 08:30 Pacific.
  const monday1530Z = new Date("2026-08-10T15:30:00Z");

  it("allows a Pacific lead inside their own morning window", () => {
    const v = checkCallingWindow({ lead: { phone: "4155550134" }, at: monday1530Z });
    expect(v.allowed).toBe(true);
    expect(v.localTime).toBe("08:30");
  });

  it("blocks the same instant for a Pacific lead when the window opens at 9", () => {
    const v = checkCallingWindow({
      lead: { phone: "4155550134" },
      window: { ...DEFAULT_CALLING_WINDOW, start_minute: 9 * 60 },
      at: monday1530Z,
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("before_window");
    expect(v.message).toContain("9:00 AM");
  });

  it("does not let the caller's location change the verdict", () => {
    // 13:00 UTC = 06:00 Pacific — an Eastern desk at 9am must still be blocked.
    const v = checkCallingWindow({ lead: { phone: "2065550134" }, at: new Date("2026-08-10T13:00:00Z") });
    expect(v.allowed).toBe(false);
    expect(v.localTime).toBe("06:00");
  });

  it("blocks after the window closes", () => {
    // 03:30 UTC Tuesday = 22:30 Monday Central.
    const v = checkCallingWindow({ lead: { phone: "3125550134" }, at: new Date("2026-08-11T03:30:00Z") });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("after_window");
  });

  it("blocks days that are not in the window", () => {
    // 2026-08-09 is a Sunday.
    const v = checkCallingWindow({ lead: { phone: "2125550134" }, at: new Date("2026-08-09T15:00:00Z") });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe("closed_day");
  });

  it("reports the timezone source so the operator knows what it guessed", () => {
    expect(checkCallingWindow({ lead: { phone: "2125550134" }, at: monday1530Z }).timezoneSource).toBe("area_code");
    expect(
      checkCallingWindow({ lead: { phone: "555" }, at: monday1530Z }).timezoneSource,
    ).toBe("workspace_default");
  });
});

describe("window normalization", () => {
  it("never produces a window that cannot open", () => {
    const w = normalizeWindow({ start_minute: 1200, end_minute: 400, days: [] });
    expect(w.end_minute).toBeGreaterThan(w.start_minute);
    expect(w.days.length).toBeGreaterThan(0);
  });

  it("drops invalid weekdays and de-duplicates", () => {
    expect(normalizeWindow({ days: [1, 1, 9, -2, 3] }).days).toEqual([1, 3]);
  });
});

describe("next open time", () => {
  it("rolls a Sunday block forward to Monday morning", () => {
    const at = new Date("2026-08-09T15:00:00Z"); // Sunday
    const next = nextOpenAt({ lead: { timezone: "America/New_York" }, at });
    expect(next.getTime()).toBeGreaterThan(at.getTime());
    const v = checkCallingWindow({ lead: { timezone: "America/New_York" }, at: next });
    expect(v.allowed).toBe(true);
  });

  it("returns a time that passes the same gate for a Pacific lead", () => {
    const at = new Date("2026-08-10T13:00:00Z"); // 06:00 Pacific
    const next = nextOpenAt({ lead: { phone: "4155550134" }, at });
    expect(checkCallingWindow({ lead: { phone: "4155550134" }, at: next }).allowed).toBe(true);
  });
});
