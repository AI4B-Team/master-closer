import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Link2, Unlink, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getCoreTenancy, linkWorkspaceToCore, unlinkWorkspaceFromCore, listCoreSuppressions,
} from "@/lib/core/policy.functions";

/**
 * Core is the tenancy and suppression authority. This panel shows whether the
 * active workspace is bound to a Core tenant and mirrors the suppressions Core
 * holds for it. Nothing here is cached or synthesized locally.
 */
export function CoreGovernancePanel() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const [pick, setPick] = useState("");

  const tenancy = useServerFn(getCoreTenancy);
  const link = useServerFn(linkWorkspaceToCore);
  const unlink = useServerFn(unlinkWorkspaceFromCore);
  const suppressions = useServerFn(listCoreSuppressions);

  const { data: core, isLoading } = useQuery({
    queryKey: ["core-tenancy", wsId],
    enabled: !!wsId,
    queryFn: () => tenancy(),
  });

  const linked = !!core?.link;

  const { data: supp } = useQuery({
    queryKey: ["core-suppressions", wsId, linked],
    enabled: !!wsId && linked,
    queryFn: () => suppressions(),
  });

  const doLink = useMutation({
    mutationFn: async () => {
      if (!pick) throw new Error("Choose a Core workspace first.");
      return link({ data: { coreWorkspaceId: pick } });
    },
    onSuccess: (r) => {
      toast.success(`Linked to ${r.name}.`);
      qc.invalidateQueries({ queryKey: ["core-tenancy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doUnlink = useMutation({
    mutationFn: () => unlink(),
    onSuccess: () => {
      toast.success("Workspace unlinked from Core.");
      qc.invalidateQueries({ queryKey: ["core-tenancy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Network className="h-4 w-4 text-[#CC0000]" /> Core Tenancy & Suppression
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            When this workspace is linked, Core authorizes every dial at the moment of contact and
            holds the shared opt-out list. If Core cannot answer, the dial is blocked.
          </p>
        </div>
        {linked ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Governed By Core</Badge>
        ) : (
          <Badge variant="secondary">Not Linked</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking Core…</p>
      ) : core?.error ? (
        <p className="mt-4 text-sm text-[#CC0000]">Core unavailable ({core.error}).</p>
      ) : linked ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Core Workspace</dt>
              <dd className="font-mono text-xs">{core!.link!.coreWorkspaceId}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Legal Entity</dt>
              <dd className="font-mono text-xs">{core!.link!.coreLegalEntityId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Linked</dt>
              <dd>{core!.link!.linkedAt ? new Date(core!.link!.linkedAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>

          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldOff className="h-4 w-4" /> Core Suppressions
            </h4>
            {supp?.status === "error" ? (
              <p className="mt-2 text-sm text-[#CC0000]">Could not read suppressions ({supp.reason}).</p>
            ) : (supp?.suppressions ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Core holds no suppressions for this tenant.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Identifier</th>
                      <th className="py-2">Channel</th>
                      <th className="py-2">Reason</th>
                      <th className="py-2">Source</th>
                      <th className="py-2">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(supp?.suppressions ?? []).slice(0, 50).map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2">{s.channel === "email" ? s.identifier : formatPhone(s.identifier)}</td>
                        <td className="py-2 capitalize">{s.channel}</td>
                        <td className="py-2">{s.reason}</td>
                        <td className="py-2 text-muted-foreground">{s.sourceAppId ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Button variant="outline" onClick={() => doUnlink.mutate()} disabled={doUnlink.isPending}>
            <Unlink className="mr-2 h-4 w-4" /> Unlink From Core
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Label>Core Workspace</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="w-[320px] bg-white">
                <SelectValue placeholder={(core?.workspaces ?? []).length ? "Choose a Core workspace" : "No entitled workspaces"} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {(core?.workspaces ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => doLink.mutate()} disabled={!pick || doLink.isPending}>
              <Link2 className="mr-2 h-4 w-4" /> Link Workspace
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Until this workspace is linked, local Do Not Call and calling-window rules govern outreach.
          </p>
        </div>
      )}
    </Card>
  );
}
