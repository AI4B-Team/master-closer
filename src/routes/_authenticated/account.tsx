import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Camera, KeyRound, Smartphone, MonitorSmartphone, History, Mail, Bell, ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/back-office/AppShell";
import { AccountShell } from "@/components/back-office/AccountShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";


const searchSchema = z.object({
  tab: z.enum(["profile", "security", "notifications"]).optional(),
});

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account — Master Closer" },
      { name: "description", content: "Manage your profile, security, notifications, workspace, billing, integrations and compliance." },
      { property: "og:title", content: "Account — Master Closer" },
      { property: "og:description", content: "Manage your Master Closer profile, security and workspace settings." },
    ],
  }),
  validateSearch: searchSchema,
  component: AccountPage,
});

const NOTIFY_ROWS = [
  { key: "callSummaries", label: "Call Summaries", hint: "Email Recap After Every Completed Call." },
  { key: "handoffAlerts", label: "Handoff Alerts", hint: "Ping Me When AI Hands A Call To A Human Closer." },
  { key: "dealUpdates", label: "Deal Updates", hint: "Stage Changes And Won/Lost Notifications." },
  { key: "complianceFlags", label: "Compliance Flags", hint: "Disclosure Or DNC Issues Detected On A Call." },
] as const;

type NotifyKey = (typeof NOTIFY_ROWS)[number]["key"];

function AccountPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [notify, setNotify] = useState<Record<NotifyKey, boolean>>({
    callSummaries: true,
    handoffAlerts: true,
    dealUpdates: true,
    complianceFlags: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [mfaFactors, setMfaFactors] = useState<{ id: string; status: string }[]>([]);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName((user.user_metadata?.full_name as string) ?? "");
    setPhone((user.user_metadata?.phone as string) ?? "");
    setAvatarPath((user.user_metadata?.avatar_path as string) ?? null);
    const saved = user.user_metadata?.notify as Partial<Record<NotifyKey, boolean>> | undefined;
    if (saved) setNotify((p) => ({ ...p, ...saved }));
  }, [user]);

  /** Avatars live in a private bucket, so render them through a signed URL. */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!avatarPath) {
        setAvatarUrl(null);
        return;
      }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 3600);
      if (alive) setAvatarUrl(data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [avatarPath]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
    })();
  }, [user]);

  const verifiedFactor = mfaFactors.find((f) => f.status === "verified");

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick An Image File");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image Must Be Under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_path: path } });
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    setUploading(false);
    if (metaError) return toast.error(metaError.message);
    setAvatarPath(path);
    toast.success("Photo Updated");
  };

  const startMfa = async () => {
    setMfaBusy(true);
    // Clean up any half-finished enrollment so re-opening never errors out.
    for (const f of mfaFactors.filter((x) => x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${Date.now()}`,
    });
    setMfaBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Could Not Start Setup");
    setMfaFactorId(data.id);
    setMfaQr(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaCode("");
    setMfaOpen(true);
  };

  const confirmMfa = async () => {
    if (!mfaFactorId) return;
    if (mfaCode.trim().length !== 6) return toast.error("Enter The 6-Digit Code");
    setMfaBusy(true);
    const { data: chal, error: chalError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chalError || !chal) {
      setMfaBusy(false);
      return toast.error(chalError?.message ?? "Challenge Failed");
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: chal.id,
      code: mfaCode.trim(),
    });
    setMfaBusy(false);
    if (error) return toast.error(error.message);
    const { data } = await supabase.auth.mfa.listFactors();
    setMfaFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
    setMfaOpen(false);
    toast.success("Two-Factor Authentication Enabled");
  };

  const disableMfa = async () => {
    if (!verifiedFactor) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setMfaBusy(false);
    if (error) return toast.error(error.message);
    setMfaFactors((p) => p.filter((f) => f.id !== verifiedFactor.id));
    toast.success("Two-Factor Authentication Disabled");
  };


  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, phone } });
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile Saved");
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    const { error } = await supabase.auth.updateUser({ data: { notify } });
    setSavingPrefs(false);
    if (error) return toast.error(error.message);
    toast.success("Notification Settings Saved");
  };

  const savePassword = async () => {
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password Updated");
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Reset Email Sent");
  };

  const displayName = fullName || user?.email?.split("@")[0] || "You";
  const initials = (() => {
    const parts = displayName.split(/[\s.@_-]+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    return (parts[0] ?? displayName).slice(0, 2).toUpperCase();
  })();
  const changedAt = (user?.updated_at ?? user?.created_at) as string | undefined;
  const passwordUpdatedLabel = changedAt
    ? (() => {
        const days = Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000);
        return days <= 0 ? "Today" : `${days} Day${days === 1 ? "" : "s"} Ago`;
      })()
    : "Unknown";

  const identity = (
    <IdentityCard
      initials={initials || "MC"}
      name={displayName}
      email={user?.email ?? ""}
      verified={!!user?.email_confirmed_at}
    />
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <AccountShell current={tab ?? "profile"}>
        <PageHeader title="Account" description="Manage Your Profile, Security, Notifications, Workspace, Billing, And Compliance." />
        <Tabs
          value={tab ?? "profile"}
          onValueChange={(v) =>
            navigate({ search: { tab: v as "profile" | "security" | "notifications" }, replace: true })
          }
        >
          <TabsContent value="profile" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="font-display text-base">Profile</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={`${displayName} profile photo`}
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-display font-bold text-primary-foreground">
                          {initials || "MC"}
                        </div>
                      )}
                      <div>
                        <div className="font-display font-bold text-foreground">{displayName}</div>
                        <div className="text-xs text-muted-foreground">Owner</div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void uploadAvatar(f);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 rounded-full"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                        >
                          <Camera className="mr-1.5 h-3.5 w-3.5" />
                          {uploading ? "Uploading..." : "Change Photo"}
                        </Button>
                      </div>
                    </div>


                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="full-name">Full Name</Label>
                        <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+1 555 555 5555" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={user?.email ?? ""} disabled className="mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button className="rounded-full" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Changes"}
                </Button>
              </div>
              <div className="space-y-6">{identity}</div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Bell className="h-4 w-4 text-muted-foreground" /> Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {NOTIFY_ROWS.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{row.label}</div>
                          <div className="text-xs text-muted-foreground">{row.hint}</div>
                        </div>
                        <Switch
                          checked={notify[row.key]}
                          onCheckedChange={(v) => setNotify((p) => ({ ...p, [row.key]: v }))}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Button className="rounded-full" onClick={savePrefs} disabled={savingPrefs}>
                  {savingPrefs ? "Saving..." : "Save Notifications"}
                </Button>
              </div>
              <div className="space-y-6">{identity}</div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <KeyRound className="h-4 w-4 text-muted-foreground" /> Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="new-pass">New Password</Label>
                        <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="confirm-pass">Confirm Password</Label>
                        <Input id="confirm-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="rounded-full" onClick={savePassword} disabled={savingPassword}>
                        {savingPassword ? "Updating..." : "Update Password"}
                      </Button>
                      <Button variant="outline" className="rounded-full" onClick={sendReset}>
                        Send Reset Email
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last Updated {passwordUpdatedLabel} · Use At Least 12 Characters With A Number And Symbol.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Mail className="h-4 w-4 text-muted-foreground" /> Recovery Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{user?.email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {user?.email_confirmed_at ? "Verified — Used For Password Resets" : "Not Verified Yet"}
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-full" onClick={sendReset}>Verify</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Smartphone className="h-4 w-4 text-muted-foreground" /> Two-Factor Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        Require A One-Time Code From Your Authenticator App On Every New Sign-In.
                      </p>
                      {verifiedFactor && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <ShieldCheck className="h-3.5 w-3.5" /> Enabled On This Account
                        </div>
                      )}
                    </div>
                    {verifiedFactor ? (
                      <Button variant="outline" className="rounded-full" disabled={mfaBusy} onClick={disableMfa}>
                        Disable
                      </Button>
                    ) : (
                      <Button variant="outline" className="rounded-full" disabled={mfaBusy} onClick={startMfa}>
                        Enable
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={mfaOpen} onOpenChange={setMfaOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-display">Set Up Two-Factor Authentication</DialogTitle>
                      <DialogDescription>
                        Scan this code with Google Authenticator, 1Password, or Authy, then enter the
                        6-digit code to confirm.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {mfaQr && (
                        <img
                          src={mfaQr}
                          alt="Two-factor authentication setup QR code"
                          className="mx-auto h-44 w-44 rounded-xl border border-border bg-background p-2"
                        />
                      )}
                      {mfaSecret && (
                        <p className="break-all text-center text-xs text-muted-foreground">
                          Manual key: <span className="font-mono">{mfaSecret}</span>
                        </p>
                      )}
                      <div>
                        <Label htmlFor="mfa-code">6-Digit Code</Label>
                        <Input
                          id="mfa-code"
                          inputMode="numeric"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                          className="mt-1 tracking-[0.4em]"
                          placeholder="000000"
                        />
                      </div>
                      <Button className="w-full rounded-full" disabled={mfaBusy} onClick={confirmMfa}>
                        {mfaBusy ? "Verifying..." : "Confirm And Enable"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>


                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <MonitorSmartphone className="h-4 w-4 text-muted-foreground" /> Active Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          This Device <Badge variant="secondary">Current</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Signed In{" "}
                          {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Recently"}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={async () => {
                          await supabase.auth.signOut();
                          window.location.href = "/auth";
                        }}
                      >
                        Sign Out
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Last Sign-In{" "}
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Unavailable"}{" "}
                      · Account Created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-6">{identity}</div>
            </div>
          </TabsContent>
        </Tabs>
      </AccountShell>
    </div>
  );
}

function IdentityCard({
  initials, name, email, verified,
}: { initials: string; name: string; email: string; verified: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-display font-bold text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium text-foreground">Owner</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{verified ? "Verified" : "Unverified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Two-Factor</span>
            <span className="font-medium text-foreground">Disabled</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
