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
