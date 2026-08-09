import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, CheckCheck, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventHref } from "@/lib/activity-labels";
import { useAuth } from "@/hooks/use-auth";

const SEEN_KEY = "mc.notifications.seenAt";

type NotifyPrefs = {
  callSummaries: boolean;
  handoffAlerts: boolean;
  dealUpdates: boolean;
  complianceFlags: boolean;
  followUps: boolean;
};

const DEFAULT_PREFS: NotifyPrefs = {
  callSummaries: true,
  handoffAlerts: true,
  dealUpdates: true,
  complianceFlags: true,
  followUps: true,
};

/** Which account notification toggle governs a given event type. */
function prefKeyFor(type: string): keyof NotifyPrefs | null {
  if (type.startsWith("task.")) return "followUps";
  if (type.startsWith("deal.")) return "dealUpdates";
  if (type.startsWith("consent.") || type.startsWith("disclosure.") || type === "lead.flagged_dnc")
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
};

type EventRow = { id: string; event_type: string; payload: any; created_at: string };

function label(type: string) {
  return LABELS[type] ?? type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function detail(e: EventRow) {
  const p = (e.payload ?? {}) as Record<string, any>;
  return (
    p.name || p.lead_name || p.title || p.signer_name || p.phone || p.outcome || p.message || "Workspace activity"
  );
}

function ago(iso: string) {
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

/** Bell menu in the top bar: recent workspace activity with an unread dot. */
export function NotificationsMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefs: NotifyPrefs = {
    ...DEFAULT_PREFS,
    ...(((user?.user_metadata as any)?.notify ?? {}) as Partial<NotifyPrefs>),
  };
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  useEffect(() => {
    setSeenAt(localStorage.getItem(SEEN_KEY));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const { data: events = [] } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [evt, tasks] = await Promise.all([
        supabase
          .from("events")
          .select("id,event_type,payload,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("tasks")
          .select("id,title,due_at,priority,status")
          .eq("status", "open")
          .not("due_at", "is", null)
          .lte("due_at", new Date(Date.now() + 86400000).toISOString())
          .order("due_at", { ascending: true })
          .limit(10),
      ]);

      const taskRows: EventRow[] = (tasks.data ?? []).map((t: any) => ({
        id: `task:${t.id}`,
        event_type: new Date(t.due_at) < new Date() ? "task.overdue" : "task.due",
        payload: { title: t.title, priority: t.priority },
        created_at: t.due_at,
      }));

      return [...taskRows, ...((evt.data ?? []) as EventRow[])]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 24);
    },
  });

  const visible = useMemo(
    () =>
      events.filter((e) => {
        const key = prefKeyFor(String((e.payload as any)?.kind ?? e.event_type));
        return key ? prefs[key] !== false : true;
      }),
    [events, prefs.callSummaries, prefs.handoffAlerts, prefs.dealUpdates, prefs.complianceFlags, prefs.followUps],
  );

  const unread = useMemo(
    () => visible.filter((e) => !seenAt || new Date(e.created_at) > new Date(seenAt)).length,
    [visible, seenAt],
  );

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setSeenAt(now);
  };

  const routeFor = (e: EventRow) => {
    const type = e.event_type;
    if (type.startsWith("task")) return "/tasks";
    return eventHref(e) ?? "/dashboard";
  };

  return (
    <div className="profile-wrap" ref={wrap}>
      <button
        type="button"
        data-tour="notifications"
        className="icon-btn has-tip tip-below"
        data-tip={unread ? `${unread} new notification${unread > 1 ? "s" : ""}` : "Notifications"}
        aria-label="Notifications"
        onClick={() => {
          // Keep the unread dots visible while the panel is open; mark seen on close.
          if (open) markAllRead();
          setOpen((v) => !v);
        }}
      >
        <Bell size={17} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="drop-menu notif-menu">
          <div className="notif-head">
            <span className="font-display">Notifications</span>
            <button type="button" className="notif-read" onClick={markAllRead}>
              <CheckCheck size={13} /> Mark All Read
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="notif-empty">
              <Inbox size={20} />
              <p>Nothing Yet</p>
              <span>Calls, agreements and campaign activity land here.</span>
            </div>
          ) : (
            <div className="notif-list">
              {visible.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="notif-item"
                  onClick={() => {
                    markAllRead();
                    setOpen(false);
                    navigate({ to: routeFor(e) });
                  }}
                >
                  <span className="notif-dot" data-new={!seenAt || new Date(e.created_at) > new Date(seenAt)} />
                  <span className="notif-body">
                    <span className="notif-title">{label(e.event_type)}</span>
                    <span className="notif-detail">{detail(e)}</span>
                  </span>
                  <span className="notif-time">{ago(e.created_at)}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="notif-foot"
            onClick={() => {
              markAllRead();
              setOpen(false);
              navigate({ to: "/activity" });
            }}
          >
            View All Activity <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
