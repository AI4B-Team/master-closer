import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { CreditCard, FileSignature, Link2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Agreements — Master Closer" },
      { name: "description", content: "Collect payment and send the agreement while the call is still live." },
      { property: "og:title", content: "Payments & Agreements — Master Closer" },
      { property: "og:description", content: "Collect payment and send the agreement while the call is still live." },
    ],
  }),
  component: PaymentsPage,
});

const DEFAULT_AGREEMENT =
  "This agreement confirms the terms discussed on today's recorded call, including scope, price, and start date. Signing below authorizes the payment method on file.";

type PayConfig = {
  currency: string;
  collect_on_call: boolean;
  deposit_pct: string;
  auto_send_agreement: boolean;
  agreement_template: string;
  checkout_link: string;
};

const DEFAULTS: PayConfig = {
  currency: "USD",
  collect_on_call: true,
  deposit_pct: "50",
  auto_send_agreement: true,
  agreement_template: DEFAULT_AGREEMENT,
  checkout_link: "",
};

function PaymentsPage() {
  const [cfg, setCfg] = useState<PayConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data: row, refetch } = useQuery({
    queryKey: ["integration-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations")
        .select("*")
        .eq("provider", "payments")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (row?.config) setCfg({ ...DEFAULTS, ...(row.config as Partial<PayConfig>) });
  }, [row]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (row) {
        const { error } = await supabase
          .from("integrations")
          .update({ config: cfg as any, status: "configured" })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          org_id: prof.org_id,
          provider: "payments",
          status: "configured",
          config: cfg as any,
        });
        if (error) throw error;
      }
      toast.success("Payment Settings Saved.");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payments & Agreements"
        description="Take payment on the call. Send the agreement in the same breath."
      />
      <AccountShell current="payments">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#CC0000]" /> Collection
              </h3>
              <Badge variant="secondary" className="capitalize">
                {row?.status ?? "not configured"}
              </Badge>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Collect On The Call</Label>
                  <p className="text-xs text-[#6B6B76]">Show the payment step in the live cockpit.</p>
                </div>
                <Switch
                  checked={cfg.collect_on_call}
                  onCheckedChange={(v) => setCfg({ ...cfg, collect_on_call: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={cfg.currency}
                    onChange={(e) => setCfg({ ...cfg, currency: e.target.value.toUpperCase().slice(0, 3) })}
                  />
                </div>
                <div>
                  <Label>Deposit %</Label>
                  <Input
                    type="number"
                    value={cfg.deposit_pct}
                    onChange={(e) => setCfg({ ...cfg, deposit_pct: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Checkout Link</Label>
                <Input
                  placeholder="https://checkout.example.com/plan"
                  value={cfg.checkout_link}
                  onChange={(e) => setCfg({ ...cfg, checkout_link: e.target.value })}
                />
                <p className="text-xs text-[#6B6B76] mt-1 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Sent to the prospect when the closer taps Collect.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <FileSignature className="h-4 w-4 text-[#CC0000]" /> Agreement
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Send After Close</Label>
                  <p className="text-xs text-[#6B6B76]">Fires the moment a call is marked won.</p>
                </div>
                <Switch
                  checked={cfg.auto_send_agreement}
                  onCheckedChange={(v) => setCfg({ ...cfg, auto_send_agreement: v })}
                />
              </div>
              <div>
                <Label>Template</Label>
                <Textarea
                  rows={7}
                  value={cfg.agreement_template}
                  onChange={(e) => setCfg({ ...cfg, agreement_template: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none lg:col-span-2">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-[#0E9F6E]" /> On-Call Money Rules
            </h3>
            <p className="text-sm text-[#6B6B76]">
              Payment steps stay hidden until the disclosure is on the record for the prospect's
              jurisdiction. Every collection attempt is written to the call timeline with the consent
              method that preceded it.
            </p>
          </Card>
        </div>

        <div className="mt-4">
          <Button onClick={save} disabled={saving} className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
            Save Changes
          </Button>
        </div>
      </AccountShell>
    </div>
  );
}
