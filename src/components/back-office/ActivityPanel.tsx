import { useEffect, useMemo, useState } from "react";
import { usePrefs } from "@/hooks/use-prefs";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Inbox, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { describeEvent, eventHref, type EventRow } from "@/lib/activity-labels";
import { useWorkspace } from "@/hooks/use-workspace";

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.round(Math.abs(diff) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Passive stream of everything that happened in the workspace. Distinct from
 * the bell: the bell is what needs you, this is the record of what occurred.
 */
const seenKey = (wsId: string | null | undefined) => `mc:activity:seen:${wsId ?? "none"}`;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "call", label: "Calls" },
  { key: "lead", label: "Leads" },
  { key: "agreement", label: "Agreements" },
  { key: "deal", label: "Deals" },
  { key: "campaign", label: "Campaigns" },
] as const;

export function ActivityPanel() {
  const navigate = useNavigate();
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [seen, setSeen] = useState<string>("");

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  // Per-workspace: the feed itself is workspace-scoped, so a shared marker made
  // one workspace's timestamps decide another's "new activity" badge.
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(seenKey(wsId)) ?? "");
    } catch {
      /* storage unavailable */
    }
  }, [wsId]);

  const { data: events = [], isFetching, refetch } = useQuery({
    queryKey: ["activity-panel", wsId],
    enabled: open && !!wsId,
    refetchInterval: open ? 20000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,event_type,payload,created_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  // Cheap "how much is new?" probe so the icon can show a count while closed.
  const { data: latest } = useQuery({
    queryKey: ["activity-latest", wsId, seen],
    enabled: !!wsId,
    refetchInterval: 45000,
    queryFn: async () => {
      const newestQ = supabase
        .from("events")
        .select("created_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const unseenQ = seen
        ? supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", wsId!)
            .gt("created_at", seen)
        : null;
      const [newestRes, unseenRes] = await Promise.all([newestQ, unseenQ]);
      if (newestRes.error) throw newestRes.error;
      return {
        newest: (newestRes.data?.created_at as string | undefined) ?? null,
        unseen: unseenRes?.count ?? null,
      };
    },
  });

  const newest = events[0]?.created_at ?? latest?.newest ?? null;
  const unseenCount = latest?.unseen ?? null;
  const hasUnseen = Boolean(newest && (!seen || newest > seen));


  const markSeen = (iso: string | null) => {
    if (!iso) return;
    setSeen(iso);
    try {
      localStorage.setItem(seenKey(wsId), iso);
    } catch {
      /* storage unavailable */
    }
  };

  // Frozen at open time so "New" markers stay put while the panel is up.
  const [seenAtOpen, setSeenAtOpen] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSeenAtOpen(seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && newest) markSeen(newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, newest]);


  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = useMemo(
    () => (filter === "all" ? events : events.filter((e) => describeEvent(e).kind.startsWith(filter))),
    [events, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of shown) {
      const key = dayLabel(e.created_at);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [shown]);

  return (
    <>
      <button
        type="button"
        className="icon-btn has-tip tip-below"
        data-tip={t("Activity")}
        aria-label={unseenCount && unseenCount > 0 ? `Activity, ${unseenCount} new` : "Activity"}
        onClick={() => setOpen(true)}
      >
        <Activity size={17} />
        {hasUnseen && unseenCount && unseenCount > 0 ? (
          <span className="bell-badge">{unseenCount > 9 ? "9+" : unseenCount}</span>
        ) : hasUnseen ? (
          <span className="act-dot" aria-hidden="true" />
        ) : null}
      </button>


      {open && (
        <>
          <button type="button" className="act-scrim" aria-label="Close Activity" onClick={() => setOpen(false)} />
          <aside className="act-panel" role="dialog" aria-label="Activity">
            <div className="act-head">
              <span className="act-title font-display">{t("Activity")}</span>
              <div className="act-head-tools">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Refresh Activity"
                  onClick={() => refetch()}
                >
                  <RefreshCw size={15} className={isFetching ? "act-spin" : undefined} />
                </button>
                <button type="button" className="icon-btn" aria-label="Close Activity" onClick={() => setOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="act-filters">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`act-chip${filter === f.key ? " is-on" : ""}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {t(f.label)}
                </button>
              ))}
            </div>

            <div className="act-body">
              {shown.length === 0 ? (
                <div className="notif-empty">
                  <Inbox size={20} />
                  <p>{events.length === 0 ? "No Activity Yet" : "Nothing In This Filter"}</p>
                  <span>Calls, leads, agreements and campaigns show up here as they happen.</span>
                </div>
              ) : (
                groups.map(([day, rows]) => (
                  <div key={day} className="act-group">
                    <div className="act-day">{day}</div>
                    {rows.map((e) => {
                      const d = describeEvent(e);
                      const Icon = d.icon;
                      const href = eventHref(e);
                      const isNew = Boolean(seenAtOpen && e.created_at > seenAtOpen);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`act-row${isNew ? " is-new" : ""}`}
                          onClick={() => {
                            setOpen(false);
                            if (href) navigate({ to: href });
                          }}
                        >
                          <span className="act-ico">
                            <Icon size={15} />
                          </span>
                          <span className="act-text">
                            <span className="act-label">
                              {d.label}
                              {isNew && <span className="act-new">{t("New")}</span>}
                            </span>
                            {d.detail && <span className="act-detail">{d.detail}</span>}
                          </span>
                          <span className="act-time">{ago(e.created_at)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              className="notif-foot"
              onClick={() => {
                setOpen(false);
                navigate({
                  to: "/activity",
                  search: { range: "7", ...(filter === "all" ? {} : { type: filter }) },
                });
              }}
            >
              Open Activity Log <ArrowRight size={13} />
            </button>
          </aside>
        </>
      )}
    </>
  );
}
