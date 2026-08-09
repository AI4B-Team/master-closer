import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SEEN_KEY = "mc.notifications.seenAt";

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
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Bell menu in the top bar: recent workspace activity with an unread dot. */
export function NotificationsMenu() {
  const navigate = useNavigate();
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

  const unread = useMemo(
    () => events.filter((e) => !seenAt || new Date(e.created_at) > new Date(seenAt)).length,
    [events, seenAt],
  );

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(SEEN_KEY, now);
    setSeenAt(now);
  };

  const routeFor = (type: string) => {
    if (type.startsWith("agreement")) return "/agreements";
    if (type.startsWith("call") || type.startsWith("consent")) return "/calls";
    if (type.startsWith("lead")) return "/leads";
    if (type.startsWith("deal")) return "/pipeline";
    if (type.startsWith("campaign")) return "/campaigns";
    return "/dashboard";
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
          setOpen((v) => !v);
          if (!open) markAllRead();
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

          {events.length === 0 ? (
            <div className="notif-empty">
              <Inbox size={20} />
              <p>Nothing Yet</p>
              <span>Calls, agreements and campaign activity land here.</span>
            </div>
          ) : (
            <div className="notif-list">
              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="notif-item"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: routeFor(e.event_type) });
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
        </div>
      )}
    </div>
  );
}
