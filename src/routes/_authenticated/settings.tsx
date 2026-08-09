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
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { HubPanel } from "@/components/back-office/HubPanel";
import { Webhook, Trash2, Plus, Eye, EyeOff, Copy, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";
import { deleteWorkspace, leaveWorkspace } from "@/lib/workspaces.functions";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, LogOut } from "lucide-react";


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
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  const [wsName, setWsName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [state, setState] = useState("");
  const [callerId, setCallerId] = useState("");
  const [timezone, setTimezone] = useState("");
  const [brandColor, setBrandColor] = useState("#CC0000");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("full_name, org_id, active_workspace_id").maybeSingle();
      if (cancelled) return;
      setFullName(prof?.full_name ?? "");
      setOrgId(prof?.org_id ?? null);
      if (prof?.org_id) {
        const { data: org } = await supabase.from("organizations").select("name").eq("id", prof.org_id).maybeSingle();
        if (cancelled) return;
        setOrgName(org?.name ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ws) return;
    setWsName(ws.name ?? "");
    setLegalName(ws.legal_business_name ?? "");
    setState(ws.business_state ?? "");
    setCallerId(ws.default_caller_id ?? "");
    setTimezone(ws.timezone ?? "America/New_York");
    setBrandColor(ws.brand_color ?? "#CC0000");
  }, [ws]);

  const save = async () => {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user!.id);
    if (orgId) await supabase.from("organizations").update({ name: orgName }).eq("id", orgId);
    if (ws?.id) {
      const { error } = await supabase
        .from("workspaces")
        .update({
          name: wsName.trim() || ws.name,
          legal_business_name: legalName.trim() || null,
          business_state: state.trim() || null,
          default_caller_id: callerId.trim() || null,
          timezone: timezone.trim() || "America/New_York",
          brand_color: brandColor,
        })
        .eq("id", ws.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["active-workspace"] });
      await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    }
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
              <div><Label>Organization Name</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
            </div>
          </Card>
          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
            <h3 className="font-semibold mb-4">Workspace</h3>
            <div className="space-y-3">
              <div><Label>Workspace Name</Label><Input value={wsName} onChange={(e) => setWsName(e.target.value)} /></div>
              <div><Label>Legal Business Name</Label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Used in disclosures and agreements" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Business State</Label><Input value={state} onChange={(e) => setState(e.target.value)} placeholder="FL" /></div>
                <div><Label>Time Zone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" /></div>
              </div>
              <div><Label>Default Caller ID</Label><Input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="+1 305 555 0134" /></div>
              <div>
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-9 w-12 rounded-lg border border-[#E7E7EC] bg-transparent"
                    aria-label="Brand Color"
                  />
                  <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-32" />
                </div>
              </div>
            </div>
          </Card>
        </div>
        <div className="mt-4">
          <Button onClick={save} className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">Save Changes</Button>
        </div>

        <WorkspaceDangerZone />
        <WebhooksCard orgId={orgId} />
        <HubPanel />
      </AccountShell>
    </div>
  );
}


/** Leave (members/admins) or permanently delete (owner) the active workspace. */
function WorkspaceDangerZone() {
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const [confirmName, setConfirmName] = useState("");
  const leave = useServerFn(leaveWorkspace);
  const destroy = useServerFn(deleteWorkspace);

  const { data: myRole } = useQuery({
    queryKey: ["my-workspace-role", ws?.id],
    enabled: !!ws?.id,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", ws!.id)
        .eq("user_id", uid)
        .maybeSingle();
      return data?.role ?? null;
    },
  });

  const done = async (msg: string) => {
    toast.success(msg);
    setConfirmName("");
    await qc.invalidateQueries({ queryKey: ["active-workspace"] });
    await qc.invalidateQueries({ queryKey: ["my-workspaces"] });
    await qc.invalidateQueries();
  };

  const leaveMut = useMutation({
    mutationFn: () => leave({}),
    onSuccess: () => done("You Left The Workspace"),
    onError: (e: any) => toast.error(e?.message ?? "Could not leave this workspace."),
  });

  const deleteMut = useMutation({
    mutationFn: () => destroy({ data: { confirmName } }),
    onSuccess: () => done("Workspace Deleted"),
    onError: (e: any) => toast.error(e?.message ?? "Could not delete this workspace."),
  });

  if (!ws) return null;
  const isOwner = myRole === "owner";

  return (
    <Card className="mt-4 p-6 rounded-2xl border-[#F3C2C2] shadow-none max-w-3xl">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[#CC0000]" />
        Danger Zone
      </h3>
      <p className="text-sm text-[#6B6B76] mb-4">
        These actions affect the <strong>{ws.name}</strong> workspace only.
      </p>

      {isOwner ? (
        <div className="space-y-3">
          <p className="text-sm text-[#6B6B76]">
            Deleting removes every lead, call, campaign and agreement in this workspace. Type the
            workspace name to confirm.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={ws.name}
              className="w-64"
              aria-label="Confirm Workspace Name"
            />
            <Button
              variant="outline"
              className="rounded-xl border-[#CC0000] text-[#CC0000] hover:bg-[#CC0000]/5"
              disabled={confirmName.trim() !== ws.name || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Workspace
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="rounded-xl border-[#CC0000] text-[#CC0000] hover:bg-[#CC0000]/5"
          disabled={leaveMut.isPending}
          onClick={() => leaveMut.mutate()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave Workspace
        </Button>
      )}
    </Card>
  );
}

function WebhooksCard({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [reveal, setReveal] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const emit = useServerFn(emitOrgEvent);


  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: hooks } = useQuery({
    queryKey: ["org-webhooks", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_webhooks")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("delivered_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const add = async () => {
    if (!orgId) return;
    const { data: prof } = await supabase.from("profiles").select("active_workspace_id").maybeSingle();
    const workspaceId = prof?.active_workspace_id;
    if (!workspaceId) { toast.error("No active workspace"); return; }
    const clean = url.trim();
    if (!/^https:\/\//i.test(clean)) {
      toast.error("Webhook URL must start with https://");
      return;
    }
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await supabase.from("org_webhooks").insert({ org_id: orgId, workspace_id: workspaceId, url: clean, secret, enabled: true });
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
