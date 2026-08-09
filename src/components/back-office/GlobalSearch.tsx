import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, Check, Users, PhoneCall, Megaphone, KanbanSquare, StickyNote, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const SEARCH_SCOPES = ["Everything", "Leads", "Calls", "Campaigns", "Deals", "Notes", "Agents"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

type Hit = {
  kind: "Lead" | "Call" | "Campaign" | "Deal" | "Note" | "Agent";
  id: string;
  title: string;
  sub: string;
  to: string;
  params?: Record<string, string>;
};

const ICONS: Record<Hit["kind"], any> = {
  Lead: Users,
  Call: PhoneCall,
  Campaign: Megaphone,
  Deal: KanbanSquare,
  Note: StickyNote,
  Agent: Bot,
};

function esc(q: string) {
  return q.replace(/[%,()]/g, " ").trim();
}

async function runSearch(raw: string, scope: SearchScope): Promise<Hit[]> {
  const q = esc(raw);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const want = (s: SearchScope) => scope === "Everything" || scope === s;
  const out: Hit[] = [];

  if (want("Leads") || want("Notes")) {
    const { data } = await supabase
      .from("leads")
      .select("id,name,company,phone,email,notes,status")
      .or(`name.ilike.${like},company.ilike.${like},phone.ilike.${like},email.ilike.${like},notes.ilike.${like}`)
      .limit(6);
    for (const l of data ?? []) {
      const noteHit = (l.notes ?? "").toLowerCase().includes(q.toLowerCase());
      if (scope === "Notes" && !noteHit) continue;
      out.push({
        kind: scope === "Notes" ? "Note" : "Lead",
        id: l.id,
        title: l.name,
        sub:
          scope === "Notes" && noteHit
            ? (l.notes ?? "").slice(0, 90)
            : [l.company, l.phone ?? l.email].filter(Boolean).join(" · ") || "Lead",
        to: "/leads",
        params: { q: l.name, lead: l.id },
      });
    }
  }

  if (want("Calls")) {
    const { data } = await supabase
      .from("calls")
      .select("id,summary,disposition,outcome,mode,started_at")
      .or(`summary.ilike.${like},disposition.ilike.${like}`)
      .order("started_at", { ascending: false })
      .limit(5);
    for (const c of data ?? []) {
      out.push({
        kind: "Call",
        id: c.id,
        title: c.summary?.slice(0, 70) || `${c.mode} call`,
        sub: `${c.outcome} · ${new Date(c.started_at).toLocaleDateString()}`,
        to: "/calls",
        params: { call: c.id },
      });
    }
  }

  if (want("Campaigns")) {
    const { data } = await supabase
      .from("campaigns")
      .select("id,name,status,goal")
      .or(`name.ilike.${like},goal.ilike.${like}`)
      .limit(5);
    for (const c of data ?? []) {
      out.push({ kind: "Campaign", id: c.id, title: c.name, sub: c.status, to: "/campaigns" });
    }
  }

  if (want("Deals")) {
    const { data } = await supabase
      .from("deals")
      .select("id,title,stage,value")
      .ilike("title", like)
      .limit(5);
    for (const d of data ?? []) {
      out.push({
        kind: "Deal",
        id: d.id,
        title: d.title,
        sub: `${d.stage} · $${Number(d.value ?? 0).toLocaleString()}`,
        to: "/pipeline",
        params: { deal: d.id },
      });
    }
  }

  if (want("Agents")) {
    const { data: ags } = await supabase
      .from("background_agents")
      .select("id,agent_key,mode,enabled")
      .ilike("agent_key", like)
      .limit(4);
    for (const a of ags ?? []) {
      out.push({
        kind: "Agent",
        id: a.id,
        title: a.agent_key.replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase()),
        sub: `Background Agent · ${a.enabled ? a.mode.replace("_", " ") : "off"}`,
        to: "/agents",
        params: { view: "registry" },
      });
    }
    const { data: props } = await supabase
      .from("agent_proposals")
      .select("id,agent_key,proposal_type,target_table,target_field,status,rationale")
      .or(`rationale.ilike.${like},target_table.ilike.${like},proposal_type.ilike.${like}`)
      .limit(5);
    for (const p of props ?? []) {
      out.push({
        kind: "Agent",
        id: p.id,
        title: `${p.proposal_type.replace(/_/g, " ")} — ${p.target_table}${p.target_field ? `.${p.target_field}` : ""}`,
        sub: `Proposal · ${p.status} · ${(p.agent_key ?? "agent").replace(/_/g, " ")}`,
        to: "/agents",
        params: { view: "proposals" },
      });
    }
  }

  return out;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<SearchScope>("Everything");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setScopeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const { data: hits, isFetching } = useQuery({
    queryKey: ["global-search", debounced, scope],
    queryFn: () => runSearch(debounced, scope),
    enabled: debounced.trim().length >= 2,
    staleTime: 15_000,
  });

  const results = useMemo(() => hits ?? [], [hits]);

  useEffect(() => setCursor(0), [debounced, scope]);

  const go = (h: Hit) => {
    setOpen(false);
    setTerm("");
    navigate({ to: h.to, search: (h.params ?? {}) as any });
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search">
        <Search size={15} />
        <input
          ref={inputRef}
          value={term}
          placeholder={`Search ${scope}…`}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && results[cursor]) {
              e.preventDefault();
              go(results[cursor]);
            }
          }}
        />
        <button
          type="button"
          className="search-caret has-tip tip-below"
          onClick={() => setScopeOpen((v) => !v)}
          data-tip="Choose What To Search"
          aria-label="Search Options"
        >
          {scope} <ChevronDown size={14} />
        </button>
      </div>

      {scopeOpen && (
        <div className="search-menu">
          <div className="search-menu-label">Search In</div>
          {SEARCH_SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              data-on={s === scope}
              onClick={() => {
                setScope(s);
                setScopeOpen(false);
                inputRef.current?.focus();
              }}
            >
              {s === scope && <Check size={14} />} {s}
            </button>
          ))}
        </div>
      )}

      {open && !scopeOpen && term.trim().length >= 2 && (
        <div className="search-results">
          {isFetching && results.length === 0 && <div className="sr-note">Searching…</div>}
          {!isFetching && results.length === 0 && (
            <div className="sr-note">No Matches For “{term.trim()}”</div>
          )}
          {results.map((h, i) => {
            const Icon = ICONS[h.kind];
            return (
              <button
                key={`${h.kind}-${h.id}`}
                type="button"
                className="sr-row"
                data-on={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(h)}
              >
                <span className="sr-ico">
                  <Icon size={14} />
                </span>
                <span className="sr-text">
                  <span className="sr-title">{h.title}</span>
                  <span className="sr-sub">{h.sub}</span>
                </span>
                <span className="sr-kind">{h.kind}</span>
              </button>
            );
          })}
          <div className="sr-foot">
            <kbd>↑</kbd> <kbd>↓</kbd> To Move · <kbd>Enter</kbd> To Open · <kbd>⌘K</kbd> To Focus
          </div>
        </div>
      )}
    </div>
  );
}
