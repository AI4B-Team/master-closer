import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({ meta: [{ title: "Calls & Transcripts — Master Closer" }] }),
  component: CallsPage,
});

const MODE_LABEL: Record<string, string> = {
  full_ai: "AI", hybrid: "Hybrid", copilot: "Copilot",
};

function CallsPage() {
  const { data: calls } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calls")
        .select("*, leads(name, company)").order("started_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Calls"
        description="History — every conversation with transcript, AI summary, and moves."
        tabs={TAB_GROUPS.calls}
      />

      <Card className="p-4 rounded-2xl border-[#E7E7EC] shadow-none">
        {!calls || calls.length === 0 ? (
          <div className="text-center py-16">
            <PhoneCall className="h-8 w-8 mx-auto text-[#6B6B76] mb-3" />
            <p className="font-medium">No calls yet</p>
            <p className="text-sm text-[#6B6B76] mt-1">Calls appear here once the dialer runs.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">Date</th><th className="py-2">Lead</th>
                <th className="py-2">Mode</th><th className="py-2">Duration</th>
                <th className="py-2">Outcome</th><th className="py-2 text-right">Close Probability</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c: any) => (
                <tr key={c.id} className="border-b border-[#E7E7EC] last:border-0 hover:bg-[#F4F4F6]/50">
                  <td className="py-3 text-[#6B6B76] font-mono text-xs">
                    {new Date(c.started_at).toLocaleString()}
                  </td>
                  <td className="py-3 font-medium">
                    {c.leads?.name ?? "—"}{c.leads?.company ? ` · ${c.leads.company}` : ""}
                  </td>
                  <td className="py-3">
                    <Badge variant="secondary">{MODE_LABEL[c.mode] ?? c.mode}</Badge>
                  </td>
                  <td className="py-3 font-mono">{Math.floor((c.duration_sec ?? 0) / 60)}m {(c.duration_sec ?? 0) % 60}s</td>
                  <td className="py-3 capitalize">{c.outcome}</td>
                  <td className="py-3 text-right font-mono">{c.close_probability ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
