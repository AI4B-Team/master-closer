import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Trash2, Save, PhoneCall, Clock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { TaskPanel } from "@/components/back-office/TaskPanel";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  source: string | null;
  status: string;
  consent: string;
  notes: string | null;
  owner_id: string | null;
  tags: string[] | null;
  created_at: string;
};

const STATUSES = ["new", "contacted", "qualified", "unqualified", "customer"];
const CONSENTS = ["unknown", "implied", "express_written", "opt_out"];
const UNASSIGNED = "__unassigned__";


export function LeadDrawer({
  lead,
  onOpenChange,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<Lead>>({});

  useEffect(() => {
    if (lead) setForm({ ...lead });
  }, [lead]);

  const { data: calls } = useQuery({
    queryKey: ["lead-calls", lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, mode, outcome, disposition, duration_sec, close_probability, started_at")
        .eq("lead_id", lead!.id)
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({
          name: form.name ?? "",
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          title: form.title || null,
          source: form.source || null,
          status: (form.status ?? "new") as never,
          consent: (form.consent ?? "unknown") as never,
          notes: form.notes || null,
        })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{lead?.name ?? "Lead"}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              onClick={() => navigate({ to: "/dialer" })}
              disabled={!form.phone}
            >
              <Phone className="h-4 w-4 mr-1" /> Call In Dialer
            </Button>
            <Badge variant="outline" className="capitalize">
              {(form.consent ?? "unknown").replace("_", " ")}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Source</Label>
              <Input value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "new"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Consent</Label>
              <Select value={form.consent ?? "unknown"} onValueChange={(v) => setForm({ ...form, consent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONSENTS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Context your closer should know before dialing."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={!form.name || save.isPending}
              className="bg-[#111114] hover:bg-[#111114]/90 rounded-xl"
            >
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-[#CC0000] hover:text-[#A30000]"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>

          <div className="pt-2 border-t border-[#E7E7EC]">
            <p className="text-xs uppercase tracking-wider text-[#6B6B76] mt-4 mb-2">Follow-Ups</p>
            {lead ? <TaskPanel leadId={lead.id} /> : null}
          </div>

          <div className="pt-2 border-t border-[#E7E7EC]">
            <p className="text-xs uppercase tracking-wider text-[#6B6B76] mt-4 mb-2">Call History</p>
            {!calls || calls.length === 0 ? (
              <p className="text-sm text-[#6B6B76]">No calls logged for this lead yet.</p>
            ) : (
              <ul className="space-y-2">
                {calls.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                    <PhoneCall className="h-4 w-4 text-[#CC0000]" />
                    <span className="capitalize font-medium">{c.mode}</span>
                    <span className="text-[#6B6B76] capitalize">{c.disposition ?? c.outcome}</span>
                    <span className="ml-auto flex items-center gap-1 text-[#6B6B76]">
                      <Clock className="h-3.5 w-3.5" />
                      {Math.round((c.duration_sec ?? 0) / 60)}m
                    </span>
                    <Badge variant="outline">{c.close_probability}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
