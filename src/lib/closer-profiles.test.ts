import { describe, expect, it } from "vitest";
import {
  CATEGORICAL_ESCALATION,
  PLATFORM_BANNED_OUTPUT_PATTERNS,
  PLATFORM_HANDOFF_PATTERNS,
  ProfileResolutionError,
  assembleSystemPrompt,
  effectiveGuardrails,
  matchBannedOutput,
  matchHandoff,
  resolveCloserProfile,
  type CloserProfile,
} from "./closer-profiles";

function profile(over: Partial<CloserProfile> = {}): CloserProfile {
  return {
    id: over.id ?? crypto.randomUUID(),
    workspace_id: null,
    industry: "insurance",
    source: null,
    name: "Test Closer",
    is_default: false,
    opener: "Hi there.",
    context_framing: null,
    objections: [],
    screening_questions: [],
    faqs: [],
    tone: null,
    escalation_triggers: [],
    banned_topics: [],
    dispositions: [],
    ...over,
  };
}

describe("additive-only guardrails", () => {
  it("keeps every platform handoff pattern even when a profile tries to clear them", () => {
    const hostile = profile({ escalation_triggers: [], banned_topics: [] });
    const g = effectiveGuardrails(hostile);
    for (const pattern of PLATFORM_HANDOFF_PATTERNS) {
      expect(g.handoffPatterns).toContain(pattern);
    }
  });

  it("cannot disable a platform handoff pattern by naming it in the profile", () => {
    const hostile = profile({
      // An operator trying to neuter the platform rule from profile config.
      escalation_triggers: ["-stop calling", "allow: my lawyer"],
      banned_topics: ["none"],
    });
    expect(matchHandoff("Just stop calling me already", hostile)).toBeTruthy();
    expect(matchHandoff("I'm putting my lawyer on this", hostile)).toBeTruthy();
    expect(matchHandoff("I want to speak to a human", hostile)).toBeTruthy();
  });

  it("always enforces the banned-output filter", () => {
    const hostile = profile({ banned_topics: [] });
    for (const pattern of PLATFORM_BANNED_OUTPUT_PATTERNS) {
      expect(effectiveGuardrails(hostile).bannedOutputPatterns).toContain(pattern);
    }
    expect(matchBannedOutput("You are definitely approved today", hostile)).toBeTruthy();
    expect(matchBannedOutput("It is completely risk-free", hostile)).toBeTruthy();
    expect(matchBannedOutput("I'm a licensed agent", hostile)).toBeTruthy();
    expect(matchBannedOutput("Let me get the details on your policy", hostile)).toBeNull();
  });

  it("adds profile triggers on top of the platform set", () => {
    const strict = profile({ escalation_triggers: ["group plan"] });
    expect(matchHandoff("We need a group plan for 40 people", strict)).toBeTruthy();
    expect(matchHandoff("We need a group plan for 40 people", profile())).toBeNull();
  });

  it("always carries the categorical escalation list for the industry", () => {
    const g = effectiveGuardrails(profile({ industry: "real_estate", escalation_triggers: [] }));
    for (const topic of CATEGORICAL_ESCALATION.real_estate) {
      expect(g.escalationTopics).toContain(topic);
    }
  });
});

describe("resolution order", () => {
  const ws = "11111111-1111-1111-1111-111111111111";
  const industrySource = profile({ id: "a", workspace_id: ws, industry: "solar", source: "inbound" });
  const industryOnly = profile({ id: "b", workspace_id: ws, industry: "solar", source: null });
  const wsDefault = profile({ id: "c", workspace_id: ws, industry: null, is_default: true });
  const platform = profile({ id: "d", workspace_id: null, industry: "solar" });
  const all = [platform, wsDefault, industryOnly, industrySource];

  it("prefers industry plus source", () => {
    expect(resolveCloserProfile(all, { industry: "solar", source: "inbound" }).matchedBy).toBe(
      "workspace_industry_source",
    );
  });

  it("falls to industry only", () => {
    expect(resolveCloserProfile(all, { industry: "solar", source: "upload" }).matchedBy).toBe(
      "workspace_industry",
    );
  });

  it("falls to the workspace default", () => {
    expect(resolveCloserProfile(all, { industry: "recruiting", source: null }).matchedBy).toBe(
      "workspace_default",
    );
  });

  it("falls to the platform default when the workspace has none", () => {
    expect(
      resolveCloserProfile([platform], { industry: "solar", source: null }).matchedBy,
    ).toBe("platform_industry");
  });

  it("throws rather than serving a generic persona", () => {
    expect(() => resolveCloserProfile([], { industry: "solar", source: null })).toThrow(
      ProfileResolutionError,
    );
  });
});

describe("prompt assembly", () => {
  it("puts platform guardrails before the persona and the record after it", () => {
    const prompt = assembleSystemPrompt({
      profile: profile({ industry: "solar", opener: "Persona opener line." }),
      workspace: { name: "Cash Buyers", legal_business_name: "Cash Buyers LLC" },
      lead: { name: "Dana", company: "Northbridge" },
      mode: "hybrid",
    });
    const guardrails = prompt.indexOf("PLATFORM GUARDRAILS");
    const persona = prompt.indexOf("PERSONA");
    const record = prompt.indexOf("LEAD RECORD");
    expect(guardrails).toBeGreaterThanOrEqual(0);
    expect(persona).toBeGreaterThan(guardrails);
    expect(record).toBeGreaterThan(persona);
    expect(prompt).toContain("the only facts you may assert");
    expect(prompt).toContain("Cash Buyers LLC");
  });
});
