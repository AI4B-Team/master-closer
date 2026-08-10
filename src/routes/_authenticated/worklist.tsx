import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { EmptyPanel, Panel, SkeletonRows } from "@/components/back-office/ui";
import { listWorklist, sendWorklistFeedback, undoWorklistFeedback } from "@/lib/governance.functions";
import { Bot, Phone, ThumbsDown, X, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/worklist")({
  head: () => ({
    meta: [
      { title: "Worklist — Master Closer" },
      {
        name: "description",
        content:
          "Lead Scout's picks for today: who is genuinely worth a call, why they surfaced, and one click to dial them.",
      },
      { property: "og:title", content: "Worklist — Master Closer" },
      {
        property: "og:description",
        content: "A ranked call list with the reason each person surfaced, plus feedback that trains the scorer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorklistPage,
});

function titleCase(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function WorklistPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchWorklist = useServerFn(listWorklist);
  const feedback = useServerFn(sendWorklistFeedback);
  const undo = useServerFn(undoWorklistFeedback);
  const [hidden, setHidden] = useState<Record<string, true>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["worklist"],
    queryFn: () => fetchWorklist(),
  });

  const act = useMutation({
    mutationFn: async (v: { id: string; action: "worked" | "not_hot" | "dismiss"; score?: number }) =>
      await feedback({ data: { nomination_id: v.id, action: v.action, score: v.score } }),
    onSuccess: (res, v) => {
      setHidden((h) => ({ ...h, [v.id]: true }));
      toast.success(v.action === "worked" ? "Marked As Worked." : "Feedback Recorded.", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await undo({ data: { id: (res as any).id } });
              setHidden((h) => {
                const next = { ...h };
                delete next[v.id];
                return next;
              });
              qc.invalidateQueries({ queryKey: ["worklist"] });
            } catch (e: any) {
              toast.error(e?.message ?? "Could not undo that.");
            }
          },
        },
      });
      qc.invalidateQueries({ queryKey: ["dashboard-worklist"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record that."),
  });

  const rows = (data?.rows ?? []).filter((r: any) => !hidden[r.id]);

  return (
    <div>
      <PageHeader
        title="Worklist"
        description="Lead Scout nominates who is genuinely due a call. Nothing is padded — an empty worklist means nothing is owed today."
        tabs={TAB_GROUPS.leads}
      />

      <Panel
        title="Suggested Today"
        action={
          rows.length > 0 ? (
            <Badge variant="outline" className="rounded-full">
              {rows.length} Nominated
            </Badge>
          ) : null
        }
      >
        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : rows.length === 0 ? (
          <EmptyPanel
            icon={Bot}
            title="Nothing Due Right Now"
            hint="Lead Scout runs on a schedule and only nominates contacts with a real reason to call."
          />
        ) : (
          <ul className="divide-y divide-[#E7E7EC]">
            {rows.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#111114]">{r.who}</p>
                    {r.product_line ? (
                      <Badge variant="outline" className="rounded-full text-xs capitalize">
                        {String(r.product_line).replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                    {r.suggested ? (
                      <Badge variant="secondary" className="rounded-full text-xs">
                        Suggested
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B6B76]">
                    {r.reason_text || titleCase(String(r.reason_code ?? ""))}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[#111114]">{Math.round(Number(r.score ?? 0))}</p>
                  <p className="text-xs text-[#6B6B76]">Score</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl bg-[#CC0000] hover:bg-[#A30000]"
                    disabled={!r.phone}
                    onClick={() => {
                      act.mutate({ id: r.id, action: "worked", score: Number(r.score ?? 0) });
                      navigate({ to: "/dialer", search: { number: r.phone } });
                    }}
                  >
                    <Phone className="mr-1 h-4 w-4" /> Call
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => act.mutate({ id: r.id, action: "not_hot", score: Number(r.score ?? 0) })}
                  >
                    <ThumbsDown className="mr-1 h-4 w-4" /> Not Hot
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => act.mutate({ id: r.id, action: "dismiss", score: Number(r.score ?? 0) })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-[#6B6B76]">
          <Undo2 className="h-3.5 w-3.5" /> Every Not Hot Or Dismiss Trains The Scorer, And Can Be Undone.
        </p>
      </Panel>
    </div>
  );
}
