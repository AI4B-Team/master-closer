/** Browser-only helpers for sharing an agreement by email and printing a signed copy. */

import { money } from "./agreements";

export type PrintableAgreement = {
  title: string;
  body: string;
  amount: number;
  currency: string;
  orgName?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAt?: string | null;
  signatureType?: string | null;
  signatureData?: string | null;
  signerIp?: string | null;
};

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Opens a print-ready certificate window; the browser's print dialog handles "Save as PDF". */
export function printSignedCopy(a: PrintableAgreement) {
  const signature =
    a.signatureType === "drawn" && a.signatureData
      ? `<img src="${esc(a.signatureData)}" alt="Signature" style="height:70px" />`
      : `<div style="font-family:cursive;font-size:30px">${esc(a.signatureData ?? a.signerName ?? "")}</div>`;

  const signedBlock = a.signedAt
    ? `<div class="cert">
         <div class="cert-title">Certificate Of Signature</div>
         ${signature}
         <table>
           <tr><td>Signed By</td><td>${esc(a.signerName)}</td></tr>
           <tr><td>Email</td><td>${esc(a.signerEmail)}</td></tr>
           <tr><td>Signed At</td><td>${esc(new Date(a.signedAt).toLocaleString())}</td></tr>
           <tr><td>Method</td><td>${a.signatureType === "drawn" ? "Drawn Signature" : "Typed Signature"}</td></tr>
           <tr><td>IP Address</td><td>${esc(a.signerIp ?? "n/a")}</td></tr>
         </table>
       </div>`
    : `<div class="cert"><div class="cert-title">Unsigned Copy</div><p>This document has not been signed yet.</p></div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(a.title)}</title>
<style>
  body { font-family: Inter, -apple-system, Segoe UI, sans-serif; color:#111318; margin:0; padding:48px; }
  h1 { font-size:24px; letter-spacing:-0.02em; margin:0 0 4px; }
  .sub { color:#6B6B76; font-size:13px; margin-bottom:28px; }
  pre { white-space:pre-wrap; font-family:inherit; font-size:13px; line-height:1.8; }
  .cert { margin-top:32px; border:1px solid #EDEDF1; border-radius:14px; padding:20px; page-break-inside:avoid; }
  .cert-title { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#6B6B76; margin-bottom:12px; }
  table { border-collapse:collapse; margin-top:12px; font-size:12px; }
  td { padding:4px 18px 4px 0; vertical-align:top; }
  td:first-child { color:#6B6B76; }
</style></head><body>
<h1>${esc(a.title)}</h1>
<div class="sub">Prepared by ${esc(a.orgName ?? "Master Closer")} · ${esc(money(Number(a.amount ?? 0), a.currency || "USD"))}</div>
<pre>${esc(a.body)}</pre>
${signedBlock}
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** Prefilled email to the signer with the signing link — works with whatever mail client the closer uses. */
export function emailSigningLink(opts: {
  to?: string | null;
  title: string;
  link: string;
  orgName?: string | null;
  amount?: number;
  currency?: string;
}) {
  const subject = `${opts.title} — Ready For Your Signature`;
  const body = [
    `Hi${opts.to ? "" : " there"},`,
    "",
    `Here is the agreement we went over${opts.amount ? ` (${money(Number(opts.amount), opts.currency || "USD")})` : ""}.`,
    "You can review and sign it here:",
    opts.link,
    "",
    "It takes less than a minute — just type or draw your signature.",
    "",
    `Thank you,`,
    opts.orgName ?? "Master Closer",
  ].join("\n");
  const url = `mailto:${encodeURIComponent(opts.to ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}
