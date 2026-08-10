import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { listProfileVersions, restoreProfileVersion } from "@/lib/profile-versions.functions";
import { logActivity } from "@/lib/activity";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Saved By A Human",
  restore: "Restored",
  seed: "Copy Before The Change",
  import: "Imported",
};

/** Read-only change log for one closer profile, with one-click restore. */
export function ProfileHistory({
  profileId,
  onRestored,
}: {
  profileId: string;
  onRestored?: () => void;
}) {
  const qc = useQueryClient();
  const fetchVersions = useServerFn(listProfileVersions);
  const restoreFn = useServerFn(restoreProfileVersion);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const versionsQ = useQuery({
    queryKey: ["closer-profile-versions", profileId],
    enabled: open,
    queryFn: () => fetchVersions({ data: { profileId } }),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreFn({ data: { versionId } }),
    onSuccess: (r: any) => {
      toast.success(`Profile restored from version ${r.restoredFrom}.`);
      qc.invalidateQueries({ queryKey: ["closer-profiles"] });
      qc.invalidateQueries({ queryKey: ["closer-profile-versions"] });
      onRestored?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const versions = versionsQ.data?.versions ?? [];

  return (
    <div className="rounded-xl border border-[#E7E7EC]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[#111114]">
          <History className="h-4 w-4 text-[#6B6B76]" /> Change History
        </span>
        <span className="text-xs text-[#6B6B76]">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="border-t border-[#E7E7EC] px-3 py-3">
          {versionsQ.isLoading ? (
            <p className="text-xs text-[#6B6B76]">Loading history…</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-[#6B6B76]">
              No history yet. Every save is recorded here so you can compare it against, or roll back to, an earlier copy.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v: any) => {
                const snap = v.snapshot ?? {};
                return (
                  <li key={v.id} className="rounded-lg border border-[#E7E7EC] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111114]">
                          Version {v.version} · {SOURCE_LABEL[v.source] ?? v.source}
                        </p>
                        <p className="text-xs text-[#6B6B76]">
                          {new Date(v.created_at).toLocaleString()}
                          {v.note ? ` · ${v.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setExpanded((e) => (e === v.id ? null : v.id))}
                        >
                          {expanded === v.id ? "Hide Copy" : "View Copy"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-lg border-[#E7E7EC] text-xs"
                          disabled={restore.isPending}
                          onClick={() => restore.mutate(v.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" /> Restore
                        </Button>
                      </div>
                    </div>

                    {expanded === v.id && (
                      <div className="mt-2 space-y-2 rounded-lg bg-[#F7F7F9] p-3 text-xs leading-relaxed text-[#3A3A44]">
                        <p>
                          <span className="font-medium text-[#111114]">Name:</span> {snap.name ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium text-[#111114]">Opener:</span> {snap.opener ?? "—"}
                        </p>
                        {snap.tone ? (
                          <p>
                            <span className="font-medium text-[#111114]">Tone:</span> {snap.tone}
                          </p>
                        ) : null}
                        <p>
                          <span className="font-medium text-[#111114]">Objection Lines:</span>{" "}
                          {(snap.objections ?? []).length}
                        </p>
                        {(snap.objections ?? []).slice(0, 4).map((o: any, i: number) => (
                          <p key={i} className="pl-3">
                            “{o.trigger}” → {o.approved_response}
                          </p>
                        ))}
                        <p>
                          <span className="font-medium text-[#111114]">Screening:</span>{" "}
                          {(snap.screening_questions ?? []).length} · {" "}
                          <span className="font-medium text-[#111114]">Known Answers:</span>{" "}
                          {(snap.faqs ?? []).length}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
