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
import { Phone, Trash2, Save, PhoneCall, Clock, X, Briefcase, FileText, Plus } from "lucide-react";
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
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (lead) setForm({ ...lead });
    setTagDraft("");
  }, [lead]);

  /* Owners come from the org's profiles so leads can be routed to a real closer. */
  const { data: members } = useQuery({
    queryKey: ["org-members-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });



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

  /* Linked revenue: deals and agreements tied to this lead. */
  const { data: deals } = useQuery({
    queryKey: ["lead-deals", lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, value, close_probability, stage_id, updated_at")
        .eq("lead_id", lead!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agreements } = useQuery({
    queryKey: ["lead-agreements", lead?.id],
    enabled: !!lead?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, title, amount, currency, status, created_at")
        .eq("lead_id", lead!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /* One-click deal creation drops the lead into the first pipeline stage. */
  const createDeal = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead selected.");
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("deals").insert({
        title: `${lead.company || lead.name} — New Deal`,
        value: 0,
        stage: "new" as any,
        stage_id: stage?.id ?? null,
        close_probability: 50,
        lead_id: lead.id,
        owner_id: lead.owner_id ?? null,
        org_id: prof.org_id, workspace_id: prof.active_workspace_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal created.");
      qc.invalidateQueries({ queryKey: ["lead-deals", lead?.id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: any) => toast.error(e.message),
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
          owner_id: form.owner_id || null,
          tags: form.tags && form.tags.length > 0 ? form.tags : null,
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
            <div>
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
              <Label>Owner</Label>
              <Select
                value={form.owner_id ?? UNASSIGNED}
                onValueChange={(v) => setForm({ ...form, owner_id: v === UNASSIGNED ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {(members ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email || "Teammate"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {(form.tags ?? []).map((t) => (
                  <Badge key={t} variant="outline" className="gap-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      className="text-[#6B6B76] hover:text-[#CC0000]"
                      onClick={() => setForm({ ...form, tags: (form.tags ?? []).filter((x) => x !== t) })}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(form.tags ?? []).length === 0 && (
                  <span className="text-xs text-[#6B6B76]">No tags yet.</span>
                )}
              </div>
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Type a tag and press Enter"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const t = tagDraft.trim();
                  if (!t) return;
                  const next = Array.from(new Set([...(form.tags ?? []), t]));
                  setForm({ ...form, tags: next });
                  setTagDraft("");
                }}
              />
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
                  <li
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate({ to: "/calls", search: { call: c.id } as any })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate({ to: "/calls", search: { call: c.id } as any });
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm transition-colors hover:border-[#CC0000]/40"
                  >
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

          <div className="pt-2 border-t border-[#E7E7EC]">
            <div className="flex items-center justify-between mt-4 mb-2">
              <p className="text-xs uppercase tracking-wider text-[#6B6B76]">Deals</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => createDeal.mutate()}
                disabled={createDeal.isPending}
              >
                <Plus className="h-4 w-4 mr-1" /> New Deal
              </Button>
            </div>
            {!deals || deals.length === 0 ? (
              <p className="text-sm text-[#6B6B76]">No deals linked to this lead yet.</p>
            ) : (
              <ul className="space-y-2">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                    <Briefcase className="h-4 w-4 text-[#CC0000]" />
                    <span className="font-medium truncate">{d.title}</span>
                    <span className="ml-auto text-[#6B6B76]">${Number(d.value ?? 0).toLocaleString()}</span>
                    <Badge variant="outline">{d.close_probability}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2 border-t border-[#E7E7EC]">
            <p className="text-xs uppercase tracking-wider text-[#6B6B76] mt-4 mb-2">Agreements</p>
            {!agreements || agreements.length === 0 ? (
              <p className="text-sm text-[#6B6B76]">No agreements sent to this lead yet.</p>
            ) : (
              <ul className="space-y-2">
                {agreements.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-[#E7E7EC] px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-[#CC0000]" />
                    <span className="font-medium truncate">{a.title}</span>
                    <span className="ml-auto text-[#6B6B76]">
                      {a.currency} {Number(a.amount ?? 0).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="capitalize">{a.status}</Badge>
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
