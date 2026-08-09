import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { Avatar, EmptyState, Kpi, KPI_TINTS, StatusPill, titleCase } from "@/components/back-office/ui";
import { BarChart3, PhoneCall, Trophy, Percent, DollarSign, Download, Activity, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Reports — Master Closer" },
      { name: "description", content: "Rep leaderboards, close rates, revenue, and per-rep AI / Hybrid / Copilot usage." },
      { property: "og:title", content: "Reports — Master Closer" },
      { property: "og:description", content: "Rep leaderboards, close rates, revenue, and per-rep AI / Hybrid / Copilot usage." },
    ],
  }),
  component: ReportsPage,
});

const MODE_LABEL: Record<string, string> = { full_ai: "AI", hybrid: "Hybrid", copilot: "Copilot" };
const MODE_KEYS = ["full_ai", "hybrid", "copilot"] as const;

const RANGES = [
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
  { label: "All Time", days: 0 },
];

function ReportsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const { data: allCalls } = useQuery({
    queryKey: ["report_calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calls")
        .select("id, mode, outcome, dial_outcome, duration_sec, close_probability, rep_id, started_at")
        .order("started_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["report_deals"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("id, value, stage, stage_id, owner_id, updated_at");
      return data ?? [];
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["report_stages"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages")
        .select("id, label, kind, position, stale_days").order("position", { ascending: true });
      return data ?? [];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["report_people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ["report_suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suggestions")
        .select("id, objection, was_used, call_id")
        .limit(1000);
      return data ?? [];
    },
  });


  const calls = useMemo(() => {
    const list = allCalls ?? [];
    if (!rangeDays) return list;
    const cutoff = Date.now() - rangeDays * 86400000;
    return list.filter((c) => new Date(c.started_at).getTime() >= cutoff);
  }, [allCalls, rangeDays]);

  const nameFor = (id?: string | null) => {
    const p = people?.find((x) => x.id === id);
    return p?.full_name || p?.email?.split("@")[0] || "Unassigned";
  };

  const totals = useMemo(() => {
    const list = calls ?? [];
    const connected = list.filter((c) => c.dial_outcome === "connected" || c.outcome === "completed").length;
    const won = (deals ?? []).filter((d) => d.stage === "won");
    const revenue = won.reduce((s, d) => s + Number(d.value ?? 0), 0);
    return {
      calls: list.length,
      connectRate: list.length ? Math.round((connected / list.length) * 100) : 0,
      revenue,
      winRate: (deals ?? []).length ? Math.round((won.length / (deals ?? []).length) * 100) : 0,
    };
  }, [calls, deals]);

  const modeSplit = useMemo(() => {
    const list = calls ?? [];
    return MODE_KEYS.map((k) => {
      const rows = list.filter((c) => c.mode === k);
      const avg = rows.length
        ? Math.round(rows.reduce((s, c) => s + (c.close_probability ?? 0), 0) / rows.length)
        : 0;
      return {
        key: k,
        label: MODE_LABEL[k],
        count: rows.length,
        share: list.length ? Math.round((rows.length / list.length) * 100) : 0,
        avgProbability: avg,
      };
    });
  }, [calls]);

  const leaderboard = useMemo(() => {
    const byRep = new Map<
      string,
      { repId: string; calls: number; connects: number; talkSec: number; modes: Record<string, number>; revenue: number }
    >();
    for (const c of calls ?? []) {
      const key = c.rep_id ?? "unassigned";
      const row = byRep.get(key) ?? { repId: key, calls: 0, connects: 0, talkSec: 0, modes: {}, revenue: 0 };
      row.calls += 1;
      if (c.dial_outcome === "connected" || c.outcome === "completed") row.connects += 1;
      row.talkSec += c.duration_sec ?? 0;
      row.modes[c.mode] = (row.modes[c.mode] ?? 0) + 1;
      byRep.set(key, row);
    }
    for (const d of deals ?? []) {
      if (d.stage !== "won") continue;
      const key = d.owner_id ?? "unassigned";
      const row = byRep.get(key) ?? { repId: key, calls: 0, connects: 0, talkSec: 0, modes: {}, revenue: 0 };
      row.revenue += Number(d.value ?? 0);
      byRep.set(key, row);
    }
    return Array.from(byRep.values()).sort((a, b) => b.revenue - a.revenue || b.connects - a.connects);
  }, [calls, deals]);

  const trend = useMemo(() => {
    const buckets = rangeDays ? Math.min(rangeDays, 14) : 14;
    const span = rangeDays ? Math.ceil(rangeDays / buckets) : 7;
    const now = Date.now();
    const rows = Array.from({ length: buckets }, (_, i) => {
      const end = now - i * span * 86400000;
      const start = end - span * 86400000;
      const inRange = (calls ?? []).filter((c) => {
        const t = new Date(c.started_at).getTime();
        return t > start && t <= end;
      });
      return {
        label: new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        calls: inRange.length,
        connects: inRange.filter((c) => c.dial_outcome === "connected" || c.outcome === "completed").length,
      };
    }).reverse();
    return rows;
  }, [calls, rangeDays]);

  const trendMax = Math.max(1, ...trend.map((t) => t.calls));

  const outcomes = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of calls ?? []) {
      const key = (c.dial_outcome ?? c.outcome ?? "unknown") as string;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const total = (calls ?? []).length || 1;
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count, share: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [calls]);

  const funnel = useMemo(() => {
    const cols = (stages ?? []).filter((s) => s.kind !== "lost");
    const list = deals ?? [];
    const indexOf = new Map(cols.map((s, i) => [s.id, i]));
    const rows = cols.map((s, i) => {
      const here = list.filter((d) => d.stage_id === s.id);
      const reached = list.filter((d) => {
        const idx = indexOf.get(d.stage_id ?? "");
        return idx !== undefined && idx >= i;
      }).length;
      const stale = (s.stale_days ?? 0) > 0 && s.kind === "open"
        ? here.filter((d) => (Date.now() - new Date(d.updated_at).getTime()) / 86400000 > (s.stale_days ?? 0)).length
        : 0;
      return {
        id: s.id,
        label: s.label,
        kind: s.kind,
        here: here.length,
        value: here.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
        reached,
        stale,
      };
    });
    const top = rows[0]?.reached || 1;
    return rows.map((r, i) => ({
      ...r,
      share: Math.round((r.reached / top) * 100),
      conversion: i === 0 ? 100 : rows[i - 1].reached ? Math.round((r.reached / rows[i - 1].reached) * 100) : 0,
    }));
  }, [stages, deals]);



  const exportCsv = () => {
    const header = ["Rep", "Calls", "Connects", "Connect Rate", "Talk Minutes", "Closed Revenue"];
    const rows = leaderboard.map((r) => [
      nameFor(r.repId === "unassigned" ? null : r.repId),
      r.calls,
      r.connects,
      r.calls ? Math.round((r.connects / r.calls) * 100) + "%" : "0%",
      Math.round(r.talkSec / 60),
      r.revenue,
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-closer-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const money = (n: number) =>
    "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Leaderboards, responsiveness, and per-rep mode-usage breakdown."
        tabs={TAB_GROUPS.reports}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-xl border border-[#E7E7EC] bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                rangeDays === r.days ? "bg-[#141418] text-white font-medium" : "text-[#6B6B76] hover:text-[#141418]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={exportCsv} className="rounded-xl gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Kpi label="Calls Logged" value={String(totals.calls)} icon={PhoneCall} {...KPI_TINTS.blue} />
        <Kpi label="Connect Rate" value={`${totals.connectRate}%`} icon={Percent} {...KPI_TINTS.mint} />
        <Kpi label="Closed Revenue" value={money(totals.revenue)} icon={DollarSign} {...KPI_TINTS.red} />
        <Kpi label="Win Rate" value={`${totals.winRate}%`} icon={Trophy} {...KPI_TINTS.lavender} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-[#CC0000]" />
            </div>
            <div>
              <h3 className="font-semibold">Call Activity</h3>
              <p className="text-sm text-[#6B6B76]">Calls placed versus connects over the selected window.</p>
            </div>
          </div>
          <div className="mt-6 flex items-end gap-2 h-40">
            {trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  <div
                    className="w-1/2 rounded-t bg-[#F7CFC7]"
                    style={{ height: `${(t.calls / trendMax) * 100}%` }}
                    title={`${t.calls} calls`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-[#CC0000]"
                    style={{ height: `${(t.connects / trendMax) * 100}%` }}
                    title={`${t.connects} connects`}
                  />
                </div>
                <span className="text-[10px] text-[#9A9AA5] truncate w-full text-center">{t.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-[#6B6B76]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#F7CFC7] inline-block" /> Calls</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#CC0000] inline-block" /> Connects</span>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
          <h3 className="font-semibold">Outcome Breakdown</h3>
          <p className="text-sm text-[#6B6B76]">Where every dial in this window landed.</p>
          {outcomes.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No Calls In This Window" hint="Try a wider date range." />
          ) : (
            <div className="mt-4 space-y-3">
              {outcomes.map((o) => (
                <div key={o.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{titleCase(o.key.replace(/_/g, " "))}</span>
                    <span className="font-num text-[#6B6B76]">{o.count} · {o.share}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#F0F1F4]">
                    <div className="h-1.5 rounded-full bg-[#141418]" style={{ width: `${o.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
        <h3 className="font-semibold">Stage Conversion</h3>
        <p className="text-sm text-[#6B6B76]">How deals move through the pipeline, and where they stall.</p>
        {funnel.length === 0 ? (
          <EmptyState icon={Filter} title="No Pipeline Stages Yet" hint="Add pipeline columns to see conversion rates." />
        ) : (
          <div className="mt-4 space-y-3">
            {funnel.map((f) => (
              <div key={f.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    {titleCase(f.label)}
                    {f.stale ? (
                      <span className="text-[10px] font-medium text-[#B4690E] bg-[#B4690E]/10 rounded px-1.5 py-0.5">
                        {f.stale} Stalled
                      </span>
                    ) : null}
                  </span>
                  <span className="font-num text-[#6B6B76]">
                    {f.here} Here · {money(f.value)} · {f.conversion}% Conversion
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[#F0F1F4]">
                  <div
                    className={`h-2 rounded-full ${f.kind === "won" ? "bg-[#1F9D55]" : "bg-[#CC0000]"}`}
                    style={{ width: `${Math.max(2, f.share)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>



      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
        <h3 className="font-semibold">Mode Split</h3>
        <p className="text-sm text-[#6B6B76]">How the work is divided across AI, Hybrid and Copilot.</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {modeSplit.map((m) => (
            <div key={m.key} className="rounded-xl border border-[#E7E7EC] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="font-num text-sm text-[#6B6B76]">{m.share}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#F0F1F4]">
                <div className="h-1.5 rounded-full bg-[#CC0000]" style={{ width: `${m.share}%` }} />
              </div>
              <div className="mt-2 text-xs text-[#6B6B76]">
                {m.count} call{m.count === 1 ? "" : "s"} · Avg {m.avgProbability}% close probability
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Leaderboard</h3>
            <p className="text-sm text-[#6B6B76]">Ranked by closed revenue, then connects.</p>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <EmptyState icon={BarChart3} title="No Activity Yet" hint="Reports fill in as calls run and deals close." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Rep</th>
                <th className="py-2">Calls</th>
                <th className="py-2">Connect Rate</th>
                <th className="py-2">Talk Time</th>
                <th className="py-2">Mode Usage</th>
                <th className="py-2 text-right">Closed Revenue</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((r) => {
                const name = nameFor(r.repId === "unassigned" ? null : r.repId);
                const rate = r.calls ? Math.round((r.connects / r.calls) * 100) : 0;
                return (
                  <tr key={r.repId} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-3">
                      <span className="flex items-center gap-2.5 font-medium">
                        <Avatar name={name} /> {name}
                      </span>
                    </td>
                    <td className="py-3 font-num">{r.calls}</td>
                    <td className="py-3 font-num">{rate}%</td>
                    <td className="py-3 font-num">{Math.round(r.talkSec / 60)}m</td>
                    <td className="py-3">
                      <span className="flex flex-wrap gap-1">
                        {MODE_KEYS.filter((k) => r.modes[k]).map((k) => (
                          <StatusPill key={k} label={`${MODE_LABEL[k]} ${r.modes[k]}`} tone="neutral" />
                        ))}
                        {!MODE_KEYS.some((k) => r.modes[k]) && <span className="text-[#6B6B76]">—</span>}
                      </span>
                    </td>
                    <td className="py-3 text-right font-num font-semibold">{money(r.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
