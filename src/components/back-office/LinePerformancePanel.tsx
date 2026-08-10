import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyPanel, Panel, SkeletonRows } from "@/components/back-office/ui";
import { linePerformance } from "@/lib/line-performance.functions";
import { BarChart3 } from "lucide-react";

const RANGES = [7, 30, 90] as const;

/**
 * Line Performance — which objection answers get used on live calls and which
 * of those calls ended in a win. Read-only: promoting a line stays a human
 * decision in the profile editor.
 */
export function LinePerformancePanel() {
  const run = useServerFn(linePerformance);
  const [days, setDays] = useState<number>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["line-performance", days],
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
      <p className="mb-4 text-sm text-[#6B6B76]">
        How Each Objection Answer Performs On Live Calls.
      </p>

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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
