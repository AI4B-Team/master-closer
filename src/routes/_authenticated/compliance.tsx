import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { Megaphone, Search, RotateCcw, ShieldCheck, ScrollText, Ban, Trash2, PauseCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { CallingWindowPanel } from "@/components/back-office/CallingWindowPanel";
import { CoreGovernancePanel } from "@/components/back-office/CoreGovernancePanel";
import { useServerFn } from "@tanstack/react-start";
import { createCoreSuppression, listCoreSuppressions, releaseCoreSuppression } from "@/lib/core/policy.functions";

import { formatPhone, phoneKey } from "@/lib/phone";
import { suppressContactsForPhones, releasePhoneLocally, fetchBlockedPhoneKeys } from "@/lib/dnc";
import {
  DEFAULT_DISCLOSURE, DELIVERY_METHODS, STATE_RULES, disclosureStatus,
} from "@/lib/compliance";

/** Splits a consent note into the spoken line and the Core basis appended to it. */
function splitConsentNote(notes: string | null | undefined): { line: string; basis: string | null } {
  if (!notes) return { line: "", basis: null };
  const m = notes.match(/^([\s\S]*?)\s*\[Core:\s*([^\]]+)\]\s*$/);
  if (!m) return { line: notes.trim(), basis: null };
  return { line: (m[1] ?? "").trim(), basis: (m[2] ?? "").trim() };
}

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [
      { title: "Consent & Compliance — Master Closer" },
      { name: "description", content: "Disclosure script, delivery methods, and per-state consent rules for every recorded call." },
      { property: "og:title", content: "Consent & Compliance — Master Closer" },
      { property: "og:description", content: "Disclosure script, delivery methods, and per-state consent rules for every recorded call." },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [script, setScript] = useState(DEFAULT_DISCLOSURE);
  const [methods, setMethods] = useState({
    spoken_at_call_open: true,
    booking_confirmation: true,
    outbound_pre_connect_audio: true,
  });
  const [jurisdiction, setJurisdiction] = useState("FL");

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: settings } = useQuery({
    queryKey: ["disclosure_settings", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("disclosure_settings").select("*").eq("workspace_id", wsId!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings === undefined) return; // still loading — keep the form as-is
    if (settings === null) {
      // This workspace has no disclosure row yet: never carry another
      // workspace's script into it, or a save would copy it across tenants.
      setScript(DEFAULT_DISCLOSURE);
      setMethods({
        spoken_at_call_open: true,
        booking_confirmation: true,
        outbound_pre_connect_audio: true,
      });
      setJurisdiction("FL");
      return;
    }
    setScript(settings.script);
    setMethods({
      spoken_at_call_open: settings.spoken_at_call_open,
      booking_confirmation: settings.booking_confirmation,
      outbound_pre_connect_audio: settings.outbound_pre_connect_audio,
    });
    setJurisdiction(settings.default_jurisdiction);
  }, [settings, wsId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No active workspace");
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const payload = {
        org_id: prof.org_id, workspace_id: wsId,
        script,
        default_jurisdiction: jurisdiction.toUpperCase(),
        ...methods,
      };
      const { error } = await supabase
        .from("disclosure_settings")
        .upsert(payload, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disclosure Saved.");
      void logActivity("disclosure.updated", { jurisdiction: jurisdiction.toUpperCase() });
      qc.invalidateQueries({ queryKey: ["disclosure_settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATE_RULES;
    return STATE_RULES.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [query]);

  const requiredCount = STATE_RULES.filter((r) => r.consent === "all_party").length;

  return (
    <div>
      <PageHeader
        title="Consent & Compliance"
        description="Per-state consent rules, disclosure delivery, and a defensible log of every line spoken."
      />

      <AccountShell current="compliance">
      {/* Disclosure Panel */}
      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Disclosure</h3>
            <p className="text-sm text-[#6B6B76]">
              The exact line delivered before any recorded conversation begins.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label>Disclosure Script</Label>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={4}
              className="mt-1.5 rounded-xl"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[#6B6B76]">{script.length} characters</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setScript(DEFAULT_DISCLOSURE)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset To Default
              </Button>
            </div>

            <div className="mt-4">
              <Label>Default Jurisdiction</Label>
              <Input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                className="mt-1.5 rounded-xl w-28 font-mono uppercase"
                placeholder="FL"
              />
              <p className="text-xs text-[#6B6B76] mt-1.5">
                Currently{" "}
                <span
                  className={
                    disclosureStatus(jurisdiction) === "Required"
                      ? "text-[#CC0000] font-medium"
                      : "font-medium"
                  }
                >
                  {disclosureStatus(jurisdiction)}
                </span>{" "}
                in {jurisdiction || "—"}.
              </p>
            </div>
          </div>

          <div>
            <Label>Delivery Method</Label>
            <div className="mt-1.5 space-y-2">
              {DELIVERY_METHODS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-start justify-between gap-4 border border-[#E7E7EC] rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-[#6B6B76] mt-0.5">{m.hint}</p>
                  </div>
                  <Switch
                    checked={methods[m.key]}
                    onCheckedChange={(v) => setMethods({ ...methods, [m.key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !script.trim()}
            className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
          >
            Save Disclosure
          </Button>
          <p className="text-xs text-[#6B6B76]">
            Required states block the live call surface until the line is delivered. Optional states never block.
          </p>
        </div>
      </Card>

      {/* State Rules */}
      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-[#CC0000]" />
            </div>
            <div>
              <h3 className="font-semibold">State Rules</h3>
              <p className="text-sm text-[#6B6B76]">
                {requiredCount} all-party consent states require disclosure. The rest are optional.
              </p>
            </div>
          </div>
          <div className="relative w-56">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B76]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search States"
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                <th className="py-2">State</th>
                <th className="py-2">Consent Rule</th>
                <th className="py-2 text-right">Disclosure</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const required = r.consent === "all_party";
                return (
                  <tr key={r.code} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-2.5 font-medium">
                      <span className="font-mono text-xs text-[#6B6B76] mr-2">{r.code}</span>
                      {r.name}
                    </td>
                    <td className="py-2.5 text-[#6B6B76]">
                      {required ? "All-Party Consent" : "One-Party Consent"}
                    </td>
                    <td className="py-2.5 text-right">
                      {required ? (
                        <Badge className="bg-[#CC0000] hover:bg-[#CC0000] text-white">Required</Badge>
                      ) : (
                        <Badge variant="secondary">Optional</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <CallingWindowPanel />

      <CoreGovernancePanel />

      <DncRegistry />

      <EmailOptOuts />

      <PausedLinesPanel />

      <DisclosureLog />
      </AccountShell>
    </div>
  );
}

/**
 * Suppression pauses live follow-up lines through a database trigger, and
 * releasing a number deliberately does not restart outreach. Without a surface
 * to see and resume them, those lines are stranded — this is that surface.
 */
function PausedLinesPanel() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: lines } = useQuery({
    queryKey: ["paused_lead_lines", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_lines")
        .select("id, product_line, stage, disposition, updated_at, contacts(id, name, phone, suppressed)")
        .eq("workspace_id", wsId!)
        .eq("status", "paused")
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: blockedKeys } = useQuery({
    queryKey: ["blocked-phone-keys", wsId],
    enabled: !!wsId,
    queryFn: () => fetchBlockedPhoneKeys(wsId!),
  });

  const resume = useMutation({
    mutationFn: async (line: any) => {
      const contact = line.contacts;
      const key = phoneKey(contact?.phone);
      if (contact?.suppressed) throw new Error("This contact is still suppressed.");
      if (key && blockedKeys?.has(key)) {
        throw new Error("This number is still on Do Not Call or suppressed family-wide.");
      }
      const { error } = await supabase
        .from("lead_lines")
        .update({ status: "live" })
        .eq("id", line.id);
      if (error) throw error;
      return line;
    },
    onSuccess: (line) => {
      toast.success("Follow-up line resumed.");
      void logActivity("lead_line.resumed", { line_id: line.id, product_line: line.product_line });
      qc.invalidateQueries({ queryKey: ["paused_lead_lines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
          <PauseCircle className="h-5 w-5 text-[#CC0000]" />
        </div>
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">Paused Follow-Up Lines</h3>
          <p className="text-[13px] text-[#6B6B76] mt-0.5">
            Lines paused by an opt-out stay paused after a release. Resume them deliberately.
          </p>
        </div>
      </div>

      {!lines?.length ? (
        <p className="text-[13px] text-[#6B6B76]">No paused follow-up lines.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[#6B6B76] border-b border-[#E7E7EC]">
                <th className="py-2 font-medium">Contact</th>
                <th className="py-2 font-medium">Product Line</th>
                <th className="py-2 font-medium">Stage</th>
                <th className="py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => {
                const contact = line.contacts;
                const key = phoneKey(contact?.phone);
                const blocked = !!contact?.suppressed || (!!key && !!blockedKeys?.has(key));
                return (
                  <tr key={line.id} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium">{contact?.name ?? "Unknown Contact"}</div>
                      <div className="text-xs text-[#6B6B76] font-mono">{formatPhone(contact?.phone ?? "")}</div>
                    </td>
                    <td className="py-2.5 text-[#6B6B76]">{line.product_line}</td>
                    <td className="py-2.5 text-[#6B6B76]">{line.stage ?? line.disposition ?? "—"}</td>
                    <td className="py-2.5 text-right">
                      {blocked ? (
                        <Badge variant="secondary">Still Suppressed</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resume.mutate(line)}
                          disabled={resume.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          Resume
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DisclosureLog() {
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const { data: logs } = useQuery({
    queryKey: ["consent_logs", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("consent_logs")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("disclosed_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
          <ScrollText className="h-5 w-5 text-[#CC0000]" />
        </div>
        <div>
          <h3 className="font-semibold">Disclosure Log</h3>
          <p className="text-sm text-[#6B6B76]">Every line delivered, timestamped and attributable.</p>
        </div>
      </div>

      {!logs || logs.length === 0 ? (
        <p className="text-sm text-[#6B6B76] py-8 text-center">
          No disclosures logged yet. They appear here as calls run.
        </p>
      ) : (
        <table className="w-full text-sm table-fixed">

          <thead>
            <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
              <th className="py-2">Delivered</th>
              <th className="py-2">Method</th>
              <th className="py-2">Jurisdiction</th>
              <th className="py-2">Line</th>
              <th className="py-2">Consent Basis</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l: any) => (
              <tr key={l.id} className="border-b border-[#E7E7EC] last:border-0">
                <td className="py-2.5 font-mono text-xs text-[#6B6B76]">
                  {new Date(l.disclosed_at).toLocaleString()}
                </td>
                <td className="py-2.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">{l.method}</Badge>
                </td>
                <td className="py-2.5 font-mono text-xs">{l.jurisdiction ?? "—"}</td>
                <td className="py-2.5 text-[#6B6B76] max-w-[360px] truncate">
                  {splitConsentNote(l.notes).line || "—"}
                </td>
                <td className="py-2.5 text-xs text-[#6B6B76] whitespace-nowrap">
                  {splitConsentNote(l.notes).basis ?? "Local Rules"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DncRegistry() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const coreSuppress = useServerFn(createCoreSuppression);
  const coreList = useServerFn(listCoreSuppressions);
  const coreRelease = useServerFn(releaseCoreSuppression);

  const { data: entries } = useQuery({
    queryKey: ["dnc_list", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("dnc_list")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("added_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      const workspaceId = prof?.active_workspace_id;
      if (!workspaceId) throw new Error("No active workspace");
      const numbers = phone
        .split(/[\n,;]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (!numbers.length) throw new Error("Enter at least one number.");
      const { error } = await supabase.from("dnc_list").insert(
        numbers.map((p) => ({
          org_id: prof!.org_id, workspace_id: workspaceId,
          phone: p,
          reason: reason.trim() || "Added manually",
        })),
      );
      if (error) throw error;
      // Keep contact records in step so nominations never resurface these numbers.
      if (workspaceId) await suppressContactsForPhones(workspaceId, numbers);
      // Surface suppression additions in the Activity Log / webhook fan-out.
      for (const p of numbers) void logActivity("lead.flagged_dnc", {
          phone: p,
          channel: "voice",
          reason: reason.trim() || "Added manually",
        });
      // Push each opt-out to Core so every app in the family stops contacting them.
      let coreFailed = 0;
      for (const p of numbers) {
        try {
          const res = await coreSuppress({
            data: { phone: p, reason: "opt_out", notes: reason.trim() || "Added manually", channel: "voice" },
          });
          if (res.status === "error") coreFailed += 1;
        } catch {
          coreFailed += 1;
        }
      }
      return { count: numbers.length, coreFailed };

    },
    onSuccess: ({ count, coreFailed }) => {
      toast.success(`${count} number${count === 1 ? "" : "s"} added to Do Not Call.`);
      if (coreFailed) {
        toast.warning(
          `${coreFailed} could not be sent to Core — other apps in the family may still contact them.`,
        );
      }
      setPhone("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["dnc_list"] });
      qc.invalidateQueries({ queryKey: ["core-suppressions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Core holds the family-wide opt-out list, so a local delete alone cannot make
  // a number dialable again. Rows Core also holds get an explicit family-wide
  // release action rather than a silent local-only delete.
  const { data: coreSupp } = useQuery({
    queryKey: ["core-suppressions", wsId],
    enabled: !!wsId,
    queryFn: () => coreList(),
  });

  // phoneKey -> Core suppression id, so a row can be released family-wide.
  const coreById = useMemo(() => {
    const map = new Map<string, string>();
    if (coreSupp?.status === "ok") {
      for (const s of coreSupp.suppressions) {
        if (s.channel === "email" || s.identifier?.includes("@")) continue;
        const k = phoneKey(s.identifier);
        if (k && s.id) map.set(k, s.id);
      }
    }
    return map;
  }, [coreSupp]);

  const coreKeys = useMemo(() => new Set(coreById.keys()), [coreById]);

  const releaseFamilyWide = useMutation({
    mutationFn: async (entry: { id: string; phone: string }) => {
      const coreId = coreById.get(phoneKey(entry.phone) ?? "");
      if (!coreId) throw new Error("No family-wide opt-out found for this number.");
      const res = await coreRelease({ data: { id: coreId, notes: "Released from Do Not Call registry" } });
      if (res.status !== "ok") {
        throw new Error(
          res.status === "unlinked"
            ? "This workspace is not linked to Core."
            : "Core could not release that number. Try again shortly.",
        );
      }
      // Remove the local row too, then lift the local opt-out side-effects.
      await supabase.from("dnc_list").delete().eq("id", entry.id);
      const released = wsId ? await releasePhoneLocally(wsId, entry.phone) : null;
      return { ...entry, released };
    },
    onSuccess: (entry) => {
      toast.success("Number released family-wide.");
      if (entry.released && (entry.released.leads || entry.released.contacts)) {
        toast.info(
          `Cleared the opt-out on ${entry.released.leads} lead(s) and ${entry.released.contacts} contact(s).`,
        );
      }
      if (entry.released?.linesPaused) {
        toast.warning(
          `${entry.released.linesPaused} follow-up line(s) stay paused — reactivate them manually.`,
        );
      }
      void logActivity("lead.released_dnc", {
        entry_id: entry.id,
        phone: entry.phone,
        channel: "voice",
        scope: "family_wide",
      });
      qc.invalidateQueries({ queryKey: ["dnc_list"] });
      qc.invalidateQueries({ queryKey: ["core-suppressions"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["blocked-phone-keys"] });
      qc.invalidateQueries({ queryKey: ["paused_lead_lines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (entry: { id: string; phone: string }) => {
      const { error } = await supabase.from("dnc_list").delete().eq("id", entry.id);
      if (error) throw error;
      const coreBlocked = coreKeys.has(phoneKey(entry.phone) ?? "");
      // Only lift the local opt-out side-effects when Core no longer suppresses
      // the number; Core owns the family-wide list.
      const released = !coreBlocked && wsId ? await releasePhoneLocally(wsId, entry.phone) : null;
      return { ...entry, coreBlocked, released };
    },
    onSuccess: (entry) => {
      toast.success("Number released from Do Not Call.");
      if (entry.coreBlocked) {
        toast.warning("Core still holds a family-wide opt-out for this number — dials stay blocked.");
      } else if (entry.released && (entry.released.leads || entry.released.contacts)) {
        toast.info(
          `Cleared the opt-out on ${entry.released.leads} lead(s) and ${entry.released.contacts} contact(s).`,
        );
        if (entry.released.linesPaused) {
          toast.warning(
            `${entry.released.linesPaused} follow-up line(s) stay paused — reactivate them manually.`,
          );
        }
      }
      void logActivity("lead.released_dnc", { entry_id: entry.id, phone: entry.phone, channel: "voice" });
      qc.invalidateQueries({ queryKey: ["dnc_list"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["blocked-phone-keys"] });
      qc.invalidateQueries({ queryKey: ["paused_lead_lines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries ?? [];
    return (entries ?? []).filter(
      (e: any) =>
        e.phone.toLowerCase().includes(q) || (e.reason ?? "").toLowerCase().includes(q),
    );
  }, [entries, search]);

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <Ban className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Do Not Call Registry</h3>
            <p className="text-sm text-[#6B6B76]">
              {entries?.length ?? 0} suppressed number{(entries?.length ?? 0) === 1 ? "" : "s"}. The
              dialer skips every one of them automatically.
            </p>
          </div>
        </div>
        <div className="relative w-56">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B76]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Numbers"
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Label>Add Numbers</Label>
          <Textarea
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            rows={4}
            placeholder={"+15551234567\n+15559876543"}
            className="mt-1.5 rounded-xl font-mono text-sm"
          />
          <p className="text-xs text-[#6B6B76] mt-1.5">One per line, or comma separated.</p>

          <div className="mt-4">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Requested on call"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || !phone.trim()}
            className="mt-4 bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
          >
            Suppress Numbers
          </Button>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-[#6B6B76] py-8 text-center">
              {entries?.length ? "No matches." : "No suppressed numbers yet."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                  <th className="py-2">Number</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2 text-right">Added</th>
                  <th className="py-2 text-right">Action</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-2.5 font-mono text-xs">
                      {formatPhone(e.phone)}
                      {coreKeys.has(phoneKey(e.phone) ?? "") && (
                        <Badge variant="secondary" className="ml-2 font-sans text-[10px]">Core</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-[#6B6B76]">{e.reason ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#6B6B76]">
                      {new Date(e.added_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {coreKeys.has(phoneKey(e.phone) ?? "") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-lg text-xs mr-1"
                          disabled={releaseFamilyWide.isPending}
                          onClick={() => releaseFamilyWide.mutate({ id: e.id, phone: e.phone })}
                        >
                          Release Family-Wide
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => remove.mutate({ id: e.id, phone: e.phone })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[#6B6B76]" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Email-channel opt-outs live in Core (the family-wide list) — there is no
 * local email suppression table. Agreement sends check this list before a
 * signing link goes out.
 */
function EmailOptOuts() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const coreSuppress = useServerFn(createCoreSuppression);
  const coreList = useServerFn(listCoreSuppressions);
  const coreRelease = useServerFn(releaseCoreSuppression);

  const { data: coreSupp } = useQuery({
    queryKey: ["core-suppressions", wsId],
    enabled: !!wsId,
    queryFn: () => coreList(),
  });

  // Opting out is one-way without a release path: a re-consenting address would
  // stay blocked family-wide with no way back.
  const release = useMutation({
    mutationFn: async (row: any) => {
      const res = await coreRelease({ data: { id: row.id, notes: "Released from Compliance Center" } });
      if (res.status !== "ok") {
        throw new Error(
          res.status === "unlinked"
            ? "This workspace is not linked to Core."
            : "Core could not release that address. Try again shortly.",
        );
      }
      return res;
    },
    onSuccess: (res: any) => {
      toast.success(`${res.identifier} can be emailed again.`);
      void logActivity("lead.released_dnc", { channel: "email", identifier: res.identifier });
      qc.invalidateQueries({ queryKey: ["core-suppressions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const emails =
    coreSupp?.status === "ok"
      ? coreSupp.suppressions.filter((s: any) => s.channel === "email" || s.identifier?.includes("@"))
      : [];

  const add = useMutation({
    mutationFn: async () => {
      const list = email
        .split(/[\n,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      if (!list.length) throw new Error("Enter at least one email address.");
      let failed = 0;
      for (const address of list) {
        try {
          const res = await coreSuppress({
            data: { email: address, reason: "opt_out", notes: note.trim() || "Added manually", channel: "email" },
          });
          if (res.status !== "ok") failed += 1;
        } catch {
          failed += 1;
        }
      }
      return { count: list.length, failed };
    },
    onSuccess: ({ count, failed }) => {
      if (failed) toast.warning(`${failed} of ${count} could not be recorded in Core.`);
      else toast.success(`${count} email address${count === 1 ? "" : "es"} opted out family-wide.`);
      setEmail("");
      setNote("");
      void logActivity("lead.flagged_dnc", { channel: "email", count });
      qc.invalidateQueries({ queryKey: ["core-suppressions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
          <Ban className="h-5 w-5 text-[#CC0000]" />
        </div>
        <div>
          <h3 className="font-semibold">Email Opt-Outs</h3>
          <p className="text-sm text-[#6B6B76]">
            {emails.length} suppressed address{emails.length === 1 ? "" : "es"}. Agreements and signing
            links are blocked for every one of them across the family.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Label>Add Addresses</Label>
          <Textarea
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            rows={4}
            placeholder={"person@example.com\nother@example.com"}
            className="mt-1.5 rounded-xl font-mono text-sm"
          />
          <p className="text-xs text-[#6B6B76] mt-1.5">One per line, or comma separated.</p>

          <div className="mt-4">
            <Label>Reason</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Requested by email"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || !email.trim()}
            className="mt-4 bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
          >
            Suppress Addresses
          </Button>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {emails.length === 0 ? (
            <p className="text-sm text-[#6B6B76] py-8 text-center">No suppressed addresses yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
                  <th className="py-2">Address</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2 text-right">Added</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((s: any) => (
                  <tr key={s.id ?? s.identifier} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-2.5 font-mono text-xs">
                      {s.identifier}
                      <Badge variant="secondary" className="ml-2 font-sans text-[10px]">Core</Badge>
                    </td>
                    <td className="py-2.5 text-[#6B6B76]">{s.reason ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#6B6B76]">
                      {s.createdAt ?? s.created_at
                        ? new Date(s.createdAt ?? s.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg text-xs"
                        disabled={!s.id || release.isPending}
                        onClick={() => release.mutate(s)}
                      >
                        Release
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Card>
  );
}
