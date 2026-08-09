import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Mail, Play, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/back-office/ui";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { runDigestNow } from "@/lib/reports.functions";

type Schedule = {
  id: string;
  name: string;
  cadence: string;
  send_hour_utc: number;
  weekday: number;
  recipients: string[];
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:00 ${suffix} UTC`;
}

function when(s: Schedule) {
  return s.cadence === "daily"
    ? `Every day at ${hourLabel(s.send_hour_utc)}`
    : `Every ${DAYS[s.weekday]} at ${hourLabel(s.send_hour_utc)}`;
}

function stamp(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
}

/**
 * Scheduled digests of the numbers on this page. A digest lands in the workspace
 * activity feed — the same source the bell menu and inbox read — so it works
 * before any sending domain is connected; recipients are stored for email later.
 */
export function DigestSchedules() {
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const qc = useQueryClient();
  const runNow = useServerFn(runDigestNow);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Weekly Performance");
  const [cadence, setCadence] = useState("weekly");
  const [hour, setHour] = useState("13");
  const [weekday, setWeekday] = useState("1");
  const [recipients, setRecipients] = useState("");

  const { data: schedules } = useQuery({
    queryKey: ["report_schedules", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_schedules")
        .select("id, name, cadence, send_hour_utc, weekday, recipients, enabled, last_run_at, next_run_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Schedule[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["report_schedules", wsId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No active workspace");
      const { data: prof } = await supabase.from("profiles").select("id, org_id").maybeSingle();
      if (!prof?.org_id) throw new Error("No organization for this user");
      const { error } = await supabase.from("report_schedules").insert({
        workspace_id: wsId,
        org_id: prof.org_id,
        created_by: prof.id,
        name: name.trim() || "Performance Digest",
        cadence,
        send_hour_utc: Number(hour),
        weekday: Number(weekday),
        recipients: recipients
          .split(/[,\s]+/)
          .map((r) => r.trim())
          .filter(Boolean),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setRecipients("");
      toast.success("Digest scheduled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (s: Schedule) => {
      const { error } = await supabase.from("report_schedules").update({ enabled: !s.enabled }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (id: string) => runNow({ data: { scheduleId: id } }),
    onSuccess: (res) => {
      toast.success(res?.digests?.[0]?.headline ?? "Digest sent to your activity feed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
            <CalendarClock className="h-5 w-5 text-[#CC0000]" />
          </div>
          <div>
            <h3 className="font-semibold">Scheduled Digests</h3>
            <p className="text-sm text-[#6B6B76]">
              Daily or weekly performance summaries delivered to your notifications inbox.
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> New Digest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule A Digest</DialogTitle>
              <DialogDescription>
                Calls, connects, talk time, deals won and the top objection for the trailing window.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly Performance" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cadence</Label>
                  <Select value={cadence} onValueChange={setCadence}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Send Hour</Label>
                  <Select value={hour} onValueChange={setHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {cadence === "weekly" && (
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Email Recipients</Label>
                <Input
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="ops@company.com, owner@company.com"
                />
                <p className="text-xs text-[#9A9AA5]">
                  Saved for email delivery once a sending domain is connected. Digests always appear in your inbox.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Scheduling…" : "Schedule Digest"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!schedules?.length ? (
        <EmptyState
          icon={CalendarClock}
          title="No Digests Scheduled"
          hint="Schedule a daily or weekly summary so the numbers come to you."
        />
      ) : (
        <div className="mt-5 divide-y divide-[#EFEFF3]">
          {schedules.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-sm text-[#6B6B76]">{when(s)}</div>
                <div className="text-xs text-[#9A9AA5] mt-0.5">
                  Last sent {stamp(s.last_run_at)} · Next {stamp(s.next_run_at)}
                  {s.recipients.length > 0 && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Mail className="h-3 w-3" /> {s.recipients.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={() => toggle.mutate(s)}
                  aria-label={`Enable ${s.name}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2"
                  onClick={() => send.mutate(s.id)}
                  disabled={send.isPending}
                >
                  <Play className="h-3.5 w-3.5" /> Send Now
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-[#9A9AA5] hover:text-[#CC0000]"
                  onClick={() => remove.mutate(s.id)}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
