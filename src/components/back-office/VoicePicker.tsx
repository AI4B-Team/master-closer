import { useRef, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Loader2, Plus, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogDescription, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { previewVoice } from "@/lib/voice.functions";
import { BASE_VOICE_OPTIONS, VOICE_PRESETS } from "@/lib/voices";

type CustomVoice = { id: string; name: string; base_voice: string; style: string | null };

/**
 * Multi-select voice picker with per-voice audio pre-listen and custom voice creation.
 */
export function VoicePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (voices: string[]) => void;
}) {
  const qc = useQueryClient();
  const runPreview = useServerFn(previewVoice);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", base_voice: "alloy", style: "" });

  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: customVoices } = useQuery({
    queryKey: ["custom-voices", wsId],
    enabled: !!wsId,
    queryFn: async (): Promise<CustomVoice[]> => {
      const { data } = await supabase
        .from("custom_voices")
        .select("id, name, base_voice, style")
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const options = [
    ...VOICE_PRESETS.map((v) => ({
      id: v.id, label: v.label, blurb: v.blurb, base: v.base, style: v.style, custom: false,
    })),
    ...(customVoices ?? []).map((v) => ({
      id: `custom:${v.id}`,
      label: v.name,
      blurb: `Custom · ${v.base_voice}`,
      base: v.base_voice,
      style: v.style ?? "",
      custom: true,
    })),
  ];

  const play = async (opt: { id: string; base: string; style: string }) => {
    if (playing) return;
    setPlaying(opt.id);
    try {
      const { audio } = await runPreview({ data: { base: opt.base, style: opt.style } });
      audioRef.current?.pause();
      const el = new Audio(`data:audio/mpeg;base64,${audio}`);
      audioRef.current = el;
      el.onended = () => setPlaying(null);
      await el.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed.");
      setPlaying(null);
    }
  };

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const createVoice = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No profile");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { data, error } = await supabase
        .from("custom_voices")
        .insert({
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
          name: draft.name,
          base_voice: draft.base_voice,
          style: draft.style || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Voice created.");
      qc.invalidateQueries({ queryKey: ["custom-voices"] });
      onChange([...value, `custom:${id}`]);
      setCreateOpen(false);
      setDraft({ name: "", base_voice: "alloy", style: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Voices</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-[#CC0000] hover:text-[#A30000]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Voice
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const on = value.includes(opt.id);
          return (
            <div
              key={opt.id}
              className={
                "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors " +
                (on ? "border-[#CC0000] bg-[#CC0000]/5" : "border-[#E7E7EC]")
              }
            >
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                aria-pressed={on}
                className="flex-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {opt.label}
                  {on && <Check className="h-3.5 w-3.5 text-[#CC0000]" />}
                </span>
                <span className="block text-[11px] text-[#6B6B76]">{opt.blurb}</span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`Preview ${opt.label}`}
                disabled={playing !== null}
                onClick={() => play(opt)}
              >
                {playing === opt.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Play className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#6B6B76] mt-2">
        Pick one or more voices — the first is the primary voice on calls.
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#CC0000]" /> Create New Voice
            </DialogTitle>
            <DialogDescription className="sr-only">Preview and pick the voice your AI closer uses on calls.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Voice Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Sloane — Luxury Closer"
              />
            </div>
            <div>
              <Label>Base Voice</Label>
              <Select value={draft.base_voice} onValueChange={(v) => setDraft({ ...draft, base_voice: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BASE_VOICE_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery Style</Label>
              <Textarea
                rows={3}
                value={draft.style}
                onChange={(e) => setDraft({ ...draft, style: e.target.value })}
                placeholder="Speak slowly and premium, with long confident pauses before the price."
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={playing !== null}
              onClick={() => play({ id: "draft", base: draft.base_voice, style: draft.style })}
            >
              {playing === "draft"
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Play className="h-4 w-4 mr-1" />}
              Pre-Listen
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              disabled={!draft.name || createVoice.isPending}
              onClick={() => createVoice.mutate()}
            >
              Save Voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
