import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyPanel, Panel, SkeletonRows } from "@/components/back-office/ui";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { linePerformance, promoteLineToProfile } from "@/lib/line-performance.functions";
import { BarChart3, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { useWorkspace } from "@/hooks/use-workspace";

const RANGES = [7, 30, 90] as const;

/**
 * Line Performance — which objection answers get used on live calls and which
 * of those calls ended in a win. Proven lines can be promoted into a workspace
 * closer profile, but only by a human clicking Promote.
 */
export function LinePerformancePanel({
  profiles = [],
}: {
  profiles?: Array<{ id: string; name: string }>;
}) {
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const run = useServerFn(linePerformance);
  const promote = useServerFn(promoteLineToProfile);
  const [days, setDays] = useState<number>(30);
  const [target, setTarget] = useState<string>(profiles[0]?.id ?? "");

  const promoting = useMutation({
    mutationFn: async (row: { objection: string; topLine: string }) => {
      if (!target) throw new Error("Pick a workspace profile to promote into.");
      return await promote({
        data: { profileId: target, trigger: row.objection, response: row.topLine },
      });
    },
    onSuccess: (_r, row) => {
      toast.success("Line Promoted Into Profile.");
      void logActivity("line.promoted", { trigger: row.objection, profile_id: target });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not promote that line."),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["line-performance", wsId, days],
    enabled: !!wsId,
    queryFn: async () => await run({ data: { days } }),
  });

  const rows = data?.rows ?? [];

  return (
    <Panel
      title="Line Performance"
      action={
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={days === r ? "secondary" : "ghost"}
              className="rounded-full h-7 px-3 text-xs"
              onClick={() => setDays(r)}
            >
              {r}d
            </Button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-[#6B6B76]">
          How Each Objection Answer Performs On Live Calls.
        </p>
        {profiles.length > 0 && (
          <div className="w-56">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 rounded-xl text-xs">
                <SelectValue placeholder="Promote Into…" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyPanel
          icon={BarChart3}
          title="No Line Data Yet"
          hint="Run live calls in Copilot Or Hybrid and used lines will start scoring here."
        />
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-4 text-xs text-[#6B6B76]">
            <Badge variant="outline" className="rounded-full">
              {data?.totals.surfaced ?? 0} Surfaced
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {data?.totals.used ?? 0} Used
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              {data?.totals.wins ?? 0} Wins
            </Badge>
          </div>

          <div className="divide-y divide-[#E7E7EC]">
            {rows.map((r) => (
              <div key={r.objection} className="py-3 flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111114]">{r.objection}</p>
                  <p className="mt-0.5 text-xs text-[#6B6B76] line-clamp-2">{r.topLine}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[#111114]">{r.winRate}% Win</p>
                  <p className="text-xs text-[#6B6B76]">
                    {r.used}/{r.surfaced} Used · {r.adoption}% Adoption
                  </p>
                  {profiles.length > 0 && r.topLine ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 rounded-full px-2 text-xs"
                      disabled={promoting.isPending}
                      onClick={() => promoting.mutate({ objection: r.objection, topLine: r.topLine })}
                    >
                      <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> Promote
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
