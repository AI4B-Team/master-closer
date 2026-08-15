import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { supabase } from "@/integrations/supabase/client";
import { describeEvent, eventHref } from "@/lib/activity-labels";
import { toCsv, downloadCsv, stampedName } from "@/lib/csv";
import { useWorkspace } from "@/hooks/use-workspace";

import { Activity, Download, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  validateSearch: (search: Record<string, unknown>): { type?: string; q?: string; range?: string } => ({
    type: typeof search.type === "string" && search.type ? search.type : undefined,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    range: typeof search.range === "string" && search.range ? search.range : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Activity Log — Master Closer" },
      { name: "description", content: "Audit every workspace event: calls, leads, campaigns and webhook fan-out from Master Closer." },
      { property: "og:title", content: "Activity Log — Master Closer" },
      { property: "og:description", content: "A searchable audit trail of every workspace event." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

// Change-control events: closer copy, objection libraries and compliance settings.
const GOVERNANCE_PREFIXES: string[] = ["prompt.", "profile.", "objection.", "line.", "disclosure.", "agent.", "core."];
const GOVERNANCE_KINDS: string[] = ["lead.flagged_dnc", "lead.released_dnc"];

const RANGES = [
  { key: "7", label: "Last 7 Days", days: 7 },
  { key: "30", label: "Last 30 Days", days: 30 },
  { key: "90", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: null as number | null },
];

function ActivityPage() {
  const sp = Route.useSearch();
  const navigate = useNavigate();
  const [search, setSearch] = useState(sp.q ?? "");
  const [type, setType] = useState<string>(sp.type ?? "all");
  const [range, setRange] = useState<string>(sp.range ?? "30");
  const [limit, setLimit] = useState(200);

  // Keep the URL in sync so filtered views are shareable and survive a reload.
  useEffect(() => {
    const next = {
      type: type === "all" ? undefined : type,
      q: search.trim() ? search.trim() : undefined,
      range: range === "30" ? undefined : range,
    };
    if (next.type === sp.type && next.q === sp.q && next.range === sp.range) return;
    const t = setTimeout(() => {
      navigate({ to: "/activity", search: next, replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, search, range]);




  const { data: workspace } = useWorkspace();

  const { data: events, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["org-events", workspace?.id ?? null, range, limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const days = RANGES.find((r) => r.key === range)?.days ?? null;
      let q = supabase
        .from("events")
        .select("*")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (days) q = q.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filter on the payload `kind` (falling back to event_type) so hub events that
  // all arrive as `job.completed` still split into meaningful buckets.
  const types = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events ?? []) {
      const a = describeEvent(e as any);
      map.set(a.kind, a.label);
    }
    return Array.from(map, ([kind, label]) => ({ kind, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (events ?? []).filter((e: any) => {
      const a = describeEvent(e);
      // "governance" is a synthetic bucket: every change made to closer copy,
      // objection libraries or compliance settings, in one review-friendly view.
      if (type === "governance") {
        if (!GOVERNANCE_PREFIXES.some((pre) => a.kind.startsWith(pre)) && !GOVERNANCE_KINDS.includes(a.kind))
          return false;
      } else if (type !== "all" && a.kind !== type && !a.kind.startsWith(`${type}.`)) {
        // Exact kind from a badge click, or a family prefix (e.g. "call") from a deep link.
        return false;
      }
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        a.kind.toLowerCase().includes(q) ||
        JSON.stringify(e.payload ?? {}).toLowerCase().includes(q)
      );
    });
  }, [events, search, type]);

  const exportCsv = () => {
    const csv = toCsv(
      ["Date", "Event", "Detail", "Kind", "Payload"],
      rows.map((e: any) => {
        const a = describeEvent(e);
        return [
          new Date(e.created_at).toLocaleString(),
          a.label,
          a.detail ?? "",
          a.kind,
          JSON.stringify(e.payload ?? {}),
        ];
      }),
    );
    downloadCsv(stampedName("activity"), csv);
  };


  return (
    <div>
      <PageHeader title="Activity Log" description="Every event emitted by this workspace." />
      <AccountShell current="activity">
        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-[#CC0000]" />
            <h3 className="font-semibold">Workspace Events</h3>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Input
              placeholder="Search Events"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {RANGES.map((r) => (
                <FilterChip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
                  {r.label}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={type === "all"} onClick={() => setType("all")}>All</FilterChip>
              <FilterChip active={type === "governance"} onClick={() => setType("governance")}>Governance</FilterChip>
              {type !== "all" && type !== "governance" && !types.some((t) => t.kind === type) && (
                <FilterChip active onClick={() => setType("all")}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </FilterChip>
              )}
              {types.map((t) => (
                <FilterChip key={t.kind} active={type === t.kind} onClick={() => setType(t.kind)}>
                  {t.label}
                </FilterChip>
              ))}
            </div>
            <span className="ml-auto text-xs text-[#6B6B76]">
              {rows.length} Event{rows.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-[#F4F4F7] animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#6B6B76]">No events yet. Activity appears here as calls, leads and campaigns run.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((e: any) => {
                const a = describeEvent(e);
                const href = eventHref(e);
                return (
                  <div key={e.id} className="border border-[#E7E7EC] rounded-xl px-3 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <a.icon className="h-4 w-4 text-[#CC0000] shrink-0" />
                      <span className="text-sm font-medium min-w-0 truncate">{a.label}</span>
                      {a.detail ? <span className="text-sm text-[#6B6B76] min-w-0 truncate">{a.detail}</span> : null}
                      {href ? (
                        <Link to={href} className="text-xs text-[#CC0000] hover:underline shrink-0">
                          Open
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setType(a.kind)}
                        title={`Filter By ${a.label}`}
                        className="ml-auto shrink-0"
                      >
                        <Badge variant="secondary" className="font-mono text-[11px] hover:bg-[#E7E7EC]">{a.kind}</Badge>
                      </button>
                      <span className="text-xs text-[#6B6B76] shrink-0">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                    {e.payload && Object.keys(e.payload).length > 0 ? (
                      <pre className="mt-1.5 text-[11px] text-[#6B6B76] font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(e.payload)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {(events?.length ?? 0) >= limit ? (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setLimit((l) => l + 200)}
                disabled={isFetching}
              >
                Load More
              </Button>
            </div>
          ) : null}
        </Card>
      </AccountShell>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 py-1 rounded-full text-xs border transition-colors " +
        (active
          ? "bg-[#CC0000] border-[#CC0000] text-white"
          : "bg-white border-[#E7E7EC] text-[#6B6B76] hover:text-[#111]")
      }
    >
      {children}
    </button>
  );
}
