import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/back-office/AppShell";
import { Avatar, EmptyState, KPI_TINTS, Kpi, Panel, StatusPill, titleCase, toneForStatus } from "@/components/back-office/ui";
import { describeEvent, eventHref } from "@/lib/activity-labels";
import { Activity, Bot, DollarSign, Eye, ListChecks, Percent, Phone, PhoneCall, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { OnboardingChecklist } from "@/components/back-office/OnboardingChecklist";
import { dueLabel, type TaskRow } from "@/components/back-office/TaskPanel";
import { useServerFn } from "@tanstack/react-start";
import { listWorklist } from "@/lib/governance.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Master Closer" },
      { name: "description", content: "Today's calls, close rate, revenue, and mode-split analytics across AI, Hybrid, and Copilot." },
      { property: "og:title", content: "Dashboard — Master Closer" },
      { property: "og:description", content: "Today's calls, close rate, revenue, and mode-split analytics across AI, Hybrid, and Copilot." },
    ],
  }),
  component: Dashboard,
});

// Tonal crimson ramp so the chart reads as one brand family, not three unrelated colors.
const MODE_COLORS = ["#CC0000", "#EE7A66", "#F7CFC7"];

function Dashboard() {
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ count: callsToday }, { data: deals }, { data: calls }] = await Promise.all([
        supabase.from("calls").select("id", { count: "exact", head: true }).eq("workspace_id", wsId!).gte("started_at", today.toISOString()),
        supabase.from("deals").select("value,stage").eq("workspace_id", wsId!),
        supabase.from("calls").select("mode,outcome,close_probability,started_at").eq("workspace_id", wsId!).order("started_at", { ascending: false }).limit(200),
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
        name: m === "full_ai" ? "AI" : m === "hybrid" ? "Hybrid" : "Copilot",
        mode: m,
        value: (calls ?? []).filter((c) => c.mode === m).length,
      }));
      return { callsToday: callsToday ?? 0, revenue, closeRate, avgProb, modeSplit, totalCalls: calls?.length ?? 0 };
    },
  });

  const { data: recentDeals } = useQuery({
    queryKey: ["recent-deals", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("deals")
        .select("id,title,value,stage,updated_at").eq("workspace_id", wsId!).order("updated_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const { data: dueTasks } = useQuery({
    queryKey: ["dashboard-tasks", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_at,priority,status,leads(name)")
        .eq("workspace_id", wsId!)
        .eq("status", "open")
        .lte("due_at", end.toISOString())
        .order("due_at", { ascending: true })
        .limit(6);
      return (data ?? []) as (TaskRow & { leads: { name: string } | null })[];
    },
  });

  /* Lead Scout's picks for today, so the book gets worked, not just the recent end of it. */
  const fetchWorklist = useServerFn(listWorklist);
  const { data: worklist } = useQuery({
    queryKey: ["dashboard-worklist"],
    queryFn: () => fetchWorklist(),
  });

  const { data: activity } = useQuery({
    queryKey: ["dashboard-activity", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id,event_type,payload,created_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });


  const split = stats?.modeSplit ?? [];
  const total = split.reduce((s, m) => s + m.value, 0);
  const pct = split.map((m) => (total ? (m.value / total) * 100 : 0));
  const stops = pct.reduce<string[]>((acc, p, i) => {
    const start = pct.slice(0, i).reduce((s, v) => s + v, 0);
    acc.push(`${MODE_COLORS[i]} ${start}% ${start + p}%`);
    return acc;
  }, []);
  const donut = total
    ? `conic-gradient(${stops.join(", ")})`
    : "conic-gradient(#F4F0EF 0 100%)";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today's activity across every autonomy mode."
        action={
          <Link to="/campaigns" className="btn-primary">
            <Sparkles size={15} strokeWidth={2.3} /> New Campaign
          </Link>
        }
      />

      <OnboardingChecklist />

      <div className="kpis">
        <Kpi label="Calls Today" value={String(stats?.callsToday ?? 0)} icon={PhoneCall} {...KPI_TINTS.blue} delta="Today" to="/calls" />
        <Kpi label="Close Rate" value={`${(stats?.closeRate ?? 0).toFixed(1)}%`} icon={Percent} {...KPI_TINTS.red} delta="Last 200" to="/team" />
        <Kpi label="Revenue Closed" value={`$${(stats?.revenue ?? 0).toLocaleString()}`} icon={DollarSign} {...KPI_TINTS.mint} delta="Won" to="/pipeline" />
        <Kpi label="Avg Close Probability" value={`${(stats?.avgProb ?? 0).toFixed(0)}%`} icon={TrendingUp} {...KPI_TINTS.lavender} delta="Live" to="/calls" />
      </div>

      <div className="grid-2">
        <Panel
          title="Recent Deals"
          action={<Link to="/pipeline" search={{ deal: undefined }} className="card-link">View All</Link>}
        >
          {recentDeals && recentDeals.length > 0 ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Updated</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recentDeals.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="cell-name">
                        <Avatar name={d.title ?? "Deal"} />
                        <span>{d.title}</span>
                      </div>
                    </td>
                    <td className="muted font-num">
                      {new Date(d.updated_at as string).toLocaleDateString()}
                    </td>
                    <td>
                      <StatusPill label={titleCase(d.stage)} tone={toneForStatus(d.stage)} />
                    </td>
                    <td className="font-num">${Number(d.value ?? 0).toLocaleString()}</td>
                    <td>
                      <div className="row-acts">
                        <Link to="/dialer" aria-label="Call In Dialer" title="Call In Dialer"><Phone size={15} /></Link>
                        <Link to="/pipeline" search={{ deal: d.id }} aria-label="View Deal" title="View Deal"><Eye size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={DollarSign} title="No Deals Yet" hint="Deals will appear here as your team closes." />
          )}
        </Panel>

        <Panel title="How Calls Ran">
          <div className="donut-wrap">
            <div className="donut" style={{ background: donut }}>
              <div className="donut-hole">
                <span className="font-num">{stats?.totalCalls ?? 0}</span>
                <small>Calls</small>
              </div>
            </div>
          </div>
          <div className="legend">
            {split.map((m, i) => (
              <Link
                key={m.name}
                to="/calls"
                search={{ mode: m.mode, campaign: undefined, agent: undefined, call: undefined }}
                className="legend-row legend-link"
              >
                <span className="legend-dot" style={{ background: MODE_COLORS[i] }} />
                <span>{m.name}</span>
                <span className="font-num legend-v">{pct[i].toFixed(0)}%</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Follow-Ups Due"
        action={<Link to="/tasks" className="card-link">View All</Link>}
      >
        {dueTasks && dueTasks.length > 0 ? (
          <ul className="space-y-2">
            {dueTasks.map((t) => {
              const d = dueLabel(t.due_at);
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                  <ListChecks className="h-4 w-4 text-[#CC0000]" />
                  <span className="font-medium">{t.title}</span>
                  <span className="text-[#6B6B76]">{t.leads?.name ?? "Unlinked"}</span>
                  <span className={"ml-auto " + (d.tone === "late" ? "text-[#CC0000]" : "text-[#B45309]")}>{d.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={ListChecks} title="Nothing Due Today" hint="Follow-ups you schedule will surface here." />
        )}
      </Panel>

      <Panel
        title="Suggested Today"
        action={<Link to="/agents" className="card-link">View Worklist</Link>}
      >
        {worklist?.rows?.length ? (
          <ul className="space-y-2">
            {worklist.rows.slice(0, 5).map((r: any) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                <Bot className="h-4 w-4 text-[#CC0000]" />
                <span className="font-medium">{r.who}</span>
                {r.product_line ? (
                  <span className="text-[#6B6B76] capitalize">{String(r.product_line).replace(/_/g, " ")}</span>
                ) : null}
                <span className="text-[#6B6B76] truncate">{r.reason_text ?? titleCase(String(r.reason_code ?? ""))}</span>
                <span className="ml-auto shrink-0 text-[#6B6B76]">{Math.round(Number(r.score ?? 0))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Bot}
            title="No Suggestions Yet"
            hint="Lead Scout nominates who is genuinely worth a call each time it runs."
          />
        )}
      </Panel>

      <Panel
        title="Recent Activity"
        action={<Link to="/activity" className="card-link">View All</Link>}
      >
        {activity && activity.length > 0 ? (
          <ul className="space-y-2">
            {activity.map((e: any) => {
              const a = describeEvent(e);
              const href = eventHref(e);
              const body = (
                <>
                  <a.icon className="h-4 w-4 text-[#CC0000]" />
                  <span className="font-medium">{a.label}</span>
                  <span className="text-[#6B6B76] truncate">{a.detail}</span>
                  <span className="ml-auto text-[#6B6B76] shrink-0">
                    {new Date(e.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </>
              );
              const cls = "flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm";
              return (
                <li key={e.id}>
                  {href ? (
                    <Link to={href} className={`${cls} hover:border-[#CC0000] transition-colors`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Activity} title="No Activity Yet" hint="Calls, sent agreements and won deals appear here." />
        )}
      </Panel>
    </div>
  );
}


