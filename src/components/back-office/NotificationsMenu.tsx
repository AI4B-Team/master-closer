import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, CheckCheck, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_PREFS,
  ago,
  applyPrefs,
  fetchNotifications,
  fetchReadKeys,
  markNotificationsRead,
  type NotifyItem,
  type NotifyPrefs,
} from "@/lib/notifications";

/** Bell menu in the top bar: recent workspace activity with an unread dot. */
export function NotificationsMenu() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const prefs: NotifyPrefs = {
    ...DEFAULT_PREFS,
    ...(((user?.user_metadata as any)?.notify ?? {}) as Partial<NotifyPrefs>),
  };
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", wsId, "menu"],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: () => fetchNotifications(wsId!, 24),
  });

  const { data: readKeys } = useQuery({
    queryKey: ["notification-reads", wsId, user?.id],
    enabled: !!wsId && !!user?.id,
    queryFn: () => fetchReadKeys(wsId!, user!.id),
  });

  const visible = useMemo(
    () => applyPrefs(items, prefs),
    [items, prefs.callSummaries, prefs.handoffAlerts, prefs.dealUpdates, prefs.complianceFlags, prefs.followUps],
  );

  const isRead = (key: string) => !!readKeys?.has(key);
  const unread = visible.filter((i) => !isRead(i.key)).length;

  const markAllRead = async () => {
    if (!wsId || !user?.id) return;
    const keys = visible.filter((i) => !isRead(i.key)).map((i) => i.key);
    if (keys.length === 0) return;
    await markNotificationsRead(wsId, user.id, keys);
    qc.invalidateQueries({ queryKey: ["notification-reads", wsId, user?.id] });
  };

  const openItem = async (item: NotifyItem) => {
    if (wsId && user?.id) {
      await markNotificationsRead(wsId, user.id, [item.key]);
      qc.invalidateQueries({ queryKey: ["notification-reads", wsId, user?.id] });
    }
    setOpen(false);
    const [path, query] = item.href.split("?");
    navigate({
      to: path as any,
      search: (query ? Object.fromEntries(new URLSearchParams(query).entries()) : undefined) as any,
    });
  };

  return (
    <div className="profile-wrap" ref={wrap}>
      <button
        type="button"
        data-tour="notifications"
        className="icon-btn has-tip tip-below"
        data-tip={unread ? `${unread} new notification${unread > 1 ? "s" : ""}` : "Notifications"}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="drop-menu notif-menu">
          <div className="notif-head">
            <span className="font-display">Notifications</span>
            <button type="button" className="notif-read" onClick={() => void markAllRead()}>
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
              {visible.map((i) => (
                <button key={i.key} type="button" className="notif-item" onClick={() => void openItem(i)}>
                  <span className="notif-dot" data-new={!isRead(i.key)} />
                  <span className="notif-body">
                    <span className="notif-title">{i.title}</span>
                    <span className="notif-detail">{i.detail}</span>
                  </span>
                  <span className="notif-time">{ago(i.created_at)}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="notif-foot"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/notifications" });
            }}
          >
            Open Inbox <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
