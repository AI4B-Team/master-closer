/** Shared CSV export helper for back-office tables. */

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(filename: string, csv: string) {
  // Prepend a BOM so Excel reads UTF-8 accents correctly.
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Revoke on the next tick; revoking synchronously cancels the download in
  // Firefox and Safari.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/** Date-stamped filename, e.g. master-closer-deals-2026-08-09.csv */
export function stampedName(slug: string) {
  return `master-closer-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/**
 * Parses CSV text into rows, honouring quoted fields (so values like
 * "Acme, Inc." or embedded newlines survive an import). Also strips a UTF-8
 * BOM and trims CRLF line endings. Blank rows are dropped.
 */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      pushRow();
      continue;
    }
    cell += c;
  }
  if (cell !== "" || row.length) pushRow();
  return rows;
}
