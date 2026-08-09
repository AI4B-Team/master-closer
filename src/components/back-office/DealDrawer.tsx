import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Trash2, Phone, Clock, FileSignature, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { titleCase } from "@/components/back-office/ui";

export type DealRow = {
  id: string;
  title: string;
  value: number | string;
  stage: string;
  stage_id: string | null;
  close_probability: number;
  expected_close_at: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

type StageOption = { id: string; label: string; kind: string };

const money = (n: number) => `$${Number(n || 0).toLocaleString()}`;

export function DealDrawer({
  deal,
  stages,
  leads,
  onOpenChange,
  legacyStage,
}: {
  deal: DealRow | null;
  stages: StageOption[];
  leads: { id: string; name: string; company: string | null }[];
  onOpenChange: (open: boolean) => void;
  legacyStage: (stage: StageOption | undefined) => string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<DealRow>>({});

  useEffect(() => {
    if (deal) setForm({ ...deal });
  }, [deal]);

  const { data: calls } = useQuery({
    queryKey: ["deal-calls", deal?.lead_id],
    enabled: !!deal?.lead_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, mode, outcome, disposition, duration_sec, close_probability, started_at")
        .eq("lead_id", deal!.lead_id!)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agreements } = useQuery({
    queryKey: ["deal-agreements", deal?.id],
    enabled: !!deal?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, title, status, amount, currency, signed_at, created_at")
        .eq("deal_id", deal!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const stage = stages.find((s) => s.id === form.stage_id);
      const { error } = await supabase
        .from("deals")
        .update({
          title: (form.title ?? "").trim(),
          value: Number(form.value) || 0,
          close_probability: Math.max(0, Math.min(100, Number(form.close_probability) || 0)),
          expected_close_at: form.expected_close_at || null,
          lead_id: form.lead_id || null,
          stage_id: form.stage_id ?? null,
          stage: legacyStage(stage) as never,
        })
        .eq("id", deal!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal updated.");
      qc.invalidateQueries({ queryKey: ["deals"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deals").delete().eq("id", deal!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal removed.");
      qc.invalidateQueries({ queryKey: ["deals"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const prob = Math.max(0, Math.min(100, Number(form.close_probability ?? 0)));
  const weighted = (Number(form.value) || 0) * (prob / 100);
  const linkedLead = leads.find((l) => l.id === form.lead_id);

  return (
    <Sheet open={!!deal} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{deal?.title ?? "Deal"}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-lg font-normal">
              Weighted <span className="font-mono ml-1.5">{money(Math.round(weighted))}</span>
            </Badge>
            {linkedLead ? (
              <Badge variant="outline" className="rounded-lg font-normal">
                <User className="h-3 w-3 mr-1" />
                {linkedLead.company ? `${linkedLead.name} · ${linkedLead.company}` : linkedLead.name}
              </Badge>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl ml-auto"
              onClick={() => navigate({ to: "/dialer" })}
            >
              <Phone className="h-4 w-4 mr-1" /> Call In Dialer
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title</Label>
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Value ($)</Label>
              <Input
                type="number"
                value={String(form.value ?? 0)}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div>
              <Label>Expected Close</Label>
              <Input
                type="date"
                value={form.expected_close_at ?? ""}
                onChange={(e) => setForm({ ...form, expected_close_at: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Close Probability — {prob}%</Label>
              <Slider
                className="mt-3"
                value={[prob]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setForm({ ...form, close_probability: v[0] })}
              />
            </div>
            <div>
              <Label>Stage</Label>
              <Select
                value={form.stage_id ?? stages[0]?.id ?? ""}
                onValueChange={(v) => setForm({ ...form, stage_id: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked Lead</Label>
              <Select
                value={form.lead_id || "none"}
                onValueChange={(v) => setForm({ ...form, lead_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.company ? `${l.name} · ${l.company}` : l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={!form.title || save.isPending}
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
            <p className="text-xs uppercase tracking-wider text-[#6B6B76] mt-4 mb-2">Call History</p>
            {(calls ?? []).length === 0 ? (
              <p className="text-sm text-[#6B6B76]">
                {form.lead_id ? "No Calls Logged Yet." : "Link A Lead To See Call History."}
              </p>
            ) : (
              <div className="space-y-2">
                {(calls ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#E7E7EC] px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {titleCase(String(c.outcome))}
                        {c.disposition ? ` · ${titleCase(String(c.disposition))}` : ""}
                      </div>
                      <div className="text-[11px] text-[#6B6B76] font-mono">
                        {new Date(c.started_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#6B6B76] font-mono flex items-center gap-2 shrink-0">
                      <Clock className="h-3 w-3" />
                      {Math.round(Number(c.duration_sec ?? 0) / 60)}m · {Number(c.close_probability ?? 0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E7E7EC]">
            <p className="text-xs uppercase tracking-wider text-[#6B6B76] mt-4 mb-2">Agreements</p>
            {(agreements ?? []).length === 0 ? (
              <p className="text-sm text-[#6B6B76]">No Agreements On This Deal Yet.</p>
            ) : (
              <div className="space-y-2">
                {(agreements ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-[#E7E7EC] px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <FileSignature className="h-3.5 w-3.5 text-[#6B6B76] shrink-0" />
                      <span className="text-sm font-medium truncate">{a.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-[#6B6B76]">{money(Number(a.amount ?? 0))}</span>
                      <Badge variant="outline" className="rounded-lg font-normal">{titleCase(String(a.status))}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
