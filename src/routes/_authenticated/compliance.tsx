import { createFileRoute } from "@tanstack/react-router";
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
import { Megaphone, Search, RotateCcw, ShieldCheck, ScrollText, Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

import {
  DEFAULT_DISCLOSURE, DELIVERY_METHODS, STATE_RULES, disclosureStatus,
} from "@/lib/compliance";

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

  const { data: settings } = useQuery({
    queryKey: ["disclosure_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("disclosure_settings").select("*").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setScript(settings.script);
    setMethods({
      spoken_at_call_open: settings.spoken_at_call_open,
      booking_confirmation: settings.booking_confirmation,
      outbound_pre_connect_audio: settings.outbound_pre_connect_audio,
    });
    setJurisdiction(settings.default_jurisdiction);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const payload = {
        org_id: prof.org_id, workspace_id: prof.active_workspace_id,
        script,
        default_jurisdiction: jurisdiction.toUpperCase(),
        ...methods,
      };
      const { error } = await supabase
        .from("disclosure_settings")
        .upsert(payload, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Disclosure Saved.");
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

      <DncRegistry />

      <DisclosureLog />
      </AccountShell>
    </div>
  );
}

function DisclosureLog() {
  const { data: logs } = useQuery({
    queryKey: ["consent_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consent_logs")
        .select("*")
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#6B6B76] text-xs uppercase tracking-wider border-b border-[#E7E7EC]">
              <th className="py-2">Delivered</th>
              <th className="py-2">Method</th>
              <th className="py-2">Jurisdiction</th>
              <th className="py-2">Line</th>
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
                <td className="py-2.5 text-[#6B6B76] max-w-[420px] truncate">{l.notes ?? "—"}</td>
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

  const { data: entries } = useQuery({
    queryKey: ["dnc_list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dnc_list")
        .select("*")
        .order("added_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const numbers = phone
        .split(/[\n,;]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (!numbers.length) throw new Error("Enter at least one number.");
      const { error } = await supabase.from("dnc_list").insert(
        numbers.map((p) => ({
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
          phone: p,
          reason: reason.trim() || "Added manually",
        })),
      );
      if (error) throw error;
      // Surface suppression additions in the Activity Log / webhook fan-out.
      for (const p of numbers) void logActivity("lead.flagged_dnc", { phone: p, reason: reason.trim() || "Added manually" });
      return numbers.length;

    },
    onSuccess: (n) => {
      toast.success(`${n} number${n === 1 ? "" : "s"} added to Do Not Call.`);
      setPhone("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["dnc_list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dnc_list").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Number released from Do Not Call.");
      qc.invalidateQueries({ queryKey: ["dnc_list"] });
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
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e: any) => (
                  <tr key={e.id} className="border-b border-[#E7E7EC] last:border-0">
                    <td className="py-2.5 font-mono text-xs">{e.phone}</td>
                    <td className="py-2.5 text-[#6B6B76]">{e.reason ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-[#6B6B76]">
                      {new Date(e.added_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => remove.mutate(e.id)}
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
