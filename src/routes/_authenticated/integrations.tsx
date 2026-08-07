import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/back-office/AppShell";
import { Video, Phone, Calendar, CreditCard, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Master Closer" }] }),
  component: IntegrationsPage,
});

const CONNECTORS = [
  { key: "gohighlevel", name: "GoHighLevel", icon: Zap, desc: "Two-way sync with your CRM.", recommended: true },
  { key: "zoom", name: "Zoom", icon: Video, desc: "Join and transcribe Zoom calls." },
  { key: "google_meet", name: "Google Meet", icon: Video, desc: "Join and transcribe Meet calls." },
  { key: "teams", name: "Microsoft Teams", icon: Video, desc: "Join and transcribe Teams calls." },
  { key: "stripe", name: "Stripe", icon: CreditCard, desc: "Charge cards on the call." },
  { key: "telephony", name: "Telephony (Telnyx/Twilio)", icon: Phone, desc: "Dial through your carrier." },
  { key: "google_calendar", name: "Google Calendar", icon: Calendar, desc: "Book follow-ups instantly." },
];

function IntegrationsPage() {
  const qc = useQueryClient();
  const { data: connections } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data } = await supabase.from("integrations").select("*");
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ provider, connect }: { provider: string; connect: boolean }) => {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      if (connect) {
        const { error } = await supabase.from("integrations").upsert(
          { org_id: prof.org_id, provider, status: "connected", connected_at: new Date().toISOString() },
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
  });

  const statusFor = (key: string) =>
    connections?.find((c) => c.provider === key)?.status === "connected";

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
              <p className="text-xs text-[#6B6B76] mt-1 mb-4 min-h-[32px]">{c.desc}</p>
              <div className="flex items-center justify-between">
                <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-[#0E9F6E]" : ""}>
                  {connected ? "Connected" : "Not Connected"}
                </Badge>
                <Button
                  size="sm"
                  variant={connected ? "outline" : "default"}
                  className={connected ? "" : "bg-[#CC0000] hover:bg-[#A30000]"}
                  onClick={() => toggle.mutate({ provider: c.key, connect: !connected })}
                >
                  {connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
