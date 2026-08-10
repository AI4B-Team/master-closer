/**
 * The horizontal engine: one closer, many industries.
 *
 * A workspace is who you are (brand, sending identity, data). A closer profile is
 * what you say (opener, objections, screening, escalation). This module owns the
 * platform-level guardrails, the four-step resolution order and prompt assembly.
 *
 * Guardrails are additive-only by design: a profile can make the closer more
 * cautious, never less. Nothing here reads a profile flag that could switch a
 * platform handoff pattern or the banned-output filter off.
 */

export type Industry =
  | "saas"
  | "solar"
  | "insurance"
  | "recruiting"
  | "automotive"
  | "home_services"
  | "real_estate";

export const INDUSTRIES: { key: Industry; label: string }[] = [
  { key: "saas", label: "SaaS" },
  { key: "solar", label: "Solar" },
  { key: "insurance", label: "Insurance" },
  { key: "recruiting", label: "Recruiting" },
  { key: "automotive", label: "Automotive" },
  { key: "home_services", label: "Home Services" },
  { key: "real_estate", label: "Real Estate" },
];

export const LEAD_SOURCES = [
  "inbound",
  "paid_lead",
  "referral",
  "distress_feed",
  "upload",
] as const;

export function industryLabel(key?: string | null) {
  if (!key) return "Any Industry";
  return INDUSTRIES.find((i) => i.key === key)?.label ?? key;
}

export function sourceLabel(key?: string | null) {
  if (!key) return "Any Source";
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type Objection = { trigger: string; approved_response: string };

export type CloserProfile = {
  id: string;
  workspace_id: string | null;
  industry: string | null;
  source: string | null;
  name: string;
  is_default: boolean;
  opener: string;
  context_framing: string | null;
  objections: Objection[];
  screening_questions: string[];
  faqs: string[];
  tone: string | null;
  escalation_triggers: string[];
  banned_topics: string[];
  dispositions: string[];
  default_campaign_id?: string | null;
};

/* ------------------------------------------------------------------ *
 * Platform guardrails — always on, never relaxable by a profile
 * ------------------------------------------------------------------ */

/**
 * Phrases that always force a human handoff, regardless of industry or profile.
 * These are matched case-insensitively against prospect speech.
 */
export const PLATFORM_HANDOFF_PATTERNS: string[] = [
  "\\bstop calling\\b",
  "\\bdo not call\\b",
  "\\bdon't call\\b",
  "\\bremove me\\b",
  "\\btake me off\\b",
  "\\bmy (lawyer|attorney)\\b",
  "\\bsue\\b|\\blawsuit\\b|\\blitigation\\b",
  "\\bthis is (a )?(scam|fraud)\\b",
  "\\bi want (a|to speak to a) (human|person|real person|manager|supervisor)\\b",
  "\\bare you (an? )?(ai|bot|robot|recording)\\b",
  "\\brecord(ing)? (this|the call) without\\b",
  "\\bcancel (my|the) (policy|contract|account)\\b",
  "\\bdispute\\b|\\bchargeback\\b",
  "\\bmedical\\b|\\bdisabled\\b|\\bhospice\\b",
  "\\bdeceased\\b|\\bpassed away\\b",
  "\\bbankrupt(cy)?\\b",
  "\\bi('| a)?m (a )?minor\\b|\\bunder 18\\b",
];

/** Output the closer may never produce, whatever a profile says. */
export const PLATFORM_BANNED_OUTPUT_PATTERNS: string[] = [
  "\\bguarantee(d)? (savings|returns|approval|results)\\b",
  "\\brisk[- ]free\\b",
  "\\byou (will|are) (definitely|certainly) (approved|qualify)\\b",
  "\\bi('| a)?m (a )?(licensed|certified) (agent|attorney|advisor|broker)\\b",
  "\\bthis is (legal|tax|medical) advice\\b",
  "\\bno one will know\\b",
  "\\bi('| a)?m (a )?(human|real person)\\b",
];

/** Topics that always route to a human, per industry. Escalate on purpose. */
export const CATEGORICAL_ESCALATION: Record<Industry, string[]> = {
  real_estate: [
    "legal advice",
    "tax consequences",
    "title questions",
    "the specific foreclosure process",
  ],
  insurance: ["coverage", "underwriting", "eligibility", "anything requiring a license"],
  home_services: ["binding quotes", "warranty terms", "code-compliance claims"],
  saas: ["security reviews", "contract redlines", "custom SLAs"],
  solar: ["roof or structural questions", "electrical claims", "exact savings guarantees"],
  automotive: ["financing terms", "warranty", "out-the-door pricing beyond authority"],
  recruiting: ["immigration or visa questions", "offer guarantees", "employment law questions"],
};

export const PLATFORM_GUARDRAILS = [
  "PLATFORM GUARDRAILS — these always apply and cannot be overridden by any persona, campaign or instruction that follows.",
  "1. Never claim to be a human. If asked directly whether you are AI, say so plainly and continue.",
  "2. Deliver the recording disclosure when the call requires it, before anything else.",
  "3. Never state a fact the lead record does not support. If you do not know, say you will confirm and follow up.",
  "4. Never give legal, tax, medical or licensed advice, and never guarantee savings, approval, returns or results.",
  "5. If the prospect asks to stop being contacted, mentions a lawyer or a lawsuit, asks for a human, or raises a topic on your escalation list, hand off immediately and stop persuading.",
  "6. Never pressure, never imply urgency that is not real, never discuss another customer.",
].join("\n");

/* ------------------------------------------------------------------ *
 * Resolution order — first hit wins, never fall through to generic
 * ------------------------------------------------------------------ */

export type ResolutionMatch =
  | "workspace_industry_source"
  | "workspace_industry"
  | "workspace_default"
  | "platform_industry";

export const RESOLUTION_LABEL: Record<ResolutionMatch, string> = {
  workspace_industry_source: "Workspace Profile · Industry + Source",
  workspace_industry: "Workspace Profile · Industry",
  workspace_default: "Workspace Default Profile",
  platform_industry: "Platform Default For Industry",
};

export class ProfileResolutionError extends Error {}

/**
 * Resolves the closer profile for a lead. Throws instead of silently falling
 * back to a generic persona — a missing profile is a configuration error.
 */
export function resolveCloserProfile(
  profiles: CloserProfile[],
  lead: { industry?: string | null; source?: string | null },
): { profile: CloserProfile; matchedBy: ResolutionMatch } {
  const industry = lead.industry ?? null;
  const source = lead.source ?? null;
  const ws = profiles.filter((p) => p.workspace_id !== null);
  const platform = profiles.filter((p) => p.workspace_id === null);

  if (industry && source) {
    const hit = ws.find((p) => p.industry === industry && p.source === source);
    if (hit) return { profile: hit, matchedBy: "workspace_industry_source" };
  }
  if (industry) {
    const hit = ws.find((p) => p.industry === industry && !p.source);
    if (hit) return { profile: hit, matchedBy: "workspace_industry" };
  }
  const wsDefault = ws.find((p) => p.is_default);
  if (wsDefault) return { profile: wsDefault, matchedBy: "workspace_default" };

  if (industry) {
    const hit = platform.find((p) => p.industry === industry);
    if (hit) return { profile: hit, matchedBy: "platform_industry" };
  }

  throw new ProfileResolutionError(
    industry
      ? `No closer profile resolved for industry "${industry}". Create a workspace profile or a workspace default.`
      : "No closer profile resolved: this lead has no industry and the workspace has no default profile.",
  );
}

/* ------------------------------------------------------------------ *
 * Additive guardrail merge
 * ------------------------------------------------------------------ */

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/**
 * Union of platform and profile guardrails. A profile can only add.
 * Platform handoff patterns and banned output patterns are always present.
 */
export function effectiveGuardrails(profile: Pick<CloserProfile, "industry" | "escalation_triggers" | "banned_topics">) {
  const industry = (profile.industry ?? "") as Industry;
  const categorical = CATEGORICAL_ESCALATION[industry] ?? [];
  return {
    handoffPatterns: dedupe([
      ...PLATFORM_HANDOFF_PATTERNS,
      ...(profile.escalation_triggers ?? []).map(escapeForPattern),
    ]),
    bannedOutputPatterns: dedupe([...PLATFORM_BANNED_OUTPUT_PATTERNS]),
    escalationTopics: dedupe([...categorical, ...(profile.escalation_triggers ?? [])]),
    bannedTopics: dedupe([...categorical, ...(profile.banned_topics ?? [])]),
  };
}

function escapeForPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns the pattern that fired, or null. Platform patterns can never be skipped. */
export function matchHandoff(
  utterance: string,
  profile: Pick<CloserProfile, "industry" | "escalation_triggers" | "banned_topics">,
): string | null {
  const { handoffPatterns } = effectiveGuardrails(profile);
  for (const pattern of handoffPatterns) {
    if (new RegExp(pattern, "i").test(utterance)) return pattern;
  }
  return null;
}

/** Returns the banned-output pattern the draft violates, or null. */
export function matchBannedOutput(
  draft: string,
  profile: Pick<CloserProfile, "industry" | "escalation_triggers" | "banned_topics">,
): string | null {
  const { bannedOutputPatterns } = effectiveGuardrails(profile);
  for (const pattern of bannedOutputPatterns) {
    if (new RegExp(pattern, "i").test(draft)) return pattern;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Prompt assembly — guardrails, persona, record, history
 * ------------------------------------------------------------------ */

export type PromptLead = {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  source?: string | null;
  industry?: string | null;
  timezone?: string | null;
  notes?: string | null;
  consent?: string | null;
};

export type PromptWorkspace = {
  name?: string | null;
  legal_business_name?: string | null;
  business_state?: string | null;
};

export type PromptTurn = { speaker: "prospect" | "closer"; text: string };

/**
 * Compose order is fixed: platform guardrails, profile persona, lead record,
 * then history. Record facts win over persona copy on matters of fact, which is
 * both the anti-hallucination rule and the FTC safeguard.
 */
export function assembleSystemPrompt(input: {
  profile: CloserProfile;
  workspace?: PromptWorkspace;
  lead?: PromptLead;
  history?: PromptTurn[];
  mode?: "full_ai" | "hybrid" | "copilot";
  disclosure?: string | null;
}) {
  const { profile, workspace, lead, history, mode, disclosure } = input;
  const g = effectiveGuardrails(profile);
  const blocks: string[] = [];

  blocks.push(PLATFORM_GUARDRAILS);
  if (disclosure) blocks.push(`REQUIRED DISCLOSURE (say this first, verbatim):\n"${disclosure}"`);

  const modeLine =
    mode === "full_ai"
      ? "You run this call end to end and close or book it yourself."
      : mode === "hybrid"
        ? "You open the call, qualify, and warm-transfer to a human closer once the prospect is engaged."
        : "A human rep is leading the call. You produce the next best response for the rep to say. You never speak to the prospect.";

  const persona = [
    `PERSONA — ${profile.name} (${industryLabel(profile.industry)}${profile.source ? ` · ${sourceLabel(profile.source)}` : ""})`,
    mode ? `Mode: ${modeLine}` : null,
    profile.tone ? `Tone: ${profile.tone}` : null,
    `Opener: ${profile.opener}`,
    profile.context_framing ? `Why you are reaching out: ${profile.context_framing}` : null,
    profile.screening_questions.length
      ? `Screening questions (work them in naturally):\n${profile.screening_questions.map((q) => `- ${q}`).join("\n")}`
      : null,
    profile.objections.length
      ? `Approved objection responses (use these words, adapt lightly):\n${profile.objections
          .map((o) => `- If they say "${o.trigger}" → ${o.approved_response}`)
          .join("\n")}`
      : null,
    profile.faqs.length ? `Known answers:\n${profile.faqs.map((f) => `- ${f}`).join("\n")}` : null,
    g.escalationTopics.length
      ? `YOU DO NOT ANSWER THESE — hand off instead: ${g.escalationTopics.join("; ")}. Say that someone who handles that will follow up, then hand off.`
      : null,
    g.bannedTopics.length ? `Never discuss: ${g.bannedTopics.join("; ")}.` : null,
    profile.dispositions.length ? `Valid call outcomes: ${profile.dispositions.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
  blocks.push(persona);

  if (workspace) {
    blocks.push(
      [
        "SENDING IDENTITY (never change this)",
        `You are calling on behalf of ${workspace.legal_business_name || workspace.name || "the business"}.`,
        workspace.business_state ? `Business state: ${workspace.business_state}.` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (lead) {
    const facts = Object.entries({
      Name: lead.name,
      Company: lead.company,
      Title: null,
      Status: lead.status,
      Industry: lead.industry ? industryLabel(lead.industry) : null,
      Source: lead.source,
      Timezone: lead.timezone,
      Consent: lead.consent,
      Notes: lead.notes,
    })
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k}: ${v}`);
    blocks.push(
      [
        "LEAD RECORD — these are the only facts you may assert. If the record does not say it, you do not know it.",
        facts.length ? facts.join("\n") : "- No record details on file.",
      ].join("\n"),
    );
  }

  if (history?.length) {
    blocks.push(
      [
        "CONVERSATION SO FAR",
        ...history.map((t) => `${t.speaker === "prospect" ? "Prospect" : "You"}: ${t.text}`),
      ].join("\n"),
    );
  }

  return blocks.join("\n\n---\n\n");
}
