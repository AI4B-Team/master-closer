import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Link2, Unlink, ShieldOff, ListFilter, RefreshCw, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/phone";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getCoreTenancy, linkWorkspaceToCore, unlinkWorkspaceFromCore, listCoreSuppressions,
  screenCallListWithCore, syncCoreSuppressions,
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
  const [listId, setListId] = useState("");
  const [denialAction, setDenialAction] = useState<"all" | "call" | "record">("all");

  const tenancy = useServerFn(getCoreTenancy);
  const link = useServerFn(linkWorkspaceToCore);
  const unlink = useServerFn(unlinkWorkspaceFromCore);
  const suppressions = useServerFn(listCoreSuppressions);
  const screen = useServerFn(screenCallListWithCore);
  const sync = useServerFn(syncCoreSuppressions);

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

  const { data: lists } = useQuery({
    queryKey: ["core-screen-lists", wsId],
    enabled: !!wsId && linked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_lists")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: denials } = useQuery({
    queryKey: ["core-policy-denials", wsId, linked, denialAction],
    enabled: !!wsId && linked,
    queryFn: async () => {
      let q = supabase
        .from("core_policy_checks")
        .select("id, created_at, identifier, action, denied_by, reason")
        .eq("workspace_id", wsId!)
        .eq("decision", "deny");
      if (denialAction !== "all") q = q.eq("action", denialAction);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });
  // Last unattended mirror run, read straight from the workspace event feed.
  const { data: lastSync } = useQuery({
    queryKey: ["core-last-sync", wsId, linked],
    enabled: !!wsId && linked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, created_at, payload")
        .eq("workspace_id", wsId!)
        .eq("event_type", "job.completed")
        .in("payload->>kind", ["core.suppressions_synced", "core.suppression_sync_failed"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });



  const doScreen = useMutation({
    mutationFn: () => {
      if (!listId) throw new Error("Choose a list to screen first.");
      return screen({ data: { listId } });
    },
    onSuccess: (r) => {
      if (r.status === "unlinked") return toast.error("This workspace is not linked to Core.");
      if (r.status === "error") return toast.error(`Core could not screen this list (${r.reason}).`);
      toast.success(
        `${r.listName}: ${r.allowed} clear, ${r.denied} blocked${r.marked ? `, ${r.marked} marked opted out` : ""}.`,
      );
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doSync = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      if (r.status === "unlinked") return toast.error("This workspace is not linked to Core.");
      if (r.status === "error") return toast.error(`Suppression sync failed (${r.reason}).`);
      toast.success(
        `${r.mirrored} Core suppressions checked — ${r.added} added to Do Not Call, ${r.contactsSuppressed} contacts flagged` +
          (r.removed ? `, ${r.removed} lifted by Core` : "") +
          (r.contactsReleased ? `, ${r.contactsReleased} contacts released` : "") +
          (r.leadsFlagged ? `, ${r.leadsFlagged} leads opted out` : "") +
          (r.leadsReleased ? `, ${r.leadsReleased} leads released` : "") +
          (r.listContactsFlagged ? `, ${r.listContactsFlagged} list contacts opted out` : "") +
          (r.listContactsReleased ? `, ${r.listContactsReleased} list contacts released` : "") +
          ".",
      );

      // The mirror touches Do Not Call, contacts, leads, paused lines and the audit trail.
      for (const key of ["core-suppressions", "dnc_list", "blocked-phone-keys", "paused_lead_lines", "leads", "contacts", "activity", "events", "notifications"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
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

          <div className="rounded-md border p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <ListFilter className="h-4 w-4" /> Pre-Screen A List
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Checks every number on a list against Core in one pass and marks blocked numbers as
              opted out. Advisory only — each dial is still authorized at the moment of contact.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger className="w-[280px] bg-white">
                  <SelectValue placeholder={(lists ?? []).length ? "Choose a list" : "No lists yet"} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {(lists ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => doScreen.mutate()} disabled={!listId || doScreen.isPending}>
                <ListFilter className="mr-2 h-4 w-4" />
                {doScreen.isPending ? "Screening…" : "Screen Against Core"}
              </Button>
            </div>
            {doScreen.data?.status === "ok" && doScreen.data.denies.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {doScreen.data.denies.map((d) => (
                  <li key={d.identifier} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{formatPhone(d.identifier)}</span>{" "}
                    blocked{d.deniedBy ? ` by ${d.deniedBy}` : ""}
                    {d.reason ? ` — ${d.reason}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldOff className="h-4 w-4" /> Core Suppressions
              </h4>
              <Button variant="outline" size="sm" onClick={() => doSync.mutate()} disabled={doSync.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {doSync.isPending ? "Syncing…" : "Mirror Into Do Not Call"}
              </Button>
            </div>
            {lastSync ? (
              (() => {
                const p = (lastSync.payload ?? {}) as Record<string, unknown>;
                const failed = p.kind === "core.suppression_sync_failed";
                const ts = new Date(lastSync.created_at);
                // The sweep runs hourly; anything older than three hours is stale.
                const stale = Date.now() - ts.getTime() > 3 * 60 * 60 * 1000;
                return (
                  <p className={"mt-2 text-sm " + (failed || stale ? "text-[#CC0000]" : "text-muted-foreground")}>
                    Last automatic mirror {ts.toLocaleString()} —{" "}
                    {failed
                      ? `failed (${String(p.reason ?? "unknown reason")})`
                      : `${Number(p.mirrored ?? 0)} checked, ${Number(p.added ?? 0)} added to Do Not Call, ${Number(p.contacts_suppressed ?? 0)} contacts flagged${Number(p.removed ?? 0) ? `, ${Number(p.removed)} lifted by Core` : ""}${Number(p.contacts_released ?? 0) ? `, ${Number(p.contacts_released)} contacts released` : ""}${Number(p.leads_flagged ?? 0) ? `, ${Number(p.leads_flagged)} leads opted out` : ""}${Number(p.leads_released ?? 0) ? `, ${Number(p.leads_released)} leads released` : ""}${Number(p.list_contacts_flagged ?? 0) ? `, ${Number(p.list_contacts_flagged)} list contacts opted out` : ""}${Number(p.list_contacts_released ?? 0) ? `, ${Number(p.list_contacts_released)} list contacts released` : ""}`}
                    .{stale ? " The hourly sweep looks stalled — mirror manually to catch up." : ""}
                  </p>
                );
              })()
            ) : (
              <p className="mt-2 text-sm text-[#CC0000]">
                No automatic mirror has run for this workspace yet — mirror manually to bring Do Not
                Call in line with Core.
              </p>
            )}
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

          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> Recent Blocked Attempts
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Every Core decision is recorded. These are the attempts Core refused, newest first.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { k: "all", label: "All Decisions" },
                { k: "call", label: "Dial Blocks" },
                { k: "record", label: "Recording Blocks" },
              ] as const).map((o) => (
                <Button
                  key={o.k}
                  size="sm"
                  variant={denialAction === o.k ? "default" : "outline"}
                  onClick={() => setDenialAction(o.k)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {(denials ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {denialAction === "record"
                  ? "Core has not blocked any recording yet."
                  : denialAction === "call"
                    ? "Core has not blocked any dial yet."
                    : "Core has not blocked anything yet."}
              </p>

            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">When</th>
                      <th className="py-2">Number</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Blocked By</th>
                      <th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(denials ?? []).map((d) => (
                      <tr key={d.id} className="border-t">
                        <td className="py-2 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                        <td className="py-2">{d.identifier ? formatPhone(d.identifier) : "—"}</td>
                        <td className="py-2 capitalize">{d.action}</td>
                        <td className="py-2">{d.denied_by ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{d.reason ?? "—"}</td>
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
