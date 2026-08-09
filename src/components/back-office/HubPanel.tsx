import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { hubStatus } from "@/lib/hub.functions";
import { Link2, Webhook, Trash2, Radio } from "lucide-react";
import { toast } from "sonner";

const HUB_URL = "https://realelite.app/connect/master-closer";

export function HubPanel() {
  const qc = useQueryClient();
  const status = useServerFn(hubStatus);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");

  const { data: hub } = useQuery({ queryKey: ["hub-status"], queryFn: () => status({}) });

  const { data: hooks } = useQuery({
    queryKey: ["org-webhooks"],
    queryFn: async () => {
      const { data } = await supabase.from("org_webhooks").select("id, url, enabled, created_at");
      return data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["org-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, event_type, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const addHook = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace");
      const { error } = await supabase
        .from("org_webhooks")
        .insert({ org_id: prof.org_id, url, secret, enabled: true });
      if (error) throw error;
    },
    onSuccess: () => {
      setUrl("");
      setSecret("");
      toast.success("Webhook added.");
      qc.invalidateQueries({ queryKey: ["org-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHook = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("org_webhooks").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-webhooks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeHook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook removed.");
      qc.invalidateQueries({ queryKey: ["org-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mt-6">
      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            <h3 className="font-semibold">Real Elite</h3>
          </div>
          <Badge className={hub?.connected ? "bg-[#0E9F6E]" : "bg-[#F4F4F6] text-[#6B6B76]"}>
            {hub?.connected ? "Connected" : "Standalone"}
          </Badge>
        </div>
        <p className="text-sm text-[#6B6B76] mb-4">
          Connecting is optional. Master Closer works standalone; linking lets Real Elite resolve this
          workspace, receive its events, and call its actions.
        </p>
        {hub?.connected ? (
          <div className="text-xs text-[#6B6B76] space-y-1">
            <div>Workspace: <span className="text-foreground">{hub.orgName}</span></div>
            <div>Hub Org ID: <span className="font-mono">{hub.reoOrgId}</span></div>
            <div>Hub User ID: <span className="font-mono">{hub.reoUserId ?? "—"}</span></div>
          </div>
        ) : (
          <Button asChild className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
            <a href={`${HUB_URL}?return=${encodeURIComponent(
              typeof window !== "undefined" ? `${window.location.origin}/auth/hub` : "/auth/hub",
            )}`}>
              Connect To Real Elite
            </a>
          </Button>
        )}
      </Card>

      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-5 w-5" />
          <h3 className="font-semibold">Recent Events</h3>
        </div>
        {events?.length ? (
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="font-mono text-xs">{e.event_type}</span>
                <span className="text-xs text-[#6B6B76]">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#6B6B76]">No events emitted yet.</p>
        )}
      </Card>

      <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <Webhook className="h-5 w-5" />
          <h3 className="font-semibold">Event Webhooks</h3>
        </div>
        <p className="text-sm text-[#6B6B76] mb-4">
          Every event is POSTed to enabled endpoints with an <span className="font-mono text-xs">x-webhook-signature</span>{" "}
          HMAC-SHA256 header of the raw body.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="md:col-span-1">
            <Label>Endpoint URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="md:col-span-1">
            <Label>Signing Secret</Label>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="shared secret" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={!url || !secret || addHook.isPending}
              onClick={() => addHook.mutate()}
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
            >
              Add Webhook
            </Button>
          </div>
        </div>
        {hooks?.length ? (
          <ul className="divide-y divide-[#E7E7EC]">
            {hooks.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-mono truncate max-w-[60%]">{h.url}</span>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={h.enabled}
                    onCheckedChange={(v) => updateHook.mutate({ id: h.id, enabled: v })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeHook.mutate(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#6B6B76]">No webhooks configured.</p>
        )}
      </Card>
    </div>
  );
}
