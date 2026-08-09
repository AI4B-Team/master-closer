import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { HubPanel } from "@/components/back-office/HubPanel";
import { Webhook, Trash2, Plus, Eye, EyeOff, Copy, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Master Closer" },
      { name: "description", content: "Manage your profile, workspace and outbound webhooks for Master Closer." },
      { property: "og:title", content: "Settings — Master Closer" },
      { property: "og:description", content: "Profile, workspace and webhook configuration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("full_name, org_id, active_workspace_id").maybeSingle();
      setFullName(prof?.full_name ?? "");
      setOrgId(prof?.org_id ?? null);
      if (prof?.org_id) {
        const { data: org } = await supabase.from("organizations").select("name").eq("id", prof.org_id).maybeSingle();
        setOrgName(org?.name ?? "");
      }
    })();
  }, []);

  const save = async () => {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user!.id);
    if (orgId) await supabase.from("organizations").update({ name: orgName }).eq("id", orgId);
    toast.success("Saved.");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Your account and workspace." />
      <AccountShell current="settings">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-3xl">
          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
            <h3 className="font-semibold mb-4">Profile</h3>
            <div className="space-y-3">
              <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
            <h3 className="font-semibold mb-4">Workspace</h3>
            <div className="space-y-3">
              <div><Label>Organization Name</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
            </div>
          </Card>
        </div>
        <div className="mt-4">
          <Button onClick={save} className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">Save Changes</Button>
        </div>

        <WebhooksCard orgId={orgId} />
        <HubPanel />
      </AccountShell>
    </div>
  );
}

function WebhooksCard({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [reveal, setReveal] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const emit = useServerFn(emitOrgEvent);


  const { data: hooks } = useQuery({
    queryKey: ["org-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_webhooks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .order("delivered_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const add = async () => {
    if (!orgId) return;
    const clean = url.trim();
    if (!/^https:\/\//i.test(clean)) {
      toast.error("Webhook URL must start with https://");
      return;
    }
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await supabase.from("org_webhooks").insert({ org_id: orgId, url: clean, secret, enabled: true });
    if (error) { toast.error(error.message); return; }
    setUrl("");
    toast.success("Webhook added. Copy the signing secret now.");
    qc.invalidateQueries({ queryKey: ["org-webhooks"] });
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("org_webhooks").update({ enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["org-webhooks"] });
  };

  const remove = async (id: string) => {
    await supabase.from("org_webhooks").delete().eq("id", id);
    toast.success("Webhook removed.");
    qc.invalidateQueries({ queryKey: ["org-webhooks"] });
  };

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
    toast.success("Signing Secret Copied.");
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await emit({ data: { event_type: "job.completed", payload: { test: true, source: "settings" } } });
      toast.success("Test Event Sent.");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["webhook-deliveries"] }), 1200);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send test event.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mt-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Webhook className="h-4 w-4 text-[#CC0000]" />
        <h3 className="font-semibold">Webhooks</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={sendTest}
          disabled={testing || (hooks ?? []).length === 0}
          className="ml-auto rounded-xl"
        >
          <Send className="h-3.5 w-3.5 mr-1" /> {testing ? "Sending…" : "Send Test Event"}
        </Button>
      </div>

      <p className="text-sm text-[#6B6B76] mb-4">
        We POST every event (call.completed, lead.flagged_dnc, deal.updated) with an
        <code className="mx-1 text-xs">X-Signature</code> HMAC-SHA256 header of the raw body.
      </p>

      <div className="flex gap-2 mb-4">
        <Input placeholder="https://your-app.com/hooks/master-closer" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button onClick={add} disabled={!orgId} className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {(hooks ?? []).length === 0 ? (
          <p className="text-sm text-[#6B6B76]">No webhooks configured.</p>
        ) : (
          (hooks ?? []).map((h: any) => (
            <div key={h.id} className="border border-[#E7E7EC] rounded-xl px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{h.url}</div>
                  <div className="text-xs text-[#6B6B76] font-mono mt-0.5 flex items-center gap-2">
                    {reveal === h.id ? h.secret : "whsec_••••••••••••••••"}
                    <button
                      type="button"
                      onClick={() => setReveal(reveal === h.id ? null : h.id)}
                      className="text-[#6B6B76] hover:text-[#111]"
                      aria-label="Toggle Secret Visibility"
                    >
                      {reveal === h.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copySecret(h.secret)}
                      className="text-[#6B6B76] hover:text-[#111]"
                      aria-label="Copy Signing Secret"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                  </div>
                </div>
                <Switch checked={h.enabled} onCheckedChange={(v) => toggle(h.id, v)} />
                <Button variant="ghost" size="icon" onClick={() => remove(h.id)} aria-label="Delete Webhook">
                  <Trash2 className="h-4 w-4 text-[#6B6B76]" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {(deliveries ?? []).length > 0 ? (
        <div className="mt-6">
          <h4 className="font-semibold text-sm mb-2">Recent Deliveries</h4>
          <div className="space-y-1">
            {(deliveries ?? []).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-xs border-b border-[#E7E7EC] last:border-0 py-1.5">
                <span className="font-mono text-[#6B6B76]">{new Date(d.delivered_at).toLocaleString()}</span>
                <span className="truncate max-w-[45%] text-[#6B6B76]">{d.error ?? "OK"}</span>
                <Badge variant={d.status_code && d.status_code < 300 ? "default" : "destructive"}>
                  {d.status_code ?? "ERR"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
