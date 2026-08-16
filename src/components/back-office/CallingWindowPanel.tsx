import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone";
import {
  US_TIMEZONES, WEEKDAY_LABELS, formatMinute, normalizeWindow, timezoneLabel,
} from "@/lib/calling-window";

function minuteToInput(minute: number) {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function inputToMinute(value: string, fallback: number) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h! * 60 + m!;
}

/**
 * Quiet hours belong to the prospect, so this panel edits one rule that every
 * dial path reads: the window, the days, and the fallback zone used when an
 * area code tells us nothing.
 */
export function CallingWindowPanel() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("21:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tz, setTz] = useState("America/New_York");
  const [enforce, setEnforce] = useState(true);

  const { data: row } = useQuery({
    queryKey: ["calling-window", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("calling_windows")
        .select("id, start_minute, end_minute, days, default_timezone, enforce")
        .eq("workspace_id", wsId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (row === undefined) return; // still loading — leave the form alone
    if (row === null) {
      // No window saved for this workspace yet: reset to defaults so a save
      // can't copy the previously viewed workspace's hours onto this one.
      setStart("08:00");
      setEnd("21:00");
      setDays([1, 2, 3, 4, 5]);
      setTz("America/New_York");
      setEnforce(true);
      return;
    }
    setStart(minuteToInput(row.start_minute));
    setEnd(minuteToInput(row.end_minute));
    setDays(row.days ?? [1, 2, 3, 4, 5]);
    setTz(row.default_timezone);
    setEnforce(row.enforce);
  }, [row, wsId]);

  const { data: blocks } = useQuery({
    queryKey: ["calling-window-blocks", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("calling_window_blocks")
        .select("id, phone, lead_timezone, timezone_source, local_time, reason, created_at")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No active workspace.");
      const win = normalizeWindow({
        start_minute: inputToMinute(start, 480),
        end_minute: inputToMinute(end, 1260),
        days,
      });
      const { error } = await supabase
        .from("calling_windows")
        .upsert(
          { workspace_id: wsId, ...win, default_timezone: tz, enforce },
          { onConflict: "workspace_id" },
        );
      if (error) throw error;
      return win;
    },
    onSuccess: (win) => {
      setStart(minuteToInput(win.start_minute));
      setEnd(minuteToInput(win.end_minute));
      setDays(win.days);
      toast.success("Calling window saved.");
      qc.invalidateQueries({ queryKey: ["calling-window"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none mb-4">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-[#CC0000]/10 flex items-center justify-center shrink-0">
          <Clock className="h-5 w-5 text-[#CC0000]" />
        </div>
        <div>
          <h3 className="font-semibold">Calling Window</h3>
          <p className="text-sm text-[#6B6B76]">
            Evaluated in the prospect's local time — from their own timezone, then their area code, then your
            fallback. A dial outside the window is stopped and logged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Opens (Local)</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label>Closes (Local)</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5 rounded-xl" />
            </div>
          </div>

          <div>
            <Label>Calling Days</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={days.includes(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    days.includes(i)
                      ? "border-[#CC0000] bg-[#CC0000]/5 text-[#CC0000]"
                      : "border-[#E7E7EC] text-[#6B6B76] hover:border-[#CC0000]/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Fallback Timezone</Label>
            <p className="text-xs text-[#6B6B76] mb-1.5">Used only when the lead has no timezone and the area code is unknown.</p>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#E7E7EC] p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Enforce The Window</p>
              <p className="text-xs text-[#6B6B76]">
                On, the dialer refuses the call. Off, it warns and still logs the attempt.
              </p>
            </div>
            <Switch checked={enforce} onCheckedChange={setEnforce} />
          </div>

          <div className="flex items-center gap-3">
            <Button
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              onClick={() => save.mutate()}
              disabled={save.isPending || days.length === 0}
            >
              Save Calling Window
            </Button>
            <span className="text-xs text-[#6B6B76]">
              {days.length === 0
                ? "Pick at least one calling day."
                : `${formatMinute(inputToMinute(start, 480))} – ${formatMinute(inputToMinute(end, 1260))} local`}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-[#CC0000]" />
            <p className="text-sm font-medium">Recent Blocked Attempts</p>
          </div>
          {!blocks || blocks.length === 0 ? (
            <p className="text-sm text-[#6B6B76]">
              No calls have been stopped by the window yet.
            </p>
          ) : (
            <div className="space-y-2">
              {blocks.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-[#E7E7EC] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{b.phone ? formatPhone(b.phone) : "Unknown number"}</span>
                    <Badge variant="outline" className="text-xs">
                      {b.local_time} {timezoneLabel(b.lead_timezone)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {String(b.reason).replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#6B6B76]">
                    Timezone from {String(b.timezone_source).replace(/_/g, " ")} ·{" "}
                    {new Date(b.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
