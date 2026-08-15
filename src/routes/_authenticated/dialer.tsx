import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, TAB_GROUPS } from "@/components/back-office/AppShell";
import { CallBanner, type CallMode } from "@/components/back-office/CallBanner";
import { LiveAssistPanel, type AssistLine } from "@/components/back-office/LiveAssistPanel";
import { EmptyState, Panel, StatusPill } from "@/components/back-office/ui";
import {
  AudioLines, Ban, CalendarClock, Check, Clock, CreditCard, Megaphone, PhoneOff, PhoneOutgoing, SkipForward,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { setCallStatus } from "@/hooks/use-call-status";
import { emitOrgEvent } from "@/lib/hub.functions";
import { closeObjection } from "@/lib/demo.functions";
import { captureObjectionCandidate } from "@/lib/objection-candidates.functions";
import { summarizeCall } from "@/lib/calls.functions";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DISCLOSURE, disclosureStatus, isDisclosureRequired } from "@/lib/compliance";
import { logDisclosure, shouldBlockLiveSurface } from "@/lib/disclosure";
import { SIM_RING_MS, SIM_SCRIPT } from "@/lib/simulation";
import { applyMerge, DEFAULT_AGREEMENT_BODY, signingUrl } from "@/lib/agreements";
import { Dialog, DialogDescription, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchObjectionLibrary } from "@/lib/objections";
import { assemblePromptForCall } from "@/lib/closer-profiles.functions";
import { assertCanCall, assertCanRecord, createCoreSuppression } from "@/lib/core/policy.functions";
import { phoneKey } from "@/lib/phone";
import { useCallingWindow } from "@/hooks/use-calling-window";
import { nextOpenAt, timezoneLabel } from "@/lib/calling-window";



export const Route = createFileRoute("/_authenticated/dialer")({
  validateSearch: (search: Record<string, unknown>): { number?: string } => ({
    number: typeof search.number === "string" ? search.number : undefined,
  }),
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

async function workspaceContext() {
  const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
  if (!prof?.active_workspace_id) throw new Error("No active workspace");
  return { orgId: prof.org_id, workspaceId: prof.active_workspace_id };
}

function DialerPage() {
  const { number: prefill } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("full_ai");
  const [phone, setPhone] = useState(prefill ?? "+1 555 0142");
  const [jurisdiction, setJurisdiction] = useState("FL");
  /** Core's recording verdict for the called party's jurisdiction, once it answers. */
  const [coreRec, setCoreRec] = useState<{
    consentType: string; requiresAnnouncement: boolean; calledState: string | null;
  } | null>(null);
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

  useEffect(() => {
    if (prefill) setPhone(prefill);
  }, [prefill]);

  useEffect(() => {
    setCallStatus(connected ? "on_call" : dialing ? "dialing" : "idle");
  }, [connected, dialing]);

  // Keep the live call id/elapsed in refs so both the unmount cleanup (in-app
  // navigation) and the pagehide listener (tab close / reload) can close out a
  // call the rep walked away from instead of leaving it stuck "in progress".
  const liveCall = useRef<{ id: string | null; sec: number }>({ id: null, sec: 0 });
  liveCall.current = { id: callId, sec: elapsed };
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) tokenRef.current = data.session?.access_token ?? null;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A keepalive PATCH survives both React teardown and a full page unload, which
  // the regular client call does not.
  const closeAbandonedCall = useRef(() => {
    const { id, sec } = liveCall.current;
    if (!id) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const token = tokenRef.current;
    if (!url || !key || !token) return;
    void fetch(`${url}/rest/v1/calls?id=eq.${id}&outcome=eq.in_progress`, {
      method: "PATCH",
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        outcome: sec > 0 ? "completed" : "failed",
        duration_sec: sec,
        ended_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  });

  useEffect(() => {
    const onHide = () => closeAbandonedCall.current();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(
    () => () => {
      setCallStatus("idle");
      closeAbandonedCall.current();
    },
    [],

  );


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
  const captureCandidate = useServerFn(captureObjectionCandidate);
  const assemblePrompt = useServerFn(assemblePromptForCall);
  const corePolicyAssert = useServerFn(assertCanCall);
  const coreSuppress = useServerFn(createCoreSuppression);
  const coreRecordAssert = useServerFn(assertCanRecord);

  const [sendingAgreement, setSendingAgreement] = useState(false);

  /** Creates a real agreement from the default template for the person on the line and copies the signing link. */
  const sendAgreement = async () => {
    setSendingAgreement(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id, full_name, email").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      const { data: tpl } = await supabase
        .from("agreement_templates")
        .select("id, body, file_path, file_name")
        .eq("workspace_id", prof.active_workspace_id)
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
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
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
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;

  const { data: agents } = useQuery({
    queryKey: ["dialer-agents", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, name, industry, default_mode, system_prompt, transfer_to, active")
        .eq("workspace_id", wsId!)
        .eq("active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const agent = (agents ?? []).find((a: any) => a.id === agentId);

  /**
   * The horizontal engine decides which closer owns this call, so the live brief
   * comes from the resolved profile rather than the agent row alone.
   */
  const { data: resolved } = useQuery({
    queryKey: ["resolved-closer", wsId, agent?.industry ?? null, campaignId || null, mode],
    enabled: !!wsId,
    queryFn: () =>
      assemblePrompt({
        data: {
          industry: agent?.industry ?? null,
          source: campaignId ? "campaign" : null,
          leadName: contact?.name ?? null,
          mode,
        },
      }),
  });
  const resolvedProfile = resolved?.ok ? resolved : null;

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
      const { workspaceId } = await workspaceContext();
      if (activeCall) {
        await supabase.from("transcript_segments").insert({
          call_id: activeCall,
          workspace_id: workspaceId,
          speaker: "Prospect",
          text: prospectLine,
          ts_sec: elapsed,
        });
      }
      const res = await askCloser({
        data: {
          prospect: prospectLine,
          mode: MODE_KEY[mode],
          agentName: agent?.name ?? resolvedProfile?.profileName ?? null,
          industry: agent?.industry ?? null,
          systemPrompt: resolvedProfile?.prompt ?? agent?.system_prompt ?? null,
          library: [
            ...(resolvedProfile?.objections ?? []),
            ...(await fetchObjectionLibrary(wsId)),
          ].slice(0, 25),
        },
      });
      setAiConfidence(res.confidence);
      setSuggestions([res.line]);
      setSuggestionRowId(null);
      setLineUsed(mode === "full_ai");
      if (mode === "full_ai") {
        setTranscript((t) => [...t, { speaker: "Master Closer", text: res.line }]);
      }
      // The AI had to improvise — queue the moment for human review in Studio.
      if (res.source !== "library" && res.line) {
        captureCandidate({
          data: {
            prospectText: prospectLine,
            aiResponse: res.line,
            label: res.objection,
            mode: MODE_KEY[mode],
            industry: agent?.industry ?? null,
            profileId: resolvedProfile?.profileId ?? null,
            callId: activeCall ?? null,
          },
        }).catch(() => {
          /* review capture is best-effort and must never interrupt a live call */
        });
      }
      if (activeCall) {
        const { data: sugg } = await supabase
          .from("suggestions")
          .insert({
            call_id: activeCall,
            workspace_id: workspaceId,
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
            workspace_id: workspaceId,
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
      const { workspaceId } = await workspaceContext();
      if (suggestionRowId) {
        await supabase.from("suggestions").update({ was_used: true }).eq("id", suggestionRowId);
      }
      if (callId) {
        await supabase.from("transcript_segments").insert({
          call_id: callId,
          workspace_id: workspaceId,
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
    queryKey: ["dialer-campaigns", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, mode, status, list_id, agent_id")
        .eq("workspace_id", wsId!)
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
        .eq("workspace_id", wsId!)
        .eq("list_id", c.list_id)
        .neq("last_outcome", "dnc")
        .neq("consent", "opt_out")
        .order("attempts", { ascending: true })
        .limit(50),
      supabase.from("dnc_list").select("phone").eq("workspace_id", wsId!),
    ]);
    const onlyDigits = phoneKey;
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
    queryKey: ["disclosure_settings", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("disclosure_settings").select("*").eq("workspace_id", wsId!).maybeSingle();
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



  /* Quiet hours are judged on the prospect's clock, never the caller's. */
  const { window: callWindow, verdictFor } = useCallingWindow();
  const windowVerdict = phone ? verdictFor({ phone }) : null;
  const windowBlocked = !!windowVerdict && !windowVerdict.allowed && callWindow.enforce;

  const scheduleOutsideWindow = async () => {
    if (!windowVerdict) return;
    const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
    if (!prof?.active_workspace_id) return;
    const due = nextOpenAt({
      lead: { phone },
      window: callWindow,
      workspaceDefaultTimezone: callWindow.default_timezone,
    });
    const { error } = await supabase.from("tasks").insert({
      org_id: prof.org_id,
      workspace_id: prof.active_workspace_id,
      title: `Call ${contact?.name ?? phone} — outside calling window`,
      due_at: due.toISOString(),
      priority: "normal",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Scheduled for the next open time in this lead's timezone.");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  };

  // Core's jurisdiction verdict is authoritative; local state rules are the floor.
  const required = isDisclosureRequired(jurisdiction) || coreRec?.requiresAnnouncement === true;
  const blocked =
    mode === "copilot" &&
    (shouldBlockLiveSurface(jurisdiction, delivered) ||
      (coreRec?.requiresAnnouncement === true && !delivered));

  const startCall = async () => {
    setBusy(true);
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");

      // Hard stop: never dial a number on the Do Not Call list.
      const target = phoneKey(phone);
      if (target) {
        const { data: dncRows } = await supabase.from("dnc_list").select("phone").eq("workspace_id", wsId!);
        const blocked = (dncRows ?? []).some((d: any) => phoneKey(d.phone) === target);
        if (blocked) throw new Error("This Number Is On The Do Not Call List.");

        // Core is the authority once this workspace is linked: it decides at the
        // moment of contact, and a Core failure denies the dial.
        const verdictCore = await corePolicyAssert({ data: { phone, actorType: mode === "full_ai" ? "ai" : "user" } });
        if (verdictCore.status === "decided" && verdictCore.decision === "deny") {
          throw new Error(
            verdictCore.deniedBy === "core_unavailable"
              ? "Core Could Not Authorize This Call. Dial Blocked."
              : `Core Denied This Call${verdictCore.deniedBy ? ` (${verdictCore.deniedBy})` : ""}.`,
          );
        }

        // Recording consent is evaluated where the called party sits, not where we do.
        const rec = await coreRecordAssert({ data: { phone } });
        if (rec.status === "decided") {
          setCoreRec({
            consentType: rec.consentType,
            requiresAnnouncement: rec.requiresAnnouncement,
            calledState: rec.calledState,
          });
          if (rec.calledState) setJurisdiction(rec.calledState);
          if (rec.decision === "deny") {
            throw new Error("Core Denied Recording For This Jurisdiction. Call Blocked.");
          }
        } else {
          setCoreRec(null);
        }
      }

      // Hard stop: quiet hours in the prospect's local time, logged either way.
      const verdict = verdictFor({ phone });
      if (!verdict.allowed) {
        await supabase.from("calling_window_blocks").insert({
          workspace_id: prof.active_workspace_id,
          lead_id: null,
          phone: phone || null,
          lead_timezone: verdict.timezone,
          timezone_source: verdict.timezoneSource,
          local_time: verdict.localTime,
          reason: verdict.reason,
        });
        if (callWindow.enforce) throw new Error(verdict.message);
        toast.warning(verdict.message);
      }



      // Simulated ring cadence stands in for the carrier until credentials are live.
      if (simulate) {
        setDialing(true);
        await new Promise((r) => setTimeout(r, SIM_RING_MS));
        setDialing(false);
      }



      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          org_id: prof.org_id, workspace_id: prof.active_workspace_id,
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
          workspace_id: prof.active_workspace_id,
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
      const { workspaceId } = await workspaceContext();
      await supabase
        .from("transcript_segments")
        .insert({ call_id: callId, workspace_id: workspaceId, speaker: "System", text, ts_sec: elapsed });
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
    queryKey: ["dialer-teammates", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", wsId!)
        .limit(50);
      const ids = (rows ?? []).map((r) => r.user_id).filter(Boolean);
      if (!ids.length) return [] as { id: string; full_name: string | null; email: string | null }[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return (profs ?? []) as { id: string; full_name: string | null; email: string | null }[];
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
            payload: {
              kind: "call.completed",
              call_id: callId,
              mode,
              dial_outcome: dial,
              lead_name: contact?.name ?? null,
              disposition: disposition ?? DISPOSITIONS.find((d) => d.value === dial)?.label ?? null,
              campaign_id: campaignId || null,
            },
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
        const { data: prof } = await supabase.from("profiles").select("id, org_id, active_workspace_id").maybeSingle();
        if (prof?.active_workspace_id) {
          const due = new Date();
          due.setDate(due.getDate() + wrap.dueDays);
          await supabase.from("tasks").insert({
            org_id: prof.org_id, workspace_id: prof.active_workspace_id!,
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
      const { data: prof } = await supabase.from("profiles").select("org_id, active_workspace_id").maybeSingle();
      if (!prof) throw new Error("No workspace found.");
      if (!prof.active_workspace_id) throw new Error("No active workspace");
      await supabase.from("dnc_list").insert({ org_id: prof.org_id, workspace_id: prof.active_workspace_id, phone, reason: "Requested on call" });
      // Push the opt-out to Core so every app in the family stops contacting them.
      try {
        const res = await coreSuppress({ data: { phone, reason: "opt_out", notes: "Requested on call", channel: "voice" } });
        if (res.status === "error") toast.warning("Recorded Locally. Core Suppression Failed — Retry From Compliance.");
      } catch {
        toast.warning("Recorded Locally. Core Suppression Failed — Retry From Compliance.");
      }
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
                  <Select value={campaignId || "__no_campaign__"} onValueChange={(v) => pickCampaign(v === "__no_campaign__" ? "" : v)}>
                    <SelectTrigger
                      className="w-full h-auto"
                      style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit" }}
                    >
                      <SelectValue placeholder="Direct Dial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__no_campaign__">Direct Dial</SelectItem>
                      {(campaigns ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={agentId || "__no_agent__"} onValueChange={(v) => pickAgent(v === "__no_agent__" ? "" : v)}>
                    <SelectTrigger
                      className="w-full h-auto"
                      style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", font: "inherit" }}
                    >
                      <SelectValue placeholder="Default Closer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__no_agent__">Default Closer</SelectItem>
                      {(agents ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {agent
                      ? `${agent.industry || "General"} · ${agent.transfer_to ? `Transfers to ${teammateLabel(agent.transfer_to)}` : "No transfer target set"}`
                      : "Uses the generic Master Closer brief."}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {resolvedProfile
                      ? `Brief: ${resolvedProfile.profileName}${resolvedProfile.isPlatformDefault ? " (platform)" : ""} · ${resolvedProfile.matchedLabel}`
                      : resolved && !resolved.ok
                        ? "No closer brief resolved — pick an AI Closer with an industry, or set a workspace default in Studio → Closer Profiles."
                        : "Resolving closer profile…"}
                  </span>
                </div>
                <div className="lead-field">

                  <span className="lead-k">Mode</span>
                  <div className="tabs" style={{ padding: 3, gap: 3 }}>
                    {(["full_ai", "hybrid", "copilot"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={"tab " + (mode === m ? "tab-on" : "")}
                        style={{ padding: "6px 8px", fontSize: 11.5 }}
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
                    In This State.
                  </span>

                </div>
                <div className="lead-field">
                  <span className="lead-k">Calling Window</span>
                  <span
                    className="font-num"
                    style={{ fontSize: 13, color: windowVerdict && !windowVerdict.allowed ? "var(--signal)" : "var(--ink)" }}
                  >
                    <Clock size={13} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
                    {windowVerdict
                      ? `${windowVerdict.localTime} ${timezoneLabel(windowVerdict.timezone)}`
                      : "Enter a number"}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {windowVerdict
                      ? windowVerdict.message +
                        (windowVerdict.timezoneSource === "workspace_default"
                          ? " Timezone unknown for this number — using your default."
                          : "")
                      : "Quiet hours are checked in the prospect's local time."}
                  </span>
                </div>
                <div className="lead-field">
                  <span className="lead-k">Simulation</span>
                  <div className="tabs" style={{ padding: 3, gap: 3 }}>
                    <button
                      type="button"
                      className={"tab " + (simulate ? "tab-on" : "")}
                      style={{ padding: "6px 8px", fontSize: 11.5 }}
                      onClick={() => setSimulate(true)}
                    >
                      Simulated
                    </button>
                    <button
                      type="button"
                      className={"tab " + (!simulate ? "tab-on" : "")}
                      style={{ padding: "6px 8px", fontSize: 11.5 }}
                      onClick={() => setSimulate(false)}
                    >
                      Live
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
                <button type="button" className="btn-primary" onClick={startCall} disabled={busy || windowBlocked}>
                  <PhoneOutgoing size={15} strokeWidth={2.2} />{" "}
                  {dialing
                    ? "Dialing…"
                    : windowBlocked
                      ? "Outside Calling Window"
                      : simulate
                        ? "Start Simulated Call"
                        : "Start Call"}
                </button>
                {windowBlocked && (
                  <button type="button" className="tab" onClick={scheduleOutsideWindow}>
                    <CalendarClock size={13} style={{ display: "inline", marginRight: 6 }} /> Schedule For Next Open Time
                  </button>
                )}
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
                  ["Disclosure", required ? "Required In This State" : disclosureStatus(jurisdiction)],
                  ["Recording Consent", coreRec ? coreRec.consentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Local Rules"],
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
            <DialogDescription className="sr-only">Log the outcome, disposition and notes for this call.</DialogDescription>
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
            <DialogDescription className="sr-only">Dial another number and merge it into this call.</DialogDescription>
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
            <DialogDescription className="sr-only">Choose who should take over this call.</DialogDescription>
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
