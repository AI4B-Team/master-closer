import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { CallBanner, type CallMode } from "@/components/back-office/CallBanner";
import { LiveAssistPanel, type AssistLine } from "@/components/back-office/LiveAssistPanel";
import { EmptyState, Panel, StatusPill } from "@/components/back-office/ui";
import {
  AudioLines, Ban, Check, CreditCard, Megaphone, PhoneOff, PhoneOutgoing, SkipForward,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { emitOrgEvent } from "@/lib/hub.functions";
import { closeObjection } from "@/lib/demo.functions";
import { summarizeCall } from "@/lib/calls.functions";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DISCLOSURE, disclosureStatus, isDisclosureRequired } from "@/lib/compliance";
import { logDisclosure, shouldBlockLiveSurface } from "@/lib/disclosure";
import { SIM_RING_MS, SIM_SCRIPT } from "@/lib/simulation";
import { applyMerge, DEFAULT_AGREEMENT_BODY, signingUrl } from "@/lib/agreements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchObjectionLibrary } from "@/lib/objections";



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

const MODE_KEY: Record<Mode, string> = { full_ai: "ai", hybrid: "hybrid", copilot: "copilot" };


type DialOutcome = "connected" | "no_answer" | "voicemail" | "busy" | "failed" | "dnc";

const DISPOSITIONS: { value: DialOutcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No Answer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "busy", label: "Busy" },
  { value: "failed", label: "Failed" },
];

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
  const [campaignId, setCampaignId] = useState<string>("");
  const [contact, setContact] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [suggestionRowId, setSuggestionRowId] = useState<string | null>(null);
  const [lineUsed, setLineUsed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [simulate, setSimulate] = useState(true);
  const [dialing, setDialing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeValue, setMergeValue] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [wrap, setWrap] = useState<{
    callId: string;
    prospect: string;
    disposition: string;
    summary: string;
    nextStep: string;
    sentiment: string | null;
    lines: AssistLine[];
    loading: boolean;
    task: boolean;
    dueDays: number;
  } | null>(null);
  const summarize = useServerFn(summarizeCall);

  const holdRef = useRef(false);
  holdRef.current = holding;


  const qc = useQueryClient();
  const emit = useServerFn(emitOrgEvent);
  const askCloser = useServerFn(closeObjection);

  const [sendingAgreement, setSendingAgreement] = useState(false);

  /** Creates a real agreement from the default template for the person on the line and copies the signing link. */
  const sendAgreement = async () => {
    setSendingAgreement(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id, full_name, email").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      const { data: tpl } = await supabase
        .from("agreement_templates")
        .select("id, body, file_path, file_name")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      const signer = contact?.name ?? "The Prospect";
      const body = applyMerge(tpl?.body || DEFAULT_AGREEMENT_BODY, {
        lead_name: signer,
        phone: contact?.phone ?? phone,
        amount: "2,500",
        deposit: "1,250",
        currency: "USD",
        rep_name: prof.full_name ?? prof.email ?? "Your Closer",
        org_name: "Master Closer",
        date: new Date().toLocaleDateString(),
      });

      const { data: row, error } = await supabase
        .from("agreements")
        .insert({
          org_id: prof.org_id,
          template_id: tpl?.id ?? null,
          call_id: callId,
          title: `${signer} — Agreement`,
          body,
          file_path: tpl?.file_path ?? null,
          file_name: tpl?.file_name ?? null,
          amount: 2500,
          status: "sent",
          sent_at: new Date().toISOString(),
          signer_name: signer,
        })
        .select("id, token")
        .single();
      if (error) throw error;

      await supabase.from("agreement_events").insert({
        agreement_id: row.id,
        org_id: prof.org_id,
        event_type: "sent",
        meta: { from: "dialer", call_id: callId },
      });
      await navigator.clipboard.writeText(signingUrl(row.token)).catch(() => {});
      toast.success("Agreement Sent. Signing link copied to your clipboard.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create the agreement.");
    } finally {
      setSendingAgreement(false);
    }
  };

  /** Active AI closers available to run this call. */
  const { data: agents } = useQuery({
    queryKey: ["dialer-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, name, industry, default_mode, system_prompt, transfer_to, active")
        .eq("active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const agent = (agents ?? []).find((a: any) => a.id === agentId);

  /** Selecting an agent adopts its default mode and its human transfer target. */
  const pickAgent = (id: string) => {
    setAgentId(id);
    const a = (agents ?? []).find((x: any) => x.id === id);
    if (a?.default_mode) setMode(a.default_mode as Mode);
    if (a?.transfer_to) setTransferTo(a.transfer_to);
  };


  /** Persist a transcript line and get the next best response from the AI gateway. */
  const runAssist = async (prospectLine: string, id?: string | null) => {
    const activeCall = id ?? callId;
    setThinking(true);
    setTranscript((t) => [...t, { speaker: "Prospect", text: prospectLine }]);
    try {
      if (activeCall) {
        await supabase.from("transcript_segments").insert({
          call_id: activeCall,
          speaker: "Prospect",
          text: prospectLine,
          ts_sec: elapsed,
        });
      }
      const res = await askCloser({
        data: {
          prospect: prospectLine,
          mode: MODE_KEY[mode],
          agentName: agent?.name ?? null,
          industry: agent?.industry ?? null,
          systemPrompt: agent?.system_prompt ?? null,
          library: await fetchObjectionLibrary(),
        },
      });
      setAiConfidence(res.confidence);
      setSuggestions([res.line]);
      setSuggestionRowId(null);
      setLineUsed(mode === "full_ai");
      if (mode === "full_ai") {
        setTranscript((t) => [...t, { speaker: "Master Closer", text: res.line }]);
      }
      if (activeCall) {
        const { data: sugg } = await supabase
          .from("suggestions")
          .insert({
            call_id: activeCall,
            objection: res.objection,
            line: res.line,
            ts_sec: elapsed,
            was_used: mode === "full_ai",
          })
          .select("id")
          .maybeSingle();
        if (sugg?.id) setSuggestionRowId(sugg.id);
        if (mode === "full_ai") {
          await supabase.from("transcript_segments").insert({
            call_id: activeCall,
            speaker: "Master Closer",
            text: res.line,
            ts_sec: elapsed,
          });
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Copilot Is Unavailable.");
    } finally {
      setThinking(false);
    }
  };

  /** The rep delivered the suggested line — log it so the Playbook learns what works. */
  const useSuggestedLine = async (line: string) => {
    if (lineUsed) return;
    setLineUsed(true);
    setTranscript((t) => [...t, { speaker: "You", text: line }]);
    try {
      if (suggestionRowId) {
        await supabase.from("suggestions").update({ was_used: true }).eq("id", suggestionRowId);
      }
      if (callId) {
        await supabase.from("transcript_segments").insert({
          call_id: callId,
          speaker: "You",
          text: line,
          ts_sec: elapsed,
        });
      }
      toast.success("Logged. That Line Counts Toward Your Playbook Stats.");
    } catch {
      /* non-blocking */
    }
  };


  const { data: campaigns } = useQuery({
    queryKey: ["dialer-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, mode, status, list_id, agent_id")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const campaign = (campaigns ?? []).find((c: any) => c.id === campaignId);

  /** Queue rule: lowest attempts first, skipping opt-outs and anything on the Do Not Call list. */
  const loadNext = async (id: string) => {
    const c = (campaigns ?? []).find((x: any) => x.id === id);
    if (!c?.list_id) {
      setContact(null);
      return;
    }
    const [{ data }, { data: dncRows }] = await Promise.all([
      supabase
        .from("list_contacts")
        .select("id, name, phone, last_outcome, consent")
        .eq("list_id", c.list_id)
        .neq("last_outcome", "dnc")
        .neq("consent", "opt_out")
        .order("attempts", { ascending: true })
        .limit(50),
      supabase.from("dnc_list").select("phone"),
    ]);
    const onlyDigits = (p?: string | null) => (p ?? "").replace(/\D/g, "");
    const blocked = new Set((dncRows ?? []).map((d: any) => onlyDigits(d.phone)).filter(Boolean));
    const eligible = (data ?? []).filter((row: any) => !blocked.has(onlyDigits(row.phone)));
    const skipped = (data ?? []).length - eligible.length;
    const next = eligible[0];
    if (next) {
      setContact({ id: next.id, name: next.name, phone: next.phone });
      setPhone(next.phone);
      if (skipped > 0) toast.info(`${skipped} Contact${skipped === 1 ? "" : "s"} Skipped — Do Not Call.`);
    } else {
      setContact(null);
      toast.info(skipped > 0 ? "Remaining Contacts Are On The Do Not Call List." : "Queue Is Empty.");
    }
  };


  const pickCampaign = async (id: string) => {
    setCampaignId(id);
    const c = (campaigns ?? []).find((x: any) => x.id === id);
    if (c?.agent_id) pickAgent(c.agent_id);
    if (c?.mode) setMode(c.mode as Mode);
    await loadNext(id);
  };

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
      // Hold freezes billable talk time until the rep resumes the line.
      tick.current = setInterval(() => setElapsed((s) => (holdRef.current ? s : s + 1)), 1000);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
    };
  }, [connected]);

  // Simulation: feed scripted prospect lines through the real assist pipeline.
  const assistRef = useRef(runAssist);
  assistRef.current = runAssist;

  useEffect(() => {
    if (!connected || !simulate) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const fire = (text: string) => {
      // While the prospect is on hold nothing is heard — retry once the line resumes.
      if (holdRef.current) {
        timers.push(setTimeout(() => fire(text), 1500));
        return;
      }
      void assistRef.current(text);
    };
    SIM_SCRIPT.forEach((s) => timers.push(setTimeout(() => fire(s.text), s.at * 1000)));
    return () => timers.forEach(clearTimeout);
  }, [connected, simulate, callId]);



  const required = isDisclosureRequired(jurisdiction);
  const blocked = mode === "copilot" && shouldBlockLiveSurface(jurisdiction, delivered);

  const startCall = async () => {
    setBusy(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");

      // Simulated ring cadence stands in for the carrier until credentials are live.
      if (simulate) {
        setDialing(true);
        await new Promise((r) => setTimeout(r, SIM_RING_MS));
        setDialing(false);
      }



      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          org_id: prof.org_id,
          mode,
          outcome: "in_progress",
          campaign_id: campaignId || null,
          list_contact_id: contact?.id ?? null,
          agent_id: agentId || null,
        })
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
      setSuggestions([]);
      setAiConfidence(null);

      if ((mode === "full_ai" || mode === "hybrid") && spokenAtOpen) {
        setTranscript([{ speaker: "Master Closer", text: script, tone: "disclosure" }]);
        await logDisclosure({
          callId: call.id,
          jurisdiction,
          line: script,
          method: "pre_call_disclosure",
        });
        await supabase.from("transcript_segments").insert({
          call_id: call.id,
          speaker: "Master Closer",
          text: script,
          ts_sec: 0,
        });
        setDelivered(true);
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

  /** Writes a control event onto the live transcript and persists it with the call record. */
  const logSystem = async (text: string) => {
    setTranscript((t) => [...t, { speaker: "System", text }]);
    if (callId) {
      await supabase
        .from("transcript_segments")
        .insert({ call_id: callId, speaker: "System", text, ts_sec: elapsed });
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await logSystem(next ? "Rep microphone muted." : "Rep microphone unmuted.");
  };

  const toggleHold = async () => {
    const next = !holding;
    setHolding(next);
    await logSystem(next ? "Prospect placed on hold." : "Call resumed from hold.");
    toast.info(next ? "Call On Hold." : "Call Resumed.");
  };

  /** Teammates available as merge or transfer targets in this workspace. */
  const { data: teammates } = useQuery({
    queryKey: ["dialer-teammates"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").limit(50);
      return data ?? [];
    },
  });

  const teammateLabel = (id: string) => {
    const t = (teammates ?? []).find((p: any) => p.id === id);
    return t?.full_name || t?.email || "Teammate";
  };

  const confirmMerge = async () => {
    const target = mergeValue.trim();
    if (!target) return;
    const label = (teammates ?? []).some((p: any) => p.id === target) ? teammateLabel(target) : target;
    setParticipants((p) => (p.includes(label) ? p : [...p, label]));
    setMergeOpen(false);
    setMergeValue("");
    await logSystem(`${label} merged into the call.`);
    if (callId) {
      try {
        await emit({ data: { event_type: "call.merged", payload: { call_id: callId, participant: label } } });
      } catch {
        // Hub delivery is best-effort.
      }
    }
    toast.success(`${label} Joined The Call.`);
  };

  const confirmTransfer = async () => {
    if (!transferTo) return;
    const label = teammateLabel(transferTo);
    setTransferOpen(false);
    setMode("hybrid");
    setHolding(false);
    setMuted(true);
    await logSystem(`Call transferred to ${label}. AI briefing handed over.`);
    if (callId) {
      await supabase.from("calls").update({ mode: "hybrid" }).eq("id", callId);
      try {
        await emit({ data: { event_type: "call.transferred", payload: { call_id: callId, to: label } } });
      } catch {
        // Hub delivery is best-effort.
      }
    }
    toast.success(`Transferred To ${label}.`);
  };



  const endCall = async (dial: DialOutcome = "connected", disposition?: string) => {
    if (callId) {
      await supabase
        .from("calls")
        .update({
          outcome: "completed",
          dial_outcome: dial,
          disposition: disposition ?? DISPOSITIONS.find((d) => d.value === dial)?.label ?? null,
          duration_sec: elapsed,
          close_probability: closeProbability,
          ended_at: new Date().toISOString(),
        })
        .eq("id", callId);

      if (contact) {
        const { data: row } = await supabase
          .from("list_contacts")
          .select("attempts")
          .eq("id", contact.id)
          .maybeSingle();
        await supabase
          .from("list_contacts")
          .update({ attempts: (row?.attempts ?? 0) + 1, last_outcome: dial })
          .eq("id", contact.id);
      }

      try {
        await emit({
          data: {
            event_type: "call.completed",
            payload: { call_id: callId, mode, dial_outcome: dial, campaign_id: campaignId || null },
          },
        });
      } catch {
        // Never block wrap-up on hub availability.
      }
    }

    const endedCallId = callId;
    const endedLines = transcript;
    const label = disposition ?? DISPOSITIONS.find((d) => d.value === dial)?.label ?? "Completed";
    const prospectName = contact?.name ?? "Outbound Prospect";

    setConnected(false);
    setCallId(null);
    setTranscript([]);
    setDelivered(false);
    setElapsed(0);
    setHolding(false);
    setMuted(false);
    setParticipants([]);

    qc.invalidateQueries({ queryKey: ["calls"] });

    if (endedCallId && dial !== "dnc") {
      setWrap({
        callId: endedCallId,
        prospect: prospectName,
        disposition: label,
        summary: "",
        nextStep: "",
        sentiment: null,
        lines: endedLines,
        loading: true,
        task: true,
        dueDays: 2,
      });
      try {
        const res: any = await summarize({
          data: {
            mode,
            outcome: label,
            prospect: prospectName,
            lines: endedLines.map((l) => ({ speaker: l.speaker, text: l.text })),
          },
        });
        setWrap((w) =>
          w && w.callId === endedCallId
            ? {
                ...w,
                loading: false,
                summary: res?.summary ?? "",
                nextStep: res?.next_step ?? "",
                sentiment: res?.sentiment ?? null,
              }
            : w,
        );
      } catch {
        setWrap((w) => (w && w.callId === endedCallId ? { ...w, loading: false } : w));
      }
    }

    if (campaignId) await loadNext(campaignId);
  };

  const saveWrap = async () => {
    if (!wrap) return;
    setBusy(true);
    try {
      await supabase.from("calls").update({ summary: wrap.summary || null }).eq("id", wrap.callId);

      if (wrap.task && wrap.nextStep.trim()) {
        const { data: prof } = await supabase.from("profiles").select("id, org_id").maybeSingle();
        if (prof) {
          const due = new Date();
          due.setDate(due.getDate() + wrap.dueDays);
          await supabase.from("tasks").insert({
            org_id: prof.org_id,
            title: wrap.nextStep.trim().slice(0, 200),
            notes: wrap.summary || null,
            due_at: due.toISOString(),
            priority: "medium",
            status: "open",
            assignee_id: prof.id,
            created_by: prof.id,
            call_id: wrap.callId,
          });
          qc.invalidateQueries({ queryKey: ["tasks"] });
        }
      }

      toast.success(wrap.task && wrap.nextStep.trim() ? "Wrap-Up Saved And Follow-Up Created." : "Wrap-Up Saved.");
      setWrap(null);
      qc.invalidateQueries({ queryKey: ["calls"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };


  const flagDnc = async () => {
    setBusy(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      await supabase.from("dnc_list").insert({ org_id: prof.org_id, phone, reason: "Requested on call" });
      try {
        await emit({ data: { event_type: "lead.flagged_dnc", payload: { phone, call_id: callId } } });
      } catch {
        // Hub delivery is best-effort.
      }
      toast.success("Added To Do Not Call.");
      await endCall("dnc", "Do Not Call");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const closeProbability = !connected
    ? 0
    : (aiConfidence ?? (mode === "full_ai" ? 68 : mode === "hybrid" ? 74 : 61));


  return (
    <div>
      <PageHeader
        title="Calls"
        description="Live cockpit with your copilot and mode control."
        tabs={TAB_GROUPS.calls}
      />

      {connected && (
        <CallBanner
          name={contact?.name ?? "Outbound Prospect"}
          phone={phone}
          campaign={campaign?.name ?? "Direct Dial"}
          timer={fmt(elapsed)}
          mode={mode}
          onModeChange={setMode}
          onEnd={() => endCall("connected")}
          muted={muted}
          onToggleMute={toggleMute}
          onHold={toggleHold}
          holding={holding}
          participants={participants}
          onMerge={() => setMergeOpen(true)}
          onTransfer={() => setTransferOpen(true)}

        />
      )}

      <div className="cockpit">
        <div className="mc-card cockpit-main">
          <div className="card-head">
            <h3 className="font-display card-h">{connected ? "Lead Information" : "Call Setup"}</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {simulate && <StatusPill label="Simulation" tone="amber" />}
              <StatusPill
                label={dialing ? "Dialing" : connected ? "On Call" : "Idle"}
                tone={connected ? "green" : "neutral"}
              />
            </div>

          </div>

          {!connected ? (
            <>
              <div className="lead-grid">
                <div className="lead-field">
                  <span className="lead-k">Campaign Queue</span>
                  <select
                    value={campaignId}
                    onChange={(e) => pickCampaign(e.target.value)}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit" }}
                  >
                    <option value="">Direct Dial</option>
                    {(campaigns ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {campaign
                      ? contact
                        ? `Next: ${contact.name}`
                        : "Queue empty — attach a list to this campaign."
                      : "No campaign — dial the number below."}
                  </span>
                </div>
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
                  <span className="lead-k">AI Closer</span>
                  <select
                    value={agentId}
                    onChange={(e) => pickAgent(e.target.value)}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit" }}
                  >
                    <option value="">Default Closer</option>
                    {(agents ?? []).map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {agent
                      ? `${agent.industry || "General"} · ${agent.transfer_to ? `Transfers to ${teammateLabel(agent.transfer_to)}` : "No transfer target set"}`
                      : "Uses the generic Master Closer brief."}
                  </span>
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
                <div className="lead-field">
                  <span className="lead-k">Simulation</span>
                  <div className="tabs" style={{ padding: 3 }}>
                    <button
                      type="button"
                      className={"tab " + (simulate ? "tab-on" : "")}
                      onClick={() => setSimulate(true)}
                    >
                      Simulated Call
                    </button>
                    <button
                      type="button"
                      className={"tab " + (!simulate ? "tab-on" : "")}
                      onClick={() => setSimulate(false)}
                    >
                      Live Carrier
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {simulate
                      ? "A scripted prospect answers and objects — the AI responses are real."
                      : "Requires telephony credentials. Nothing will dial until they are connected."}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" className="btn-primary" onClick={startCall} disabled={busy}>
                  <PhoneOutgoing size={15} strokeWidth={2.2} />{" "}
                  {dialing ? "Dialing…" : simulate ? "Start Simulated Call" : "Start Call"}
                </button>
                {campaign && contact && (
                  <button type="button" className="tab" onClick={() => loadNext(campaignId)}>
                    <SkipForward size={13} style={{ display: "inline", marginRight: 6 }} /> Skip Contact
                  </button>
                )}
              </div>

              {dialing && (
                <div className="sugg" style={{ marginTop: 16 }}>
                  <div className="sugg-head">
                    <PhoneOutgoing size={13} strokeWidth={2.5} />
                    <span>Ringing {phone}</span>
                  </div>
                  <p>Waiting for the prospect to pick up.</p>
                </div>
              )}



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
                  <div className="collect-s" style={{ whiteSpace: "nowrap" }}>
                    Send the agreement and payment link without leaving the call.
                  </div>

                </div>
                <button type="button" className="btn-primary" onClick={sendAgreement} disabled={sendingAgreement}>
                  <CreditCard size={15} strokeWidth={2.2} /> Send Agreement
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="lead-k" style={{ marginBottom: 8 }}>Wrap Up — Disposition</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {DISPOSITIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className="tab"
                      style={{ fontWeight: 600 }}
                      disabled={busy}
                      onClick={() => endCall(d.value)}
                    >
                      <PhoneOff size={13} style={{ display: "inline", marginRight: 6 }} /> {d.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="tab"
                    style={{ color: "var(--signal)", fontWeight: 600 }}
                    disabled={busy}
                    onClick={flagDnc}
                  >
                    <Ban size={13} style={{ display: "inline", marginRight: 6 }} /> Do Not Call
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {connected ? (
          <LiveAssistPanel
            mode={mode}
            lines={transcript}
            suggestions={blocked ? [] : suggestions}
            jurisdiction={jurisdiction}
            delivered={delivered}
            locked={blocked}
            thinking={thinking}
            onAsk={(line) => runAssist(line)}
            onUseLine={(line) => void useSuggestedLine(line)}
            usedLine={lineUsed}
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

      <Dialog open={!!wrap} onOpenChange={(o) => !o && setWrap(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Call Wrap-Up</DialogTitle>
          </DialogHeader>
          {wrap && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[#6B6B76]">
                <span className="font-semibold text-[#111]">{wrap.prospect}</span>
                <span>·</span>
                <span>{wrap.disposition}</span>
                {wrap.sentiment && <StatusPill label={wrap.sentiment} tone={wrap.sentiment === "Hot" ? "green" : "amber"} />}
              </div>

              <div>
                <div className="lead-k" style={{ marginBottom: 6 }}>Summary</div>
                <textarea
                  value={wrap.loading ? "Writing the summary…" : wrap.summary}
                  readOnly={wrap.loading}
                  onChange={(e) => setWrap({ ...wrap, summary: e.target.value })}
                  rows={5}
                  style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: 10, font: "inherit" }}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wrap.task}
                  onChange={(e) => setWrap({ ...wrap, task: e.target.checked })}
                />
                Create A Follow-Up Task
              </label>

              {wrap.task && (
                <div className="space-y-2">
                  <Input
                    placeholder="Next step"
                    value={wrap.nextStep}
                    onChange={(e) => setWrap({ ...wrap, nextStep: e.target.value })}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 5, 7].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="tab"
                        style={{ fontWeight: 600, borderColor: wrap.dueDays === d ? "var(--signal)" : undefined }}
                        onClick={() => setWrap({ ...wrap, dueDays: d })}
                      >
                        In {d} {d === 1 ? "Day" : "Days"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" className="flex-1" onClick={saveWrap} disabled={busy || wrap.loading}>
                  Save Wrap-Up
                </Button>
                <Button type="button" variant="outline" onClick={() => setWrap(null)} disabled={busy}>
                  Skip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Another Line</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={mergeValue} onValueChange={setMergeValue}>
              <SelectTrigger><SelectValue placeholder="Pick a teammate" /></SelectTrigger>
              <SelectContent>
                {(teammates ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Or type a phone number"
              value={mergeValue.includes("-") ? "" : mergeValue}
              onChange={(e) => setMergeValue(e.target.value)}
            />
            <Button type="button" className="w-full" onClick={confirmMerge} disabled={!mergeValue.trim()}>
              Merge Into Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer This Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger><SelectValue placeholder="Pick a closer" /></SelectTrigger>
              <SelectContent>
                {(teammates ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-[#6B6B76]">
              The call switches to Hybrid and the AI hands its briefing to the closer.
            </p>
            <Button type="button" className="w-full" onClick={confirmTransfer} disabled={!transferTo}>
              Transfer Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
