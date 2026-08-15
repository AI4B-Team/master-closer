/** Win detection for line performance reporting. */
const WIN_WORDS = ["won", "book", "appointment", "sale", "sold", "closed", "demo", "meeting"];

export function isWin(disposition: string | null) {
  if (!disposition) return false;
  const d = disposition.toLowerCase();
  return WIN_WORDS.some((w) => d.includes(w));
}
