/**
 * Comparison key for two numbers that may be written differently, e.g. a typed
 * "(305) 555-1234" and Core's E.164 "+13055551234". North American numbers
 * compare on their 10 digits so the country code never hides a match.
 */
export function phoneKey(raw?: string | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/** Format phone numbers with dashes by default: +1 917-555-0199 */
export function formatPhone(raw?: string | null): string {
  if (!raw) return "—";
  const trimmed = String(raw).trim();
  const ext = trimmed.match(/(?:x|ext\.?)\s*(\d+)\s*$/i)?.[1] ?? null;
  const digits = trimmed.replace(/\D/g, "");
  const core = ext ? digits.slice(0, digits.length - ext.length) : digits;

  let out: string | null = null;
  if (core.length === 10) {
    out = `${core.slice(0, 3)}-${core.slice(3, 6)}-${core.slice(6)}`;
  } else if (core.length === 11 && core.startsWith("1")) {
    const n = core.slice(1);
    out = `+1 ${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  } else if (core.length > 11 && trimmed.startsWith("+")) {
    // Unknown international format: keep country code, dash-group the rest.
    const cc = core.slice(0, core.length - 10);
    const n = core.slice(-10);
    out = `+${cc} ${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  }

  const base = out ?? trimmed;
  return ext ? `${base} x${ext}` : base;
}
