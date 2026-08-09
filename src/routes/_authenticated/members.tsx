import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { Avatar, EmptyState } from "@/components/back-office/ui";
import { UserPlus, Trash2, ShieldCheck, Users, MailClock, X } from "lucide-react";
import { inviteMember, listInvites, listMembers, removeMember, revokeInvite, setMemberRole, setWorkspaceRole } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Team Members — Master Closer" },
      { name: "description", content: "Invite closers, set admin / manager / rep access, and remove people from your workspace." },
      { property: "og:title", content: "Team Members — Master Closer" },
      { property: "og:description", content: "Invite closers and manage workspace roles in Master Closer." },
    ],
  }),
  component: MembersPage,
});

const ROLES = [
  { value: "admin", label: "Admin", hint: "Full access, billing, members and compliance." },
  { value: "manager", label: "Manager", hint: "Runs campaigns, lists and reports." },
  { value: "rep", label: "Rep", hint: "Dials, closes and works their own pipeline." },
] as const;

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-[#CC0000]/10 text-[#CC0000]",
  manager: "bg-blue-100 text-blue-700",
  rep: "bg-gray-100 text-gray-600",
};

const WS_ROLES = [
  { value: "admin", label: "Workspace Admin" },
  { value: "member", label: "Workspace Member" },
  { value: "owner", label: "Transfer Ownership" },
] as const;

const WS_ROLE_STYLE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-violet-100 text-violet-700",
  member: "bg-gray-100 text-gray-600",
};

function MembersPage() {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listMembers);
  const invite = useServerFn(inviteMember);
  const changeRole = useServerFn(setMemberRole);
  const kick = useServerFn(removeMember);
  const changeAccess = useServerFn(setWorkspaceRole);
  const fetchInvites = useServerFn(listInvites);
  const cancelInvite = useServerFn(revokeInvite);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "rep">("rep");

  const { data, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers({}),
  });

  const { data: inviteData } = useQuery({
    queryKey: ["workspace-invites"],
    queryFn: () => fetchInvites({}),
  });
  const pendingInvites = inviteData?.invites ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["workspace-invites"] });
  };

  const revokeMut = useMutation({
    mutationFn: (inviteId: string) => cancelInvite({ data: { inviteId } }),
    onSuccess: () => {
      toast.success("Invite Canceled.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel that invite."),
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email, role, fullName: fullName || undefined } }),
    onSuccess: () => {
      toast.success("Invite sent.");
      setOpen(false);
      setEmail("");
      setFullName("");
      setRole("rep");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not send the invite."),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "manager" | "rep" }) => changeRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the role."),
  });

  const accessMut = useMutation({
    mutationFn: (v: { userId: string; role: "owner" | "admin" | "member" }) => changeAccess({ data: v }),
    onSuccess: () => {
      toast.success("Workspace Access Updated.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update workspace access."),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => kick({ data: { userId } }),
    onSuccess: () => {
      toast.success("Member removed.");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove that member."),
  });

  const isAdmin = data?.isAdmin ?? false;
  const members = data?.members ?? [];

  return (
    <div>
      <PageHeader
        title="Team"
        description="Who can run calls, campaigns and money in this workspace."
        tabs={TAB_GROUPS.reports}
        action={
          isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl">
                  <UserPlus className="h-4 w-4 mr-1" /> Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite A Closer</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="closer@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label} — {r.hint}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => inviteMut.mutate()}
                    disabled={!email.trim() || inviteMut.isPending}
                    className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
                  >
                    Send Invite
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <Card className="p-0 rounded-2xl border-[#E7E7EC] shadow-none overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-[#6B6B76]">Loading Members…</div>
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title="No Members Yet" hint="Invite your first closer to this workspace." />
        ) : (
          <div className="divide-y divide-[#E7E7EC]">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar name={m.fullName || m.email || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {m.fullName || m.email?.split("@")[0]}
                    {m.isSelf ? <span className="text-[#6B6B76] font-normal"> (you)</span> : null}
                  </div>
                  <div className="text-xs text-[#6B6B76] truncate">{m.email}</div>
                </div>
                {isAdmin && !m.isSelf ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      roleMut.mutate({ userId: m.id, role: v as "admin" | "manager" | "rep" })
                    }
                  >
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={ROLE_STYLE[m.role] ?? ROLE_STYLE.rep}>{m.role}</Badge>
                )}
                {isAdmin && !m.isSelf && m.workspaceRole !== "owner" ? (
                  <Select
                    value={m.workspaceRole}
                    onValueChange={(v) =>
                      accessMut.mutate({ userId: m.id, role: v as "owner" | "admin" | "member" })
                    }
                  >
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WS_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={WS_ROLE_STYLE[m.workspaceRole] ?? WS_ROLE_STYLE.member}>
                    {m.workspaceRole === "owner" ? "Owner" : m.workspaceRole === "admin" ? "Workspace Admin" : "Workspace Member"}
                  </Badge>
                )}
                {isAdmin && !m.isSelf ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.email}`}
                    onClick={() => removeMut.mutate(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-[#6B6B76]" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {pendingInvites.length > 0 ? (
        <Card className="mt-6 p-0 rounded-2xl border-[#E7E7EC] shadow-none overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E7E7EC] text-sm font-medium">
            <MailClock className="h-4 w-4 text-[#6B6B76]" />
            Pending Invites
            <Badge className="bg-gray-100 text-gray-600">{pendingInvites.length}</Badge>
          </div>
          <div className="divide-y divide-[#E7E7EC]">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{inv.email}</div>
                  <div className="text-xs text-[#6B6B76]">
                    Invited {new Date(inv.createdAt).toLocaleDateString()} · Awaiting First Sign In
                  </div>
                </div>
                <Badge className={WS_ROLE_STYLE[inv.role] ?? WS_ROLE_STYLE.member}>
                  {inv.role === "admin" ? "Workspace Admin" : "Workspace Member"}
                </Badge>
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Cancel invite for ${inv.email}`}
                    onClick={() => revokeMut.mutate(inv.id)}
                  >
                    <X className="h-4 w-4 text-[#6B6B76]" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {!isAdmin ? (
        <p className="mt-4 text-sm text-[#6B6B76] flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0E9F6E]" />
          Only workspace admins can invite people or change roles.
        </p>
      ) : null}
    </div>
  );
}
