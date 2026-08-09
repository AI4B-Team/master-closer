import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Inbox, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { describeEvent, eventHref, type EventRow } from "@/lib/activity-labels";

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
const SEEN_KEY = "mc:activity:seen";

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
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [seen, setSeen] = useState<string>("");

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const { data: events = [], isFetching, refetch } = useQuery({
    queryKey: ["activity-panel"],
    enabled: open,
    refetchInterval: open ? 20000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,event_type,payload,created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  // Cheap "how much is new?" probe so the icon can show a count while closed.
  const { data: latest } = useQuery({
    queryKey: ["activity-latest", seen],
    refetchInterval: 45000,
    queryFn: async () => {
      const newestQ = supabase
        .from("events")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const unseenQ = seen
        ? supabase.from("events").select("id", { count: "exact", head: true }).gt("created_at", seen)
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
      localStorage.setItem(SEEN_KEY, iso);
    } catch {
      /* storage unavailable */
    }
  };

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
  }, [events]);

  return (
    <>
      <button
        type="button"
        className="icon-btn has-tip tip-below"
        data-tip="Activity"
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
              <span className="act-title font-display">Activity</span>
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
                  {f.label}
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
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className="act-row"
                          onClick={() => {
                            setOpen(false);
                            if (href) navigate({ to: href });
                          }}
                        >
                          <span className="act-ico">
                            <Icon size={15} />
                          </span>
                          <span className="act-text">
                            <span className="act-label">{d.label}</span>
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
