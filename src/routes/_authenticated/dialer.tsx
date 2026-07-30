import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/back-office/AppShell";
import {
  PhoneOutgoing, PhoneOff, Bot, Megaphone, Lock, Check, Sparkles, AudioLines,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DISCLOSURE, disclosureStatus, isDisclosureRequired } from "@/lib/compliance";
import { logDisclosure, shouldBlockLiveSurface } from "@/lib/disclosure";

export const Route = createFileRoute("/_authenticated/dialer")({
  head: () => ({
    meta: [
      { title: "Dialer — Master Closer" },
      { name: "description", content: "Outbound dialing with disclosure-gated call flow across AI, Hybrid, and Copilot modes." },
      { property: "og:title", content: "Dialer — Master Closer" },
      { property: "og:description", content: "Outbound dialing with disclosure-gated call flow across AI, Hybrid, and Copilot modes." },
    ],
  }),
  component: DialerPage,
});

type Mode = "full_ai" | "hybrid" | "copilot";
type Line = { speaker: string; text: string; tone?: "disclosure" | "normal" };

const MODE_LABEL: Record<Mode, string> = {
  full_ai: "AI",
  hybrid: "Hybrid",
  copilot: "Copilot",
};

const WHISPERS = [
  "Say: When you say it's a lot, is it the total or the monthly that gives you pause?",
  "Say: If both options cost the same, which one would you choose — and why?",
];

function DialerPage() {
  const [mode, setMode] = useState<Mode>("full_ai");
  const [phone, setPhone] = useState("+1 555 0142");
  const [jurisdiction, setJurisdiction] = useState("FL");
  const [connected, setConnected] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Line[]>([]);
  const [delivered, setDelivered] = useState(false);
  const [preConnectPlaying, setPreConnectPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery({
    queryKey: ["disclosure_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("disclosure_settings").select("*").maybeSingle();
      return data;
    },
  });

  const script = settings?.script ?? DEFAULT_DISCLOSURE;
  const preConnectOn = settings?.outbound_pre_connect_audio ?? true;
  const spokenAtOpen = settings?.spoken_at_call_open ?? true;

  useEffect(() => {
    if (settings?.default_jurisdiction && !connected) setJurisdiction(settings.default_jurisdiction);
  }, [settings, connected]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const required = isDisclosureRequired(jurisdiction);
  const blocked = mode === "copilot" && shouldBlockLiveSurface(jurisdiction, delivered);

  const startCall = async () => {
    setBusy(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");

      const { data: call, error } = await supabase
        .from("calls")
        .insert({ org_id: prof.org_id, mode, outcome: "in_progress" })
        .select("id")
        .single();
      if (error) throw error;

      // Outbound pre-connect audio: plays and logs BEFORE the conversation proceeds.
      if (preConnectOn) {
        setPreConnectPlaying(true);
        await logDisclosure({
          callId: call.id,
          jurisdiction,
          line: script,
          method: "outbound_pre_connect_audio",
        });
        await new Promise((r) => setTimeout(r, 900));
        setPreConnectPlaying(false);
      }

      setCallId(call.id);
      setConnected(true);
      setDelivered(false);
      setTranscript([]);

      if (mode === "full_ai" || mode === "hybrid") {
        // The agent speaks the disclosure as its first utterance.
        if (spokenAtOpen) {
          setTranscript([{ speaker: "Master Closer", text: script, tone: "disclosure" }]);
          await logDisclosure({
            callId: call.id,
            jurisdiction,
            line: script,
            method: "pre_call_disclosure",
          });
          setDelivered(true);
        }
        setTimeout(() => {
          setTranscript((t) => [
            ...t,
            { speaker: "Prospect", text: "Honestly, your competitor is cheaper." },
            {
              speaker: "Master Closer",
              text: "That's helpful to know. If both options cost exactly the same, which one would you choose — and why?",
            },
          ]);
        }, 1200);
      } else {
        // Copilot: rep delivers. In Required states the live surface stays hidden.
        setTranscript([
          { speaker: "Prospect", text: "Hey — who's this?" },
          { speaker: "Prospect", text: "I need to think about it, the price is a lot." },
        ]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const markDelivered = async () => {
    setBusy(true);
    try {
      await logDisclosure({
        callId,
        jurisdiction,
        line: script,
        method: "rep_delivered_disclosure",
      });
      setDelivered(true);
      toast.success("Disclosure Logged.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const endCall = async () => {
    if (callId) {
      await supabase
        .from("calls")
        .update({ outcome: "completed", ended_at: new Date().toISOString() })
        .eq("id", callId);
    }
    setConnected(false);
    setCallId(null);
    setTranscript([]);
    setDelivered(false);
  };

  return (
    <div>
      <PageHeader
        title="Dialer"
        description="Native outbound with autonomy-aware pacing and disclosure guardrails."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Call Setup */}
        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none">
          <h3 className="font-semibold mb-4">Call Setup</h3>
          <div className="space-y-3">
            <div>
              <Label>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={connected}
                className="mt-1.5 rounded-xl font-mono"
              />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)} disabled={connected}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_ai">AI</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="copilot">Copilot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jurisdiction</Label>
              <Input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                disabled={connected}
                className="mt-1.5 rounded-xl w-24 font-mono uppercase"
              />
              <p className="text-xs mt-1.5 text-[#6B6B76]">
                Disclosure{" "}
                <span className={required ? "text-[#CC0000] font-medium" : "font-medium"}>
                  {disclosureStatus(jurisdiction)}
                </span>{" "}
                here.
              </p>
            </div>
          </div>

          <div className="mt-5">
            {!connected ? (
              <Button
                onClick={startCall}
                disabled={busy}
                className="w-full bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
              >
                <PhoneOutgoing className="h-4 w-4 mr-1.5" /> Start Call
              </Button>
            ) : (
              <Button onClick={endCall} variant="outline" className="w-full rounded-xl">
                <PhoneOff className="h-4 w-4 mr-1.5" /> End Call
              </Button>
            )}
          </div>

          {preConnectPlaying && (
            <div className="mt-4 flex items-start gap-2 border border-[#CC0000]/30 bg-[#CC0000]/5 rounded-xl p-3">
              <AudioLines className="h-4 w-4 text-[#CC0000] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#CC0000]">Playing Pre-Connect Audio</p>
                <p className="text-xs text-[#6B6B76] mt-0.5">{script}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Live Surface */}
        <Card className="p-6 rounded-2xl border-[#E7E7EC] shadow-none lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Live Call</h3>
            {connected && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{MODE_LABEL[mode]}</Badge>
                {delivered ? (
                  <Badge className="bg-[#0B0B0F] hover:bg-[#0B0B0F] text-white">
                    <Check className="h-3 w-3 mr-1" /> Disclosure Logged
                  </Badge>
                ) : required ? (
                  <Badge className="bg-[#CC0000] hover:bg-[#CC0000] text-white">Disclosure Required</Badge>
                ) : (
                  <Badge variant="secondary">Disclosure Optional</Badge>
                )}
              </div>
            )}
          </div>

          {!connected ? (
            <div className="text-center py-20">
              <PhoneOutgoing className="h-8 w-8 mx-auto text-[#6B6B76] mb-3" />
              <p className="font-medium">No Active Call</p>
              <p className="text-sm text-[#6B6B76] mt-1">
                Start a call to see the transcript and live guidance.
              </p>
            </div>
          ) : (
            <>
              {mode === "copilot" && !delivered && (
                <div className="border border-[#CC0000]/30 bg-[#CC0000]/5 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Megaphone className="h-5 w-5 text-[#CC0000] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#CC0000]">
                        Read Disclosure
                      </p>
                      <p className="text-sm mt-1.5 font-medium">“{script}”</p>
                      <p className="text-xs text-[#6B6B76] mt-2">
                        {required
                          ? "Required in this state. The transcript and suggestions unlock once you tap Delivered."
                          : "Optional in this state. Deliver it if you want it on the record."}
                      </p>
                      <Button
                        onClick={markDelivered}
                        disabled={busy}
                        size="sm"
                        className="mt-3 bg-[#CC0000] hover:bg-[#A30000] rounded-xl"
                      >
                        <Check className="h-4 w-4 mr-1.5" /> Delivered
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {blocked ? (
                <div className="text-center py-16 border border-dashed border-[#E7E7EC] rounded-xl">
                  <Lock className="h-7 w-7 mx-auto text-[#CC0000] mb-3" />
                  <p className="font-medium">Live Surface Locked</p>
                  <p className="text-sm text-[#6B6B76] mt-1 max-w-sm mx-auto">
                    {jurisdiction} is an all-party consent state. Read the disclosure and tap Delivered
                    to reveal the transcript and whisper suggestions.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-[#6B6B76] mb-2">
                      Live Transcript
                    </p>
                    <div ref={scroller} className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {transcript.map((l, i) => (
                        <div
                          key={i}
                          className={`rounded-xl px-3 py-2 border ${
                            l.tone === "disclosure"
                              ? "border-[#CC0000]/30 bg-[#CC0000]/5"
                              : "border-[#E7E7EC] bg-white"
                          }`}
                        >
                          <p className="text-[11px] font-mono uppercase tracking-wider text-[#6B6B76]">
                            {l.speaker}
                            {l.tone === "disclosure" && (
                              <span className="text-[#CC0000]"> · Disclosure</span>
                            )}
                          </p>
                          <p className="text-sm mt-0.5">{l.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-[#6B6B76] mb-2">
                      {mode === "copilot" ? "Next Best Response" : "Agent Activity"}
                    </p>
                    {mode === "copilot" ? (
                      <div className="space-y-2">
                        {WHISPERS.map((w, i) => (
                          <div key={i} className="border border-[#E7E7EC] rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[#CC0000]">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-mono uppercase tracking-wider">
                                Say This Now
                              </span>
                            </div>
                            <p className="text-sm mt-1">{w}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-[#E7E7EC] rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[#CC0000]">
                          <Bot className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-mono uppercase tracking-wider">
                            {mode === "full_ai" ? "Running The Call" : "Qualifying For Transfer"}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          Disclosure delivered as the first utterance and written to the consent log.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
