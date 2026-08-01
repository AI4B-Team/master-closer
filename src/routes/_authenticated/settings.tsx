import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/back-office/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Master Closer" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("full_name, org_id").maybeSingle();
      setFullName(prof?.full_name ?? "");
      if (prof?.org_id) {
        const { data: org } = await supabase.from("organizations").select("name").eq("id", prof.org_id).maybeSingle();
        setOrgName(org?.name ?? "");
      }
    })();
  }, []);

  const save = async () => {
    const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user!.id);
    if (prof?.org_id) await supabase.from("organizations").update({ name: orgName }).eq("id", prof.org_id);
    toast.success("Saved.");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Your account and workspace." />
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
      <HubPanel />
    </div>

  );
}
