/**
 * Shared notification model for the bell menu and the /notifications inbox.
 *
 * A notification is either a workspace event row or a follow-up task that is
 * due soon. Read state lives in `notification_reads`, keyed per user, so it
 * follows the person across devices instead of sitting in localStorage.
 */
import { supabase } from "@/integrations/supabase/client";
import { eventHref } from "@/lib/activity-labels";

export type NotifyPrefs = {
  callSummaries: boolean;
  handoffAlerts: boolean;
  dealUpdates: boolean;
  complianceFlags: boolean;
  followUps: boolean;
};

export const DEFAULT_PREFS: NotifyPrefs = {
  callSummaries: true,
  handoffAlerts: true,
  dealUpdates: true,
  complianceFlags: true,
  followUps: true,
};

/** Which account notification toggle governs a given event type. */
export function prefKeyFor(type: string): keyof NotifyPrefs | null {
  if (type.startsWith("task.")) return "followUps";
  if (type.startsWith("deal.")) return "dealUpdates";
  if (
    type.startsWith("consent.") ||
    type.startsWith("disclosure.") ||
    type.startsWith("core.") ||
    type === "lead.flagged_dnc"
  )
    return "complianceFlags";
  if (type.includes("handoff") || type.includes("transfer")) return "handoffAlerts";
  if (type.startsWith("call.")) return "callSummaries";
  return null;
}

const LABELS: Record<string, string> = {
  "call.completed": "Call Completed",
  "call.started": "Call Started",
  "lead.created": "New Lead",
  "lead.updated": "Lead Updated",
  "deal.won": "Deal Won",
  "deal.updated": "Deal Updated",
  "agreement.sent": "Agreement Sent",
  "agreement.viewed": "Agreement Viewed",
  "agreement.signed": "Agreement Signed",
  "campaign.started": "Campaign Started",
  "consent.logged": "Disclosure Logged",
  "task.due": "Follow-Up Due",
  "task.overdue": "Follow-Up Overdue",
  "agent.proposal_pending": "Proposal Waiting On You",
  "agent.proposal_approved": "Proposal Approved",
  "agent.proposal_rejected": "Proposal Rejected",
  "agent.proposal_expired": "Proposal Expired",
  "agent.mode_changed": "Agent Mode Changed",
  "agent.paused_all": "Intelligence Agents Paused",
  "agent.resumed_all": "Intelligence Agents Resumed",
  "core.suppressions_synced": "Core Opt-Outs Mirrored",
  "core.suppression_sync_failed": "Core Opt-Out Sync Failed",
};

export function notifyLabel(type: string) {
  return LABELS[type] ?? type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Coarse buckets used by the inbox filter chips. */
export type NotifyCategory =
  | "calls"
  | "deals"
  | "leads"
  | "agreements"
  | "compliance"
  | "tasks"
  | "governance"
  | "other";

export function categoryFor(type: string): NotifyCategory {
  if (type.startsWith("task.")) return "tasks";
  if (type.startsWith("call.")) return "calls";
  if (type.startsWith("deal.")) return "deals";
  if (type.startsWith("lead")) return "leads";
  if (type.startsWith("agreement")) return "agreements";
  if (type.startsWith("consent.") || type.startsWith("disclosure.") || type.startsWith("core.")) return "compliance";
  if (
    type.startsWith("agent.") ||
    type.startsWith("prompt.") ||
    type.startsWith("profile.") ||
    type.startsWith("objection.") ||
    type.startsWith("line.")
  )
    return "governance";
  return "other";
}

export type NotifyItem = {
  /** Stable identity used for read state, e.g. "event:<uuid>" or "task:<uuid>". */
  key: string;
  type: string;
  title: string;
  detail: string;
  created_at: string;
  href: string;
  category: NotifyCategory;
};

function detailOf(payload: unknown) {
  const p = (payload ?? {}) as Record<string, any>;
  // Digests carry the numbers in `message`; a bare schedule name says nothing.
  if (p.kind === "report.digest" && p.message) return p.message;
  // Core sync rows carry counts or a failure reason, never a name.
  if (p.kind === "core.suppression_sync_failed") return p.reason || "Core was unreachable";
  if (p.kind === "core.suppressions_synced")
    return (
      `${p.added ?? 0} added to Do Not Call · ${p.mirrored ?? 0} on Core list` +
      (p.removed ? ` · ${p.removed} lifted by Core` : "")
    );
  return (
    p.name || p.lead_name || p.title || p.signer_name || p.phone || p.outcome || p.message || "Workspace activity"
  );
}


/** Relative time, e.g. "4m ago" or "in 2h" for things that are not due yet. */
export function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(Math.abs(diff) / 1000));
  const suffix = diff < 0 ? (v: string) => `in ${v}` : (v: string) => `${v} ago`;
  if (s < 60) return suffix(`${s}s`);
  const m = Math.round(s / 60);
  if (m < 60) return suffix(`${m}m`);
  const h = Math.round(m / 60);
  if (h < 24) return suffix(`${h}h`);
  return suffix(`${Math.round(h / 24)}d`);
}

/** Events + due follow-ups for one workspace, newest first. */
export async function fetchNotifications(wsId: string, limit = 24): Promise<NotifyItem[]> {
  const [evt, tasks, proposals] = await Promise.all([
    supabase
      .from("events")
      .select("id,event_type,payload,created_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tasks")
      .select("id,title,due_at,priority,status")
      .eq("workspace_id", wsId)
      .eq("status", "open")
      .not("due_at", "is", null)
      .lte("due_at", new Date(Date.now() + 86400000).toISOString())
      .order("due_at", { ascending: true })
      .limit(Math.min(limit, 25)),
    // Pending proposals are the one queue that expires, so they belong in the
    // inbox rather than only on the Intelligence page.
    supabase
      .from("agent_proposals")
      .select("id,agent_key,proposal_type,created_at,expires_at")
      .eq("workspace_id", wsId)
      .eq("status", "pending")
      .order("expires_at", { ascending: true })
      .limit(Math.min(limit, 25)),
  ]);

  const now = Date.now();
  const proposalItems: NotifyItem[] = (proposals.data ?? [])
    .filter((p: any) => !p.expires_at || new Date(p.expires_at).getTime() > now)
    .map((p: any) => {
      const hoursLeft = p.expires_at ? Math.max(0, Math.round((new Date(p.expires_at).getTime() - now) / 3600000)) : null;
      const who = notifyLabel(String(p.agent_key ?? "agent"));
      const what = String(p.proposal_type ?? "").replace(/[._]/g, " ");
      return {
        key: `proposal:${p.id}`,
        type: "agent.proposal_pending",
        title: notifyLabel("agent.proposal_pending"),
        detail: [who, what, hoursLeft !== null ? `expires in ${hoursLeft}h` : null].filter(Boolean).join(" · "),
        created_at: p.created_at,
        href: "/agents",
        category: "governance" as NotifyCategory,
      };
    });

  const taskItems: NotifyItem[] = (tasks.data ?? []).map((t: any) => {
    const type = new Date(t.due_at) < new Date() ? "task.overdue" : "task.due";
    return {
      key: `task:${t.id}`,
      type,
      title: notifyLabel(type),
      detail: t.title || "Follow-up",
      created_at: t.due_at,
      href: "/tasks",
      category: "tasks" as NotifyCategory,
    };
  });

  const eventItems: NotifyItem[] = (evt.data ?? []).map((e: any) => {
    const type = String(e.payload?.kind ?? e.event_type);
    return {
      key: `event:${e.id}`,
      type,
      title: notifyLabel(type),
      detail: detailOf(e.payload),
      created_at: e.created_at,
      href: eventHref(e) ?? "/dashboard",
      category: categoryFor(type),
    };
  });

  return [...proposalItems, ...taskItems, ...eventItems]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}

/** Keys this user has already read in the given workspace. */
export async function fetchReadKeys(wsId: string): Promise<Set<string>> {
  const { data } = await supabase.from("notification_reads").select("item_key").eq("workspace_id", wsId);
  return new Set((data ?? []).map((r: any) => r.item_key as string));
}

/** Records the given keys as read for the signed-in user (idempotent). */
export async function markNotificationsRead(wsId: string, userId: string, keys: string[]) {
  if (keys.length === 0) return;
  await supabase.from("notification_reads").upsert(
    keys.map((item_key) => ({ user_id: userId, workspace_id: wsId, item_key })),
    { onConflict: "user_id,item_key" },
  );
}

/** Clears read state so everything shows as unread again. */
export async function markNotificationsUnread(wsId: string, keys: string[]) {
  if (keys.length === 0) return;
  await supabase.from("notification_reads").delete().eq("workspace_id", wsId).in("item_key", keys);
}

/** Applies the user's account notification toggles. */
export function applyPrefs(items: NotifyItem[], prefs: NotifyPrefs) {
  return items.filter((i) => {
    const key = prefKeyFor(i.type);
    return key ? prefs[key] !== false : true;
  });
}
