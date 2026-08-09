import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { Video, Phone, Calendar, CreditCard, Zap, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — Master Closer" },
      { name: "description", content: "Connect Master Closer to your CRM, meeting platforms, carrier, and calendar." },
      { property: "og:title", content: "Integrations — Master Closer" },
      { property: "og:description", content: "Connect Master Closer to your CRM, meeting platforms, carrier, and calendar." },
    ],
  }),
  component: IntegrationsPage,
});

type Field = { key: string; label: string; placeholder?: string };

const CONNECTORS: {
  key: string; name: string; icon: any; desc: string; recommended?: boolean; fields: Field[];
}[] = [
  {
    key: "gohighlevel", name: "GoHighLevel", icon: Zap, desc: "Two-way sync with your CRM.", recommended: true,
    fields: [
      { key: "location_id", label: "Location ID", placeholder: "loc_..." },
      { key: "pipeline_name", label: "Pipeline Name", placeholder: "Sales Pipeline" },
    ],
  },
  { key: "zoom", name: "Zoom", icon: Video, desc: "Join and transcribe Zoom calls.", fields: [{ key: "account_email", label: "Account Email", placeholder: "ops@yourteam.com" }] },
  { key: "google_meet", name: "Google Meet", icon: Video, desc: "Join and transcribe Meet calls.", fields: [{ key: "workspace_domain", label: "Workspace Domain", placeholder: "yourteam.com" }] },
  { key: "teams", name: "Microsoft Teams", icon: Video, desc: "Join and transcribe Teams calls.", fields: [{ key: "tenant_id", label: "Tenant ID", placeholder: "00000000-0000-..." }] },
  { key: "stripe", name: "Stripe", icon: CreditCard, desc: "Charge cards on the call.", fields: [{ key: "account_id", label: "Account ID", placeholder: "acct_..." }] },
  {
    key: "telephony", name: "Telephony (Telnyx/Twilio)", icon: Phone, desc: "Dial through your carrier.",
    fields: [
      { key: "carrier", label: "Carrier", placeholder: "Telnyx or Twilio" },
      { key: "caller_id", label: "Outbound Caller ID", placeholder: "+1 555 0100" },
    ],
  },
  { key: "google_calendar", name: "Google Calendar", icon: Calendar, desc: "Book follow-ups instantly.", fields: [{ key: "calendar_id", label: "Calendar ID", placeholder: "primary" }] },
];

function IntegrationsPage() {
  const qc = useQueryClient();
  const [configKey, setConfigKey] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: connections } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data } = await supabase.from("integrations").select("*");
      return data ?? [];
    },
  });

  const rowFor = (key: string) => connections?.find((c) => c.provider === key);
  const statusFor = (key: string) => rowFor(key)?.status === "connected";
  const connector = CONNECTORS.find((c) => c.key === configKey);

  const toggle = useMutation({
    mutationFn: async ({ provider, connect }: { provider: string; connect: boolean }) => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      if (connect) {
        const { error } = await supabase.from("integrations").upsert(
          { org_id: prof.org_id, workspace_id: prof.active_workspace_id, provider, status: "connected", connected_at: new Date().toISOString() },
          { onConflict: "org_id,provider" }
        );
        if (error) throw error;
      } else {
        await supabase.from("integrations").update({ status: "not_connected" })
          .eq("org_id", prof.org_id).eq("provider", provider);
      }
    },
    onSuccess: (_, v) => {
      toast.success(v.connect ? "Connected." : "Disconnected.");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!connector) throw new Error("No integration selected.");
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      const existing = rowFor(connector.key);
      const { error } = await supabase.from("integrations").upsert(
        {
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
          provider: connector.key,
          status: existing?.status ?? "not_connected",
          connected_at: existing?.connected_at ?? null,
          config: form,
        },
        { onConflict: "org_id,provider" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings Saved.");
      setConfigKey(null);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openConfig(key: string) {
    const cfg = (rowFor(key)?.config ?? {}) as Record<string, string>;
    setForm({ ...cfg });
    setConfigKey(key);
  }

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Plug Master Closer into the tools your team already runs on."
      />
      <AccountShell current="integrations">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CONNECTORS.map((c) => {
          const connected = statusFor(c.key);
          const row = rowFor(c.key);
          const configured = Object.values((row?.config ?? {}) as Record<string, string>).some((v) => String(v ?? "").trim());
          const Icon = c.icon;
          return (
            <Card key={c.key} className="p-5 rounded-2xl border-[#E7E7EC] shadow-none">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-[#F4F4F6] flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                {c.recommended && (
                  <Badge className="bg-[#CC0000]/10 text-[#CC0000] border-0">Recommended</Badge>
                )}
              </div>
              <h3 className="font-semibold">{c.name}</h3>
              <p className="text-xs text-[#6B6B76] mt-1 mb-2 min-h-[32px]">{c.desc}</p>
              <p className="text-xs text-[#6B6B76] mb-4">
                {connected && row?.connected_at
                  ? `Connected ${new Date(row.connected_at).toLocaleDateString()}`
                  : configured
                    ? "Settings Saved — Not Connected"
                    : "No Settings Yet"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-[#0E9F6E]" : ""}>
                  {connected ? "Connected" : "Not Connected"}
                </Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openConfig(c.key)}>
                    <Settings2 className="h-4 w-4 mr-1" /> Configure
                  </Button>
                  <Button
                    size="sm"
                    variant={connected ? "outline" : "default"}
                    className={connected ? "rounded-xl" : "rounded-xl bg-[#CC0000] hover:bg-[#A30000]"}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ provider: c.key, connect: !connected })}
                  >
                    {connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      </AccountShell>

      <Dialog open={!!configKey} onOpenChange={(o) => !o && setConfigKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure {connector?.name ?? "Integration"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(connector?.fields ?? []).map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  value={form[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <p className="text-xs text-[#6B6B76]">
              Store account IDs and routing details here. Private API keys are held in your workspace secrets, never on this page.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000]"
              disabled={saveConfig.isPending}
              onClick={() => saveConfig.mutate()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
