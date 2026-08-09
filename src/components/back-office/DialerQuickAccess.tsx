import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "@/hooks/use-prefs";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, Delete, ExternalLink, Hash, Phone, PhoneCall, PhoneForwarded, PhoneIncoming,
  PhoneMissed, Search, Users, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCallStatus } from "@/hooks/use-call-status";
import { formatPhone } from "@/lib/phone";

type Tab = "keypad" | "recents" | "contacts";

const KEYS = [
  { d: "1", l: "" }, { d: "2", l: "ABC" }, { d: "3", l: "DEF" },
  { d: "4", l: "GHI" }, { d: "5", l: "JKL" }, { d: "6", l: "MNO" },
  { d: "7", l: "PQRS" }, { d: "8", l: "TUV" }, { d: "9", l: "WXYZ" },
  { d: "*", l: "" }, { d: "0", l: "+" }, { d: "#", l: "" },
];

type RecentRow = {
  id: string;
  name: string;
  phone: string | null;
  started_at: string;
  duration_sec: number;
  dial_outcome: string | null;
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just Now";
  if (mins < 60) return `${mins} Min Ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} Hr Ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} Days Ago`;
}

function dur(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function DialerQuickAccess() {
  const { t: tr } = usePrefs();
  const navigate = useNavigate();
  const callStatus = useCallStatus();
  const onCall = callStatus === "on_call" || callStatus === "dialing";
  const { data: ws } = useWorkspace();
  const wsId = ws?.id ?? null;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("keypad");
  const [number, setNumber] = useState("");
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const callerIds = useMemo(() => {
    const list: { id: string; label: string; number: string }[] = [];
    if (ws?.default_caller_id) list.push({ id: "default", label: "Main Line", number: ws.default_caller_id });
    list.push({ id: "unset", label: "Workspace Default", number: ws?.default_caller_id ?? "Not Set" });
    return list.filter((c, i, arr) => arr.findIndex((x) => x.number === c.number) === i);
  }, [ws?.default_caller_id]);
  const [callerId, setCallerId] = useState<string>("default");
  const activeCaller = callerIds.find((c) => c.id === callerId) ?? callerIds[0];

  const recents = useQuery<RecentRow[]>({
    queryKey: ["quick-dial-recents", wsId],
    enabled: open && tab === "recents" && Boolean(wsId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, started_at, duration_sec, dial_outcome, lead_id, leads(name, phone)")
        .eq("workspace_id", wsId!)
        .order("started_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.leads?.name ?? "Unknown",
        phone: r.leads?.phone ?? null,
        started_at: r.started_at,
        duration_sec: r.duration_sec ?? 0,
        dial_outcome: r.dial_outcome,
      }));
    },
  });

  const contacts = useQuery({
    queryKey: ["quick-dial-contacts", wsId, q],
    enabled: open && tab === "contacts" && Boolean(wsId),
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, name, phone, company, status")
        .eq("workspace_id", wsId!)
        .not("phone", "is", null)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (q.trim()) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const goDial = (raw: string) => {
    const digits = (raw ?? "").replace(/[^\d+*#]/g, "");
    if (!digits) return;
    setOpen(false);
    navigate({ to: "/dialer", search: { number: digits } as never });
  };

  return (
    <div className="qd-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"icon-btn has-tip tip-below" + (onCall ? " qd-live" : "")}
        data-tip={onCall ? "Call In Progress" : "Dialer"}
        aria-label="Dialer"
        onClick={() => setOpen((v) => !v)}
      >
        {onCall ? <PhoneCall size={17} /> : <Phone size={17} />}
        {onCall && <span className="qd-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="qd-menu" role="dialog" aria-label="Dialer">
          <div className="qd-tabs">
            {([
              { key: "keypad" as Tab, label: "Keypad", icon: Hash },
              { key: "recents" as Tab, label: "Recents", icon: Clock },
              { key: "contacts" as Tab, label: "Contacts", icon: Users },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                className={"qd-tab" + (tab === t.key ? " is-on" : "")}
                onClick={() => setTab(t.key)}
              >
                <t.icon size={14} /> {tr(t.label)}
              </button>
            ))}
          </div>

          {tab === "keypad" && (
            <div className="qd-body">
              <label className="qd-label">{tr("Call From")}</label>
              <select
                className="qd-select"
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
              >
                {callerIds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {formatPhone(c.number) || c.number}
                  </option>
                ))}
              </select>

              <div className="qd-display">
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/[^\d+*#]/g, ""))}
                  placeholder={tr("Enter Phone Number")}
                  aria-label="Phone Number"
                />
                {number && (
                  <button type="button" className="qd-back" aria-label="Backspace" onClick={() => setNumber((p) => p.slice(0, -1))}>
                    <Delete size={17} />
                  </button>
                )}
              </div>

              <div className="qd-pad">
                {KEYS.map((k) => (
                  <button key={k.d} type="button" className="qd-key" onClick={() => setNumber((p) => p + k.d)}>
                    <span className="qd-key-d">{k.d}</span>
                    {k.l && <span className="qd-key-l">{k.l}</span>}
                  </button>
                ))}
              </div>

              <button type="button" className="qd-call" disabled={!number} onClick={() => goDial(number)}>
                <Phone size={17} /> Call
              </button>

              <div className="qd-foot">
                <button type="button" className="qd-foot-btn" onClick={() => { setOpen(false); navigate({ to: "/dialer" }); }}>
                  <ExternalLink size={14} /> Open Dialer
                </button>
                <button type="button" className="qd-foot-btn" onClick={() => { setOpen(false); navigate({ to: "/lists" }); }}>
                  <Users size={14} /> Call Queues
                </button>
              </div>
              {activeCaller?.number === "Not Set" && (
                <p className="qd-hint">Set A Default Caller ID In Workspace Settings.</p>
              )}
            </div>
          )}

          {tab === "recents" && (
            <div className="qd-list">
              {(recents.data ?? []).length === 0 ? (
                <div className="qd-empty"><Clock size={18} /><p>{tr("No Recent Calls")}</p></div>
              ) : (
                (recents.data ?? []).map((r) => (
                  <button key={r.id} type="button" className="qd-row" onClick={() => (r.phone ? goDial(r.phone) : navigate({ to: "/calls" }))}>
                    <span className="qd-avatar">
                      {r.dial_outcome === "no_answer" || r.dial_outcome === "busy" || r.dial_outcome === "failed"
                        ? <PhoneMissed size={15} />
                        : r.dial_outcome === "voicemail"
                          ? <PhoneIncoming size={15} />
                          : <PhoneForwarded size={15} />}
                    </span>
                    <span className="qd-row-main">
                      <span className="qd-row-top">
                        <span className="qd-row-name">{r.name}</span>
                        <span className="qd-row-meta">{ago(r.started_at)}</span>
                      </span>
                      <span className="qd-row-top">
                        <span className="qd-row-meta">{formatPhone(r.phone) || "—"}</span>
                        <span className="qd-row-meta">{dur(r.duration_sec)}</span>
                      </span>
                    </span>
                  </button>
                ))
              )}
              <div className="qd-list-foot">
                <button type="button" className="qd-foot-btn" onClick={() => { setOpen(false); navigate({ to: "/calls" }); }}>
                  <Clock size={14} /> View All History
                </button>
              </div>
            </div>
          )}

          {tab === "contacts" && (
            <div className="qd-list">
              <div className="qd-search">
                <Search size={14} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search Contacts")} aria-label="Search Contacts" />
                {q && <button type="button" className="qd-back qd-back-inline" aria-label="Clear" onClick={() => setQ("")}><X size={14} /></button>}
              </div>
              {(contacts.data ?? []).length === 0 ? (
                <div className="qd-empty"><Users size={18} /><p>{tr("No Contacts Found")}</p></div>
              ) : (
                (contacts.data ?? []).map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    className="qd-row"
                    onClick={() => { setNumber((c.phone ?? "").replace(/[^\d+*#]/g, "")); setTab("keypad"); }}
                  >
                    <span className="qd-avatar"><Users size={15} /></span>
                    <span className="qd-row-main">
                      <span className="qd-row-name">{c.name}</span>
                      <span className="qd-row-meta">{formatPhone(c.phone)}{c.company ? ` · ${c.company}` : ""}</span>
                    </span>
                  </button>
                ))
              )}
              <div className="qd-list-foot">
                <button type="button" className="qd-foot-btn" onClick={() => { setOpen(false); navigate({ to: "/leads" }); }}>
                  <Users size={14} /> View All Contacts
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
