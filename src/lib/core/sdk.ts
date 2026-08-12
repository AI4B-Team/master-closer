/**
 * Core client SDK for Master Closer.
 *
 * Mirrors the real Core surface (verified against the CORE API source, not a
 * spec document). Core owns every capability reachable through this client —
 * there is deliberately no local fallback, stub, or cache behind any method.
 *
 *   const core = createCoreClient({ baseUrl, token })
 *   await core.policy.assertBulk({ ... })
 *
 * Auth: `token` is either a per-app service credential (`core_sk_...`) or a
 * Core-issued user JWT.
 */

export type PolicyAction = "send" | "call" | "offer" | "negotiate" | "sign";
export type ActorType = "user" | "ai" | "automation";
export type SuppressionChannel = "sms" | "email" | "voice" | "messenger" | "all";

export interface CoreClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

export interface AssertInput {
  workspace_id: string;
  action: PolicyAction;
  channel?: string;
  identifier?: string;
  contact_id?: string;
  actor_type: ActorType;
  actor_id?: string;
}

export interface AssertResult {
  decision: "allow" | "allow_with_announcement" | "deny";
  policy_check_id: string;
  denied_by?: string;
  reason?: string;
  rules_evaluated: { rule: string; result: string; detail?: string }[];
}

export interface AssertBulkInput {
  workspace_id: string;
  action: PolicyAction;
  channel?: string;
  /** Max 1000 per request. */
  identifiers: string[];
  actor_type: ActorType;
  actor_id?: string;
}

export interface AssertBulkResult {
  /** Always true. Bulk results are point-in-time and never authorize a send. */
  advisory_only: true;
  note: string;
  evaluated_at: string;
  results: {
    identifier: string;
    decision: "allow" | "deny" | "error";
    denied_by: string | null;
    reason: string | null;
    policy_check_id: string | null;
    error?: string;
  }[];
  summary: {
    total: number;
    allowed: number;
    denied: number;
    errors: number;
    denied_by_rule: Record<string, number>;
  };
}

export interface RecordInput {
  workspace_id: string;
  called_e164: string;
  contact_id?: string;
  actor_type?: ActorType;
  actor_id?: string;
}

export interface RecordResult {
  decision: "allow" | "allow_with_announcement" | "deny";
  consent_type: "one_party" | "all_party" | "unknown";
  requires_announcement: boolean;
  policy_check_id: string;
  called_state: string | null;
  rules_evaluated: { rule: string; result: string; detail?: string }[];
  denied_by?: string;
  reason?: string;
}

export interface Suppression {
  id: string;
  legal_entity_id: string;
  channel: string;
  identifier: string;
  reason: string;
  notes: string | null;
  source_app_id: string | null;
  source_message_id: string | null;
  created_at: string;
}

export interface CreateSuppressionInput {
  workspace_id: string;
  channel: SuppressionChannel;
  identifier: string;
  reason: string;
  notes?: string;
  source_message_id?: string;
}

export interface CoreWorkspace {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  industry: string | null;
  legal_entity_id: string;
  role?: string;
  plan?: string;
  status?: string;
}

export const MAX_BULK_IDENTIFIERS = 1000;

export class CoreApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`core_api_error_${status}`);
  }
}

/** Accepts either the Core origin or an origin already ending in /api/public[/v1]. */
export function normalizeCoreBase(input: string): string {
  return input.replace(/\/+$/, "").replace(/\/api\/public(\/v1)?$/, "");
}

export function createCoreClient(options: CoreClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  // CORE_API_URL may be given as the Core origin or already suffixed with the
  // /api/public/v1 base path; normalize so paths are never doubled.
  const base = normalizeCoreBase(options.baseUrl);

  function headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${options.token}`,
    };
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    // A policy deny comes back as 403 with a decision body; surface it as data.
    if (!res.ok && !(res.status === 403 && payload && "decision" in payload)) {
      throw new CoreApiError(res.status, payload);
    }
    return payload as T;
  }

  async function get<T>(path: string): Promise<T> {
    const res = await doFetch(`${base}${path}`, { headers: headers() });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new CoreApiError(res.status, payload);
    return payload as T;
  }

  return {
    policy: {
      /** Point-of-contact authorization. The only call that may authorize outreach. */
      assert: (input: AssertInput) => post<AssertResult>("/api/public/v1/policy/assert", input),

      /**
       * Batched, identical-rule evaluation for building and filtering queues.
       * Advisory only — re-assert at the moment of contact.
       */
      assertBulk: async (input: AssertBulkInput) => {
        if (input.identifiers.length > MAX_BULK_IDENTIFIERS) {
          throw new Error(`identifiers exceeds max of ${MAX_BULK_IDENTIFIERS}`);
        }
        return post<AssertBulkResult>("/api/public/v1/policy/assert-bulk", input);
      },

      /** Recording consent, evaluated in the called party's jurisdiction. */
      assertCanRecord: (input: RecordInput) =>
        post<RecordResult>("/api/public/v1/policy/record", input),
    },

    suppressions: {
      create: (input: CreateSuppressionInput) =>
        post<{ suppression: Suppression }>("/api/public/v1/suppressions", input),
      list: (workspaceId: string, identifier?: string) => {
        const params = new URLSearchParams({ workspace_id: workspaceId });
        if (identifier) params.set("identifier", identifier);
        return get<{ suppressions: Suppression[] }>(
          `/api/public/v1/suppressions?${params.toString()}`,
        );
      },
    },

    /** Workspaces this credential (or user) may act inside. */
    workspaces: () => get<{ workspaces: CoreWorkspace[] }>("/api/public/v1/workspaces"),

    /** User identity + memberships. Requires a user JWT, not a service key. */
    me: () =>
      get<{
        user: { id: string; email: string; full_name: string | null; avatar_url: string | null; is_staff: boolean } | null;
        memberships: { role: string; workspaces: CoreWorkspace }[];
        app_id: string;
      }>("/api/public/v1/me"),
  };
}

export type CoreClient = ReturnType<typeof createCoreClient>;
