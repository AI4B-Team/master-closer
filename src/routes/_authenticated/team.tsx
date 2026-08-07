import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { Avatar, EmptyState, Kpi, KPI_TINTS, StatusPill } from "@/components/back-office/ui";
import { BarChart3, PhoneCall, Trophy, Percent, DollarSign } from "lucide-react";
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

function ReportsPage() {
  const { data: calls } = useQuery({
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
      const { data } = await supabase.from("deals").select("id, value, stage, owner_id");
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

  const money = (n: number) =>
    "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Leaderboards, responsiveness, and per-rep mode-usage breakdown."
        tabs={TAB_GROUPS.reports}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Kpi label="Calls Logged" value={String(totals.calls)} icon={PhoneCall} {...KPI_TINTS.blue} />
        <Kpi label="Connect Rate" value={`${totals.connectRate}%`} icon={Percent} {...KPI_TINTS.mint} />
        <Kpi label="Closed Revenue" value={money(totals.revenue)} icon={DollarSign} {...KPI_TINTS.red} />
        <Kpi label="Win Rate" value={`${totals.winRate}%`} icon={Trophy} {...KPI_TINTS.lavender} />
      </div>

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
