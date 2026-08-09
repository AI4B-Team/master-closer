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
import { UserPlus, Trash2, ShieldCheck, Users } from "lucide-react";
import { inviteMember, listMembers, removeMember, setMemberRole } from "@/lib/team.functions";

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

function MembersPage() {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listMembers);
  const invite = useServerFn(inviteMember);
  const changeRole = useServerFn(setMemberRole);
  const kick = useServerFn(removeMember);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "rep">("rep");

  const { data, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers({}),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["members"] });

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

      {!isAdmin ? (
        <p className="mt-4 text-sm text-[#6B6B76] flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0E9F6E]" />
          Only workspace admins can invite people or change roles.
        </p>
      ) : null}
    </div>
  );
}
