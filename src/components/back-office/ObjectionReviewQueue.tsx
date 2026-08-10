import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyPanel, Panel, SkeletonRows, StatusPill } from "@/components/back-office/ui";
import { Check, Inbox, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import {
  listObjectionCandidates,
  reviewObjectionCandidate,
} from "@/lib/objection-candidates.functions";

type Candidate = {
  id: string;
  industry: string | null;
  prospect_text: string;
  ai_response: string;
  label: string | null;
  mode: string | null;
  occurrences: number;
  status: string;
  last_seen_at: string;
};

type ProfileOption = { id: string; name: string; industry: string | null };

/**
 * Objections the AI had to improvise on. A human edits the wording and promotes
 * it into a closer profile, so the library only grows through review.
 */
export function ObjectionReviewQueue({ profiles }: { profiles: ProfileOption[] }) {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(listObjectionCandidates);
  const review = useServerFn(reviewObjectionCandidate);

  const [showResolved, setShowResolved] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { trigger: string; response: string; profileId: string }>>({});

  const q = useQuery({ queryKey: ["objection-candidates"], queryFn: () => fetchQueue({}) });
  const all = (q.data?.candidates ?? []) as unknown as Candidate[];

  const rows = useMemo(
    () => all.filter((c) => (showResolved ? c.status !== "pending" : c.status === "pending")),
    [all, showResolved],
  );
  const pendingCount = all.filter((c) => c.status === "pending").length;

  const mut = useMutation({
    mutationFn: (input: {
      id: string;
      action: "approve" | "dismiss" | "reopen";
      profileId?: string | null;
      trigger?: string | null;
      approvedResponse?: string | null;
    }) => review({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(
        v.action === "approve"
          ? "Added to the profile's objection library."
          : v.action === "dismiss"
            ? "Dismissed."
            : "Back in the queue.",
      );
      void logActivity(`objection.${v.action}d`, { trigger: v.trigger ?? "", candidate_id: v.id });
      qc.invalidateQueries({ queryKey: ["objection-candidates"] });
      qc.invalidateQueries({ queryKey: ["closer-profiles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const draftFor = (c: Candidate) =>
    drafts[c.id] ?? {
      trigger: c.prospect_text,
      response: c.ai_response,
      profileId: profiles.find((p) => p.industry === c.industry)?.id ?? profiles[0]?.id ?? "",
    };

  const patch = (id: string, next: Partial<{ trigger: string; response: string; profileId: string }>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(all.find((c) => c.id === id)!), ...next } }));

  return (
    <Panel
      title="Objection Review Queue"
      className="mb-4"
      action={
        <div className="flex items-center gap-2">
          <StatusPill label={`${pendingCount} Pending`} tone={pendingCount ? "amber" : "neutral"} />
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Show Pending" : "Show Reviewed"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-[#6B6B76]">
        When a live call hits an objection with no approved answer, the AI improvises once and the moment lands here.
        Edit the wording, pick the profile it belongs to, and it becomes an approved line the next call reuses.
      </p>

      {q.isLoading ? (
        <div className="mt-3">
          <SkeletonRows />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyPanel
            icon={Inbox}
            title={showResolved ? "Nothing Reviewed Yet" : "Nothing Waiting For Review"}
            hint="Improvised answers from live calls show up here automatically."
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((c) => {
            const d = draftFor(c);
            const resolved = c.status !== "pending";
            return (
              <div key={c.id} className="rounded-2xl border border-[#E7E7EC] p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B76]">
                  {c.label ? <StatusPill label={c.label} tone="neutral" /> : null}
                  {c.industry ? <span>{c.industry}</span> : null}
                  {c.mode ? <span>· {c.mode}</span> : null}
                  <span>· Heard {c.occurrences}×</span>
                  <span>· {new Date(c.last_seen_at).toLocaleString()}</span>
                  {resolved ? (
                    <span className="ml-auto">
                      <StatusPill label={c.status === "approved" ? "Approved" : "Dismissed"} tone={c.status === "approved" ? "green" : "neutral"} />
                    </span>
                  ) : null}
                </div>

                {resolved ? (
                  <>
                    <p className="mt-2 text-sm text-[#111114]">“{c.prospect_text}”</p>
                    <p className="mt-1 text-sm text-[#6B6B76]">{c.ai_response}</p>
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => mut.mutate({ id: c.id, action: "reopen" })}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" /> Reopen
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 grid gap-2">
                      <Input
                        value={d.trigger}
                        onChange={(e) => patch(c.id, { trigger: e.target.value })}
                        placeholder="What the prospect said"
                        className="rounded-xl"
                      />
                      <Textarea
                        value={d.response}
                        onChange={(e) => patch(c.id, { response: e.target.value })}
                        rows={3}
                        placeholder="The exact words the closer should say back"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select value={d.profileId} onValueChange={(v) => patch(c.id, { profileId: v })}>
                        <SelectTrigger className="w-[260px] rounded-xl">
                          <SelectValue placeholder="Add to profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
                        disabled={!d.profileId || mut.isPending}
                        onClick={() =>
                          mut.mutate({
                            id: c.id,
                            action: "approve",
                            profileId: d.profileId,
                            trigger: d.trigger,
                            approvedResponse: d.response,
                          })
                        }
                      >
                        <Check className="h-4 w-4 mr-1" /> Approve Into Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ id: c.id, action: "dismiss" })}
                      >
                        <X className="h-4 w-4 mr-1" /> Dismiss
                      </Button>
                      {profiles.length === 0 ? (
                        <span className="text-xs text-[#CC0000]">
                          Create a workspace profile first — platform profiles are read-only.
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
