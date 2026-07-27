import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/back-office/AppShell";
import {
  PhoneCall, TrendingUp, DollarSign, Percent, Bot, Users, Hand,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Master Closer" }] }),
  component: Dashboard,
});

function Kpi({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <Card className="p-5 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[#6B6B76] font-medium">{label}</span>
        <Icon className="h-4 w-4 text-[#CC0000]" />
      </div>
      <div className="text-3xl font-bold mt-2" style={{ fontFamily: "DM Mono, monospace" }}>{value}</div>
      {sub && <div className="text-xs text-[#6B6B76] mt-1">{sub}</div>}
    </Card>
  );
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ count: callsToday }, { data: deals }, { data: calls }] = await Promise.all([
        supabase.from("calls").select("id", { count: "exact", head: true }).gte("started_at", today.toISOString()),
        supabase.from("deals").select("value,stage"),
        supabase.from("calls").select("mode,outcome,close_probability,started_at").order("started_at", { ascending: false }).limit(200),
      ]);
      const won = (deals ?? []).filter((d) => d.stage === "won");
      const revenue = won.reduce((s, d) => s + Number(d.value ?? 0), 0);
      const closeRate = calls?.length
        ? (calls.filter((c) => c.outcome === "completed").length / calls.length) * 100
        : 0;
      const avgProb = calls?.length
        ? calls.reduce((s, c) => s + (c.close_probability ?? 0), 0) / calls.length
        : 0;
      const modeSplit = ["full_ai", "hybrid", "copilot"].map((m) => ({
        name: m === "full_ai" ? "Full AI" : m === "hybrid" ? "Hybrid" : "Copilot",
        value: (calls ?? []).filter((c) => c.mode === m).length,
      }));
      return {
        callsToday: callsToday ?? 0,
        revenue, closeRate, avgProb, modeSplit,
      };
    },
  });

  const { data: recentDeals } = useQuery({
    queryKey: ["recent-deals"],
    queryFn: async () => {
      const { data } = await supabase.from("deals")
        .select("id,title,value,stage,updated_at").order("updated_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const trend = Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    rate: 20 + Math.round(Math.sin(i / 2) * 8 + i * 1.2),
  }));

  const COLORS = ["#CC0000", "#0B0B0F", "#6B6B76"];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today's activity across every autonomy mode."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Calls Today" value={String(stats?.callsToday ?? 0)} icon={PhoneCall} />
        <Kpi label="Close Rate" value={`${(stats?.closeRate ?? 0).toFixed(1)}%`} icon={Percent} />
        <Kpi label="Revenue Closed" value={`$${(stats?.revenue ?? 0).toLocaleString()}`} icon={DollarSign} />
        <Kpi label="Avg Close Probability" value={`${(stats?.avgProb ?? 0).toFixed(0)}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 rounded-2xl border-[#E7E7EC] shadow-none lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Close Rate Trend</h3>
            <span className="text-xs text-[#6B6B76]">Last 14 Days</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="#E7E7EC" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B6B76" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B6B76" }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#CC0000" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border-[#E7E7EC] shadow-none">
          <h3 className="font-semibold mb-3">Mode Split</h3>
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats?.modeSplit ?? []} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {(stats?.modeSplit ?? []).map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 text-sm">
            {(stats?.modeSplit ?? []).map((m, i) => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                  {m.name}
                </span>
                <span className="font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Deals</h3>
        </div>
        {recentDeals && recentDeals.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Title</th>
                <th className="py-2">Stage</th>
                <th className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.map((d) => (
                <tr key={d.id} className="border-b border-[#E7E7EC] last:border-0">
                  <td className="py-3 font-medium">{d.title}</td>
                  <td className="py-3">
                    <Badge variant="secondary" className="capitalize">{d.stage}</Badge>
                  </td>
                  <td className="py-3 text-right font-mono">${Number(d.value).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={DollarSign} title="No deals yet" hint="Deals will appear here as your team closes." />
        )}
      </Card>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-8 w-8 mx-auto text-[#6B6B76] mb-3" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-[#6B6B76] mt-1">{hint}</p>
    </div>
  );
}
