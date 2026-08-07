import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { CallBanner, type CallMode } from "@/components/back-office/CallBanner";
import { LiveAssistPanel, type AssistLine } from "@/components/back-office/LiveAssistPanel";
import { EmptyState, Panel, StatusPill } from "@/components/back-office/ui";
import {
  AudioLines, Check, CreditCard, Megaphone, PhoneOff, PhoneOutgoing,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DISCLOSURE, disclosureStatus, isDisclosureRequired } from "@/lib/compliance";
import { logDisclosure, shouldBlockLiveSurface } from "@/lib/disclosure";

export const Route = createFileRoute("/_authenticated/dialer")({
  head: () => ({
    meta: [
      { title: "Live Dialer — Master Closer" },
      { name: "description", content: "Outbound dialing with disclosure-gated call flow across AI, Hybrid, and Copilot modes." },
      { property: "og:title", content: "Live Dialer — Master Closer" },
      { property: "og:description", content: "Outbound dialing with disclosure-gated call flow across AI, Hybrid, and Copilot modes." },
    ],
  }),
  component: DialerPage,
});

type Mode = CallMode;

const WHISPERS = [
  "Say: When you say it's a lot, is it the total or the monthly that gives you pause?",
  "Say: If both options cost the same, which one would you choose — and why?",
];

const AGENT_LINE: Record<Mode, string> = {
  full_ai: "Totally fair on price. If I lock today's rate and email the agreement now, are you good to start?",
  hybrid: "Warm lead, budget confirmed, one price objection left. Transferring you in — take the close.",
  copilot: WHISPERS[0],
};

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

function DialerPage() {
  const [mode, setMode] = useState<Mode>("full_ai");
  const [phone, setPhone] = useState("+1 555 0142");
  const [jurisdiction, setJurisdiction] = useState("FL");
  const [connected, setConnected] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<AssistLine[]>([]);
  const [delivered, setDelivered] = useState(false);
  const [preConnectPlaying, setPreConnectPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (connected) {
      setElapsed(0);
      tick.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
    };
  }, [connected]);

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
      await logDisclosure({ callId, jurisdiction, line: script, method: "rep_delivered_disclosure" });
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

  const closeProbability = connected ? (mode === "full_ai" ? 68 : mode === "hybrid" ? 74 : 61) : 0;

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Live cockpit with your copilot and mode control."
        tabs={TAB_GROUPS.calls}
      />

      {connected && (
        <CallBanner
          name="Outbound Prospect"
          phone={phone}
          campaign={settings?.default_jurisdiction ? `Jurisdiction ${jurisdiction}` : "Direct Dial"}
          timer={fmt(elapsed)}
          mode={mode}
          onModeChange={setMode}
          onEnd={endCall}
          muted={muted}
          onToggleMute={() => setMuted((v) => !v)}
          onHold={() => toast.info("Call On Hold.")}
          onMerge={() => toast.info("Merge Requested.")}
          onTransfer={() => toast.info("Transferring To A Human Closer.")}
        />
      )}

      <div className="cockpit">
        <div className="mc-card cockpit-main">
          <div className="card-head">
            <h3 className="font-display card-h">{connected ? "Lead Information" : "Call Setup"}</h3>
            <StatusPill
              label={connected ? "On Call" : "Idle"}
              tone={connected ? "green" : "neutral"}
            />
          </div>

          {!connected ? (
            <>
              <div className="lead-grid">
                <div className="lead-field">
                  <span className="lead-k">Phone Number</span>
                  <input
                    className="font-num"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit" }}
                  />
                </div>
                <div className="lead-field">
                  <span className="lead-k">Mode</span>
                  <div className="tabs" style={{ padding: 3 }}>
                    {(["full_ai", "hybrid", "copilot"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={"tab " + (mode === m ? "tab-on" : "")}
                        onClick={() => setMode(m)}
                      >
                        {m === "full_ai" ? "AI" : m === "hybrid" ? "Hybrid" : "Copilot"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lead-field">
                  <span className="lead-k">Jurisdiction</span>
                  <input
                    className="font-num"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value.toUpperCase().slice(0, 2))}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit", width: 90, textTransform: "uppercase" }}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    Disclosure{" "}
                    <strong style={{ color: required ? "var(--signal)" : "var(--ink)" }}>
                      {disclosureStatus(jurisdiction)}
                    </strong>{" "}
                    Here.
                  </span>
                </div>
              </div>

              <button type="button" className="btn-primary" onClick={startCall} disabled={busy}>
                <PhoneOutgoing size={15} strokeWidth={2.2} /> Start Call
              </button>

              {preConnectPlaying && (
                <div className="sugg" style={{ marginTop: 16 }}>
                  <div className="sugg-head">
                    <AudioLines size={13} strokeWidth={2.5} />
                    <span>Playing Pre-Connect Audio</span>
                  </div>
                  <p>{script}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="lead-grid">
                {[
                  ["Phone", phone],
                  ["Mode", mode === "full_ai" ? "AI" : mode === "hybrid" ? "Hybrid" : "Copilot"],
                  ["Jurisdiction", jurisdiction],
                  ["Disclosure", disclosureStatus(jurisdiction)],
                  ["Consent Log", delivered ? "Written" : "Pending"],
                  ["Call Timer", fmt(elapsed)],
                ].map(([k, v]) => (
                  <div key={k} className="lead-field">
                    <span className="lead-k">{k}</span>
                    <span className="lead-v font-num">{v}</span>
                  </div>
                ))}
              </div>

              <div className="prob">
                <div className="prob-top">
                  <span>CLOSE PROBABILITY</span>
                  <span className="font-num prob-num">{closeProbability}%</span>
                </div>
                <div className="prob-track">
                  <div className="prob-fill" style={{ width: `${closeProbability}%` }} />
                </div>
              </div>

              {mode === "copilot" && !delivered && (
                <div className="sugg" style={{ marginBottom: 16 }}>
                  <div className="sugg-head">
                    <Megaphone size={13} strokeWidth={2.5} />
                    <span>Read Disclosure</span>
                  </div>
                  <p>“{script}”</p>
                  <p className="muted" style={{ fontSize: 12, fontWeight: 400, marginTop: 8 }}>
                    {required
                      ? "Required in this state. The transcript and suggestions unlock once you tap Delivered."
                      : "Optional in this state. Deliver it if you want it on the record."}
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={markDelivered}
                    disabled={busy}
                  >
                    <Check size={15} strokeWidth={2.3} /> Delivered
                  </button>
                </div>
              )}

              <div className="collect">
                <div>
                  <div className="collect-h font-display">Ready To Close</div>
                  <div className="collect-s">
                    Send the agreement and payment link without leaving the call.
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={() => toast.success("Agreement Sent.")}>
                  <CreditCard size={15} strokeWidth={2.2} /> Send Agreement
                </button>
              </div>

              <button
                type="button"
                className="tab"
                style={{ marginTop: 12, alignSelf: "flex-start", color: "var(--signal)", fontWeight: 600 }}
                onClick={endCall}
              >
                <PhoneOff size={13} style={{ display: "inline", marginRight: 6 }} /> End Call
              </button>
            </>
          )}
        </div>

        {connected ? (
          <LiveAssistPanel
            mode={mode}
            lines={transcript}
            suggestions={blocked ? [] : [AGENT_LINE[mode]]}
            jurisdiction={jurisdiction}
            delivered={delivered}
            locked={blocked}
          />
        ) : (
          <Panel title="Live Assist">
            <EmptyState
              icon={PhoneOutgoing}
              title="No Active Call"
              hint="Start a call to see the live transcript, consent state, and copilot suggestions."
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
