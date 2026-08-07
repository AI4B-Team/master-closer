/** Shared, browser-safe agreement helpers: merge tokens, status tones, formatting. */

export const MERGE_TOKENS = [
  { token: "{{lead_name}}", label: "Lead Name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{email}}", label: "Email" },
  { token: "{{phone}}", label: "Phone" },
  { token: "{{amount}}", label: "Amount" },
  { token: "{{deposit}}", label: "Deposit" },
  { token: "{{currency}}", label: "Currency" },
  { token: "{{rep_name}}", label: "Closer Name" },
  { token: "{{org_name}}", label: "Workspace Name" },
  { token: "{{date}}", label: "Today's Date" },
] as const;

export type MergeValues = Record<string, string>;

/** Replaces every {{token}} with its value; unknown tokens are left visible so nothing ships blank silently. */
export function applyMerge(body: string, values: MergeValues) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const v = values[key.toLowerCase()];
    return v === undefined || v === "" ? full : v;
  });
}

export function remainingTokens(body: string) {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) found.add(`{{${m[1]!.toLowerCase()}}}`);
  return [...found];
}

export const DEFAULT_AGREEMENT_BODY = `SERVICE AGREEMENT

This agreement is made on {{date}} between {{org_name}} ("Provider") and {{lead_name}} of {{company}} ("Client").

1. SCOPE
Provider will deliver the services discussed on the recorded call of {{date}}, as scoped by {{rep_name}}.

2. FEES
Total investment: {{currency}} {{amount}}. A deposit of {{currency}} {{deposit}} is due on signature, with the balance billed to the payment method on file.

3. TERM
Work begins within five business days of signature and continues until the scope above is complete.

4. CONSENT & RECORDING
Client acknowledges the call was recorded with disclosure and consents to that record forming part of this agreement.

5. ACCEPTANCE
Signing below confirms Client has read and accepts these terms and authorizes the payment method on file.

Signed by: {{lead_name}}
Email: {{email}}
Phone: {{phone}}`;

export type AgreementStatus = "draft" | "sent" | "viewed" | "signed" | "declined" | "void";

export const STATUS_TONE: Record<AgreementStatus, "neutral" | "blue" | "amber" | "green" | "red"> = {
  draft: "neutral",
  sent: "blue",
  viewed: "amber",
  signed: "green",
  declined: "red",
  void: "neutral",
};

export function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function signingUrl(token: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/sign/${token}`;
}
