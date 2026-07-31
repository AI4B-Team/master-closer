// @ts-nocheck
import React, { useState } from "react";
import { closeObjection } from "@/lib/demo.functions";
import {
  AudioLines, ArrowRight, Play, Check, Minus, Building2, Home, Sun, ShieldCheck,
  Users, Car, Wrench, Heart, Mic, PhoneForwarded, Bot, CreditCard,
  Database, Languages, GraduationCap, ChevronDown, Lock, Loader2, PhoneCall,
  Ear, Eye, TrendingUp, Upload, SlidersHorizontal, Headphones, BadgeCheck, Sparkles,
  PhoneIncoming, MapPin, Megaphone, Landmark, Key, Scale, Stethoscope, Compass,
  Briefcase, Radio, Store, HardHat, Wind, Bug, Dumbbell, Plane, Truck, Network

} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Master Closer — landing page + live copilot demo                   */
/*  JobProof design language: Syne / DM Sans, dark hero, floating       */
/*  layered graphics, pill buttons, connected loop. White + Red #CC0000 */
/* ------------------------------------------------------------------ */

const MODES = [
  {
    key: "ai", label: "AI", plain: "AI Runs The Call", icon: Bot,
    blurb: "Runs the entire conversation—from discovery and presentation through objections, closing, and payment.",
    tag: "AI Speaking To Prospect",
    cue: "Totally fair on price. If I lock today's rate and email the agreement now, are you good to start?",
  },
  {
    key: "hybrid", label: "Hybrid", plain: "AI Starts. Human Closes.", icon: PhoneForwarded,
    blurb: "AI qualifies and warms the prospect, then briefs your closer and transfers the call when it's time to close.",
    tag: "AI Briefing Your Closer",
    cue: "Warm lead, budget confirmed, one price objection left. Transferring you in, take the close.",
  },
  {
    key: "copilot", label: "Copilot", plain: "Human Leads. AI Assists.", icon: Mic,
    blurb: "Your rep runs the call while AI privately provides the next best response in real time.",
    tag: "Whispered To Your Rep",
    cue: "Say: \"When you say it's a lot, is it the total or the monthly that gives you pause?\"",
  },
];


function Eyebrow({ children, light }) {
  return <div className={"eyebrow " + (light ? "eyebrow-light" : "text-signal")}>{children}</div>;
}

function Segmented({ value, onChange }) {
  return (
    <div className="seg" role="tablist" aria-label="Autonomy Mode">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = value === m.key;
        return (
          <button key={m.key} role="tab" aria-selected={active}
            onClick={() => onChange(m.key)}
            className={"seg-btn " + (active ? "seg-btn-on" : "")}>
            <Icon size={15} strokeWidth={2.2} />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------- Live Call hero card ------------------------- */
const HERO_LINES = {
  ai: { tag: "AI Speaking To Prospect", line: "Totally fair on price. If I can lock today's rate and email you the agreement right now, are you good to get started?" },
  hybrid: { tag: "AI Briefing Your Closer", line: "Warm lead, budget confirmed, one pricing objection left. Transferring you in now, take the close." },
  copilot: { tag: "Whispered To Your Rep", line: "Say: \"When you say it's a lot, is it the total or the monthly that gives you pause?\"" },
};

function LiveCallCard() {
  const [mode, setMode] = useState("copilot");
  const data = HERO_LINES[mode];
  return (
    <div className="device">
      <div className="device-top">
        <div className="flex items-center gap-2">
          <span className="rec-dot" />
          <span className="font-mono device-live">LIVE</span>
          <span className="font-mono device-time">07:42</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: "#8a8a93" }}>
          <PhoneCall size={14} strokeWidth={2} />
          <span className="font-mono" style={{ fontSize: 12 }}>Gridline · Discovery</span>
        </div>
      </div>
      <div className="device-body">
        <div className="bubble bubble-them">
          <div className="bubble-name font-mono">PROSPECT</div>
          Honestly, the price feels high. Your competitor is about half.
        </div>
        <div className="analysis">
          <div className="analysis-row">
            <span className="chip chip-red">Price Objection</span>
            <span className="chip">Tone: Guarded</span>
          </div>
          <div className="conf">
            <div className="conf-label font-mono">CLOSE PROBABILITY</div>
            <div className="conf-track"><div className="conf-fill" style={{ width: "72%" }} /></div>
            <div className="conf-num font-mono">72%</div>
          </div>
        </div>
        <div className="say">
          <div className="say-head">
            <AudioLines size={14} strokeWidth={2.4} className="text-signal" />
            <span className="font-mono say-tag">{data.tag}</span>
          </div>
          <p className="say-line">{data.line}</p>
        </div>
      </div>
      <div className="device-foot"><Segmented value={mode} onChange={setMode} /></div>
    </div>
  );
}

/* --------------------------- Live Claude demo -------------------------- */
const SCENARIOS = [
  "We already use someone for this.",
  "Just send me an email and I'll look it over.",
  "I need to talk to my business partner first.",
  "It's not the right time, maybe next quarter.",
];
function DemoWave() {
  return (
    <div className="demo-wave" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className="demo-bar" style={{ animationDelay: i * 0.12 + "s" }} />
      ))}
    </div>
  );
}

function AudioAtmosphere() {
  const ref = React.useRef(null);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const host = wrapRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 760px)").matches;

    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 });
    io.observe(host);

    // phases: idle (breathing), listen (contract), speak (expressive)
    let phase = "idle", phaseT = 0;
    let mode = "copilot";
    let handoff = -1;            // 0..1 sweep for hybrid transfer pulse
    let energy = 0.3, radiusK = 1;
    const PARTICLES = mobile ? 16 : 46;
    const particles = [];

    const spawnParticles = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLES; i++) {
        particles.push({ a: Math.random() * Math.PI * 2, p: Math.random() * 0.4, s: 0.0016 + Math.random() * 0.0022 });
      }
    };

    const onPulse = () => { phase = "listen"; phaseT = 0; spawnParticles(); };
    const onSpeak = () => { phase = "speak"; phaseT = 0; };
    const onMode = (e) => { const m = e?.detail; if (m) { if (m === "hybrid" && mode !== "hybrid") handoff = 0; mode = m; } };
    window.addEventListener("mc-demo-pulse", onPulse);
    window.addEventListener("mc-demo-speak", onSpeak);
    window.addEventListener("mc-demo-mode", onMode);

    const LINES = mobile ? 46 : 130;
    const STEP = mobile ? 18 : 12;
    let raf, last = performance.now(), t = 0;

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(48, now - last); last = now;
      if (!visible) return;
      t += dt * 0.001;
      phaseT += dt;

      if (phase === "listen" && phaseT > 650) { phase = "speak"; phaseT = 0; }
      if (phase === "speak" && phaseT > 3200) { phase = "idle"; phaseT = 0; }

      const modeScale = mode === "copilot" ? 0.86 : 1;
      const targetEnergy = phase === "listen" ? 0.12 : phase === "speak" ? 1 : (mode === "copilot" ? 0.26 : 0.4);
      const targetRadius = phase === "listen" ? 0.82 : phase === "speak" ? 1.06 : 1;
      energy += (targetEnergy - energy) * 0.06;
      radiusK += (targetRadius - radiusK) * 0.07;

      // hybrid handoff sweep, occasionally re-fires
      if (mode === "hybrid") {
        if (handoff < 0 && Math.random() < 0.003) handoff = 0;
        if (handoff >= 0) { handoff += dt * 0.0011; if (handoff > 1) handoff = -1; }
      } else handoff = -1;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.5;
      const spanned = Math.max(h * 0.58, w * 0.34);
      const base = Math.min(Math.max(spanned, 420), mobile ? 460 : 1100) * modeScale * radiusK;


      if (reduced) {
        ctx.beginPath(); ctx.arc(cx, cy, base, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(204,0,0,.14)"; ctx.lineWidth = 1.2; ctx.stroke();
        return;
      }

      // radial glow behind the orb
      const g = ctx.createRadialGradient(cx, cy, base * 0.1, cx, cy, base * 2.1);
      g.addColorStop(0, `rgba(190,10,10,${0.13 + energy * 0.07})`);
      g.addColorStop(0.45, "rgba(120,0,0,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // faint drifting echo circles
      for (let e = 0; e < 3; e++) {
        const br = base * (1.55 + e * 0.55) * (1 + Math.sin(t * (0.22 + e * 0.07) + e) * 0.025);
        ctx.beginPath();
        ctx.arc(cx + Math.sin(t * 0.18 + e) * 8, cy + Math.cos(t * 0.15 + e) * 6, br, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(214,40,40,${0.035 - e * 0.008})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // primary orb: many thin waveform rings
      const deform = (ang, k) => {
        const arcBoost = mode === "hybrid"
          ? 1 + 0.45 * Math.cos(ang * 2)            // two overlapping lobes
          : mode === "copilot"
            ? 1 + 0.18 * Math.sin(ang * 5 + t * 1.4)
            : 1;
        return (
          Math.sin(ang * 3 + t * 1.15 + k) * 0.055 +
          Math.sin(ang * 7 - t * 1.9 + k * 1.7) * 0.032 +
          Math.sin(ang * 13 + t * 2.7 + k * 0.6) * 0.016 * (0.4 + energy)
        ) * (0.55 + energy * 1.1) * arcBoost;
      };

      for (let i = 0; i < LINES; i++) {
        const k = i * 0.14;
        const rBase = base * (0.9 + (i / LINES) * 0.2);
        ctx.beginPath();
        for (let d = 0; d <= 360; d += STEP) {
          const ang = (d * Math.PI) / 180;
          const rr = rBase * (1 + deform(ang, k));
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr;
          d === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const edge = i / LINES;
        const alpha = (0.02 + edge * 0.05) * (0.75 + energy * 0.9);
        ctx.strokeStyle = edge > 0.82
          ? `rgba(255,120,110,${alpha * 1.25})`
          : `rgba(196,12,12,${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // hybrid handoff: a bright travelling arc from left lobe to right lobe
      if (handoff >= 0) {
        const a0 = Math.PI + handoff * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, base * 1.02, a0 - 0.28, a0 + 0.28);
        ctx.strokeStyle = `rgba(255,140,120,${0.28 * Math.sin(handoff * Math.PI)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // converging particles while listening
      if (phase === "listen") {
        for (const p of particles) {
          p.p += p.s * dt;
          const dist = base * 1.9 * (1 - Math.min(1, p.p));
          const px = cx + Math.cos(p.a) * dist;
          const py = cy + Math.sin(p.a) * dist;
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,110,100,${0.3 * (1 - p.p)})`;
          ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("mc-demo-pulse", onPulse);
      window.removeEventListener("mc-demo-speak", onSpeak);
      window.removeEventListener("mc-demo-mode", onMode);
    };
  }, []);

  return (
    <div className="atmo" ref={wrapRef} aria-hidden="true">
      <canvas ref={ref} className="atmo-canvas" />
    </div>
  );
}


function LiveDemo() {

  const [mode, setMode] = useState("copilot");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("mc-demo-mode", { detail: mode }));
  }, [mode]);


  const modeMeta = {
    ai: { persona: "You ARE the AI closer speaking directly to the prospect on the call.", lineDesc: "the exact words the AI should say next to the prospect, moving naturally toward the close and, if it fits, offering to send the agreement or a payment link", resultTag: "AI Says To Prospect" },
    hybrid: { persona: "You are the AI that warmed up this lead and is about to live-transfer to a human closer.", lineDesc: "a short, private briefing line spoken to the human closer summarizing where the deal stands and the one move to make on the close", resultTag: "AI Briefs Your Closer" },
    copilot: { persona: "You are a silent copilot whispering to a human sales rep. Only the rep can see this.", lineDesc: "the exact words the rep should say next, natural, spoken, no preamble", resultTag: "Whispered To Your Rep" },
  };

  async function run(text) {
    const prospect = (text ?? input).trim();
    if (!prospect) return;
    setInput(prospect); setLoading(true); setError(""); setResult(null);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mc-demo-pulse"));

    try {
      const data = await closeObjection({ data: { prospect, mode } });
      setResult(data);
      window.dispatchEvent(new CustomEvent("mc-demo-speak"));
    } catch (e) {
      setError("Couldn't Reach The Closer Just Now. Try Again In A Moment.");
    } finally { setLoading(false); }
  }


  return (
    <div className="demo">
      <div className="demo-controls"><Segmented value={mode} onChange={setMode} /></div>
      <div className="demo-scenarios">
        {SCENARIOS.map((s) => (
          <button key={s} type="button" className="scenario" onClick={() => run(s)}>{s}</button>
        ))}
      </div>
      <div className="demo-input">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Type What The Prospect Just Said…" aria-label="What The Prospect Said" />
        <button type="button" className="btn-primary demo-go" onClick={() => run()} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} strokeWidth={2.4} />}
          <span>Close It</span>
        </button>
      </div>
      <div className="demo-output" aria-live="polite">
        {!result && !loading && !error && (
          <div className="demo-empty">Pick An Objection Or Type Your Own. Master Closer Reads It Live And Hands Back The Move.</div>
        )}
        {loading && (
          <div className="demo-thinking">
            <DemoWave />
            <div className="demo-thinking-text">Reading The Room…</div>
          </div>
        )}
        {error && <div className="demo-empty text-signal">{error}</div>}
        {result && (
          <div className="demo-result">
            <div className="analysis-row" style={{ marginBottom: 14 }}>
              <span className="chip chip-red">{result.objection}</span>
              <span className="chip">Tone: {result.tone}</span>
            </div>
            <div className="conf" style={{ marginBottom: 16 }}>
              <div className="conf-label font-mono">CLOSE PROBABILITY</div>
              <div className="conf-track"><div className="conf-fill" style={{ width: `${Math.max(0, Math.min(100, result.confidence))}%` }} /></div>
              <div className="conf-num font-mono">{result.confidence}%</div>
            </div>
            <div className="say say-flat">
              <div className="say-head">
                <AudioLines size={14} strokeWidth={2.4} className="text-signal" />
                <span className="font-mono say-tag">{modeMeta[mode].resultTag}</span>
              </div>
              <p className="say-line">{result.line}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Data ------------------------------ */
const CAPS = [
  { icon: Mic, t: "Live Copilot", d: "The next line on screen before the prospect finishes talking. Only your rep sees it." },
  { icon: Bot, t: "AI Voice Agent", d: "A natural voice that runs the call end to end when you want it to." },
  { icon: PhoneForwarded, t: "Warm Transfer", d: "AI briefs the human, hands off the live call, and stays on to assist." },
  { icon: CreditCard, t: "Close & Collect", d: "Send the agreement and a payment link before the call ends." },
  { icon: Database, t: "CRM Write-Back", d: "Outcome, next step, and summary logged the moment you hang up." },
  { icon: ShieldCheck, t: "Consent Built In", d: "A light, state-aware disclosure on capture. No covert recording." },
  { icon: GraduationCap, t: "Practice Mode", d: "Spar with an AI prospect that fights back before the real call." },
  { icon: Languages, t: "32 Languages", d: "Run and close conversations across regions in native voice." },
];

const USES = [
  { icon: Building2, t: "SaaS", o: "We just signed with a competitor last month.", tags: ["Incumbent", "Skeptical"],
    r: "Makes sense — you're not going to rip that out today. If I show you what your team is still doing manually, would that be worth fifteen minutes before your renewal?", s: "REFRAME RISK", n: "MOVING TO DISCOVERY" },
  { icon: Home, t: "Real Estate", o: "Rates are insane right now, it doesn't feel right.", tags: ["Timing", "Anxious"],
    r: "I hear that a lot this month. Are you holding off on the rate, or on the payment? Because those solve two very different ways — let's look at your actual number first.", s: "ISOLATE CONCERN", n: "MOVING TO QUALIFY" },
  { icon: Sun, t: "Solar", o: "My neighbor's panels were a nightmare, why risk it?", tags: ["Trust", "Guarded"],
    r: "That's a fair reason to be cautious. Do you know who installed theirs and what went wrong — the panels, the roof work, or the service after? That tells us what to avoid here.", s: "ISOLATE CONCERN", n: "MOVING TO DISCOVERY" },
  { icon: ShieldCheck, t: "Insurance", o: "Had a claim denied last year. You're all the same.", tags: ["Trust", "Frustrated"],
    r: "Getting denied after paying in is infuriating. Can you tell me the reason they gave? I want to read your current coverage before I say a word about mine.", s: "BUILD TRUST", n: "MOVING TO REVIEW" },
  { icon: Users, t: "Recruiting", o: "Last agency burned us for $30K. Not again.", tags: ["Risk", "Burned"],
    r: "Then you've earned the right to be picky. Was it the quality of the people or how long they stayed? Let's talk about how the terms protect you before we talk roles.", s: "REFRAME RISK", n: "MOVING TO SCOPE" },
  { icon: Car, t: "Automotive", o: "I can get it for $4,000 less across town.", tags: ["Price", "Comparing"],
    r: "That's worth comparing. Before you decide, can I ask whether their price includes the same warranty, condition and service support — or are we comparing the sticker price alone?", s: "CLARIFY VALUE", n: "MOVING TO DISCOVERY" },
  { icon: Wrench, t: "Home Services", o: "Yours is the highest quote by far.", tags: ["Price", "Comparing"],
    r: "I believe you. Can I see what's on the other quote? Half the time the gap is materials or permits nobody mentioned, and you deserve to know which one you're buying.", s: "CLARIFY VALUE", n: "MOVING TO SCOPE" },
  { icon: Megaphone, t: "Marketing Agencies", o: "The last agency just sent us reports, not results.", tags: ["Results", "Skeptical"],
    r: "Reports aren't results, agreed. What was the one number that mattered to you that never moved? Let's start there instead of a deck.", s: "ISOLATE CONCERN", n: "MOVING TO DISCOVERY" },
  { icon: Landmark, t: "Financial Services", o: "I already have an advisor I've used for years.", tags: ["Incumbent", "Loyal"],
    r: "Loyalty like that is usually earned. I'm not asking you to leave — when did you two last review the plan together, and does it still match what this year looks like?", s: "REFRAME RISK", n: "MOVING TO REVIEW" },
  { icon: Key, t: "Mortgage", o: "I'll just wait until rates come down.", tags: ["Timing", "Cautious"],
    r: "That's a reasonable plan. Is waiting about the monthly payment or the price of the home? If prices move while you wait, we should look at both numbers side by side.", s: "ISOLATE CONCERN", n: "MOVING TO QUALIFY" },
  { icon: Scale, t: "Legal Services", o: "Your retainer is more than I expected.", tags: ["Price", "Hesitant"],
    r: "It's a real number, I won't soften it. Can I walk you through what's covered inside it? Most people are comparing it to an hourly figure that isn't the same thing.", s: "CLARIFY VALUE", n: "MOVING TO SCOPE" },
  { icon: Stethoscope, t: "Healthcare Services", o: "I need to check if my insurance covers this.", tags: ["Coverage", "Cautious"],
    r: "Smart — let's not guess. If I can get you the coverage answer and the out-of-pocket range today, would you want to hold a slot while we confirm it?", s: "REMOVE FRICTION", n: "MOVING TO SCHEDULING" },
  { icon: GraduationCap, t: "Education", o: "I'm not sure the program is worth the tuition.", tags: ["Value", "Unsure"],
    r: "Then let's not hand-wave it. What would you need this to change in your work for it to be obviously worth it? I'll tell you straight if we're the wrong fit.", s: "CLARIFY VALUE", n: "MOVING TO DISCOVERY" },
  { icon: Compass, t: "Coaching", o: "I've tried programs like this before and stalled.", tags: ["Doubt", "Tired"],
    r: "That's useful information, not a dealbreaker. Where did it stall — the plan, the accountability, or the time? That's the part we'd build around.", s: "ISOLATE CONCERN", n: "MOVING TO DISCOVERY" },
  { icon: Briefcase, t: "Consulting", o: "We can probably figure this out internally.", tags: ["Build vs Buy", "Confident"],
    r: "You probably could. What's the cost of your team spending the next two quarters on it instead of their own roadmap? Let's compare that honestly.", s: "REFRAME RISK", n: "MOVING TO SCOPE" },
  { icon: Radio, t: "Telecommunications", o: "We're locked into a contract until next year.", tags: ["Timing", "Contracted"],
    r: "Good to know — no reason to break something early. What's the exact end date? If the numbers work, most people want the switch planned, not rushed.", s: "REMOVE FRICTION", n: "MOVING TO PLANNING" },
  { icon: Store, t: "Merchant Services", o: "Everybody promises lower rates and nobody delivers.", tags: ["Trust", "Cynical"],
    r: "Fair, the industry earned that. Send me last month's statement and I'll show you line by line where your fees actually go — even if I can't beat it.", s: "BUILD TRUST", n: "MOVING TO REVIEW" },
  { icon: Lock, t: "Security Systems", o: "Nothing's ever happened here, I don't need it.", tags: ["Need", "Dismissive"],
    r: "Glad to hear it, honestly. Is it that you don't need protection, or that you don't want another monthly bill? Those get solved differently.", s: "ISOLATE CONCERN", n: "MOVING TO DISCOVERY" },
  { icon: HardHat, t: "Roofing", o: "I'll just patch it and get through the season.", tags: ["Timing", "Deferring"],
    r: "That can be the right call. Do you know whether the leak is at the flashing or the decking? One is a patch, the other gets expensive quietly — let's find out which.", s: "REFRAME RISK", n: "MOVING TO INSPECTION" },
  { icon: Wind, t: "HVAC", o: "It still runs, I'm not replacing it yet.", tags: ["Timing", "Deferring"],
    r: "Then don't. What are you paying in summer months right now? If the repair keeps stacking against the bill, you should at least know your break-even.", s: "CLARIFY VALUE", n: "MOVING TO ASSESSMENT" },
  { icon: Bug, t: "Pest Control", o: "I've been handling it myself with store products.", tags: ["DIY", "Independent"],
    r: "A lot of people do, and it works until it doesn't. Is it coming back in the same spot? That usually means the source is somewhere the spray never reaches.", s: "CLARIFY VALUE", n: "MOVING TO INSPECTION" },
  { icon: Dumbbell, t: "Fitness & Wellness", o: "I don't have time to actually use a membership.", tags: ["Time", "Realistic"],
    r: "That's the honest reason most people quit. If we built it around three short sessions a week at the times you're actually free, would that be doable?", s: "REMOVE FRICTION", n: "MOVING TO SCHEDULING" },
  { icon: Plane, t: "Travel & Hospitality", o: "I found the same trip cheaper online.", tags: ["Price", "Comparing"],
    r: "Let's look at it together. Is the cheaper one the same dates, room type and cancellation terms? If it is, I'll tell you — and if it isn't, you'll want to know before you book.", s: "CLARIFY VALUE", n: "MOVING TO BOOKING" },
  { icon: Truck, t: "Logistics", o: "Switching carriers is more trouble than it's worth.", tags: ["Friction", "Cautious"],
    r: "Switching badly is. What broke last time you moved lanes? We'd run one route in parallel before you commit anything else.", s: "REMOVE FRICTION", n: "MOVING TO PILOT" },
  { icon: Database, t: "Business Services", o: "Send me some information and I'll review it.", tags: ["Brush-off", "Busy"],
    r: "Happy to. So I don't send you a folder you'll never open — what's the one thing you'd need answered for this to be worth a real look?", s: "ISOLATE CONCERN", n: "MOVING TO DISCOVERY" },
  { icon: Network, t: "Franchises", o: "The initial investment is a lot to commit to.", tags: ["Risk", "Serious"],
    r: "It should feel like a lot — it's a real commitment. Is the hesitation the capital itself or the ramp before it pays back? Let's pull the numbers on the one that's bothering you.", s: "ISOLATE CONCERN", n: "MOVING TO QUALIFY" },
];


const STEPS = [
  { icon: Upload, t: "Feed It Your Offer", d: "Drop in your script, pricing, and objections. It learns what you sell and how you win." },
  { icon: SlidersHorizontal, t: "Set The Autonomy", d: "Choose AI, Hybrid, or Copilot, per campaign or per rep." },
  { icon: Headphones, t: "Run Or Assist The Call", d: "It runs the call itself or whispers the next line to your rep, live." },
  { icon: CreditCard, t: "Close & Get Paid", d: "Send the agreement, collect payment, and log the whole thing to your CRM." },
];

const COMPARE = [
  { cap: "Helps During The Live Call", rec: 0, cop: 2, mc: 2 },
  { cap: "Runs The Whole Call", rec: 0, cop: 0, mc: 2 },
  { cap: "Warm Transfer, AI Stays On", rec: 0, cop: 0, mc: 2 },
  { cap: "Closes And Collects Payment", rec: 0, cop: 0, mc: 2 },
  { cap: "Consent Built In", rec: 1, cop: 0, mc: 2 },
  { cap: "CRM Write-Back", rec: 2, cop: 1, mc: 2 },
  { cap: "Practice Mode", rec: 0, cop: 1, mc: 2 },
];

const FAQS = [
  { q: "Does Master Closer Record My Calls?", a: "Only if you choose to. The copilot works from a live transcript that is processed and can be discarded. When you turn recording on, a short disclosure is delivered at the top of the call, the same way a call center announces it." },
  { q: "Is This Compliant In Two-Party Consent States?", a: "Consent is built in as a feature. Master Closer delivers a light quality-and-training disclosure on capture and knows the rules state by state, so it only adds friction where the law requires it. It is not legal advice, and you should confirm your setup with counsel." },
  { q: "Can The AI Really Close And Take Payment?", a: "Yes. In AI or Hybrid mode it can send an agreement and a payment link mid-call. You decide how far it goes and where a human takes over." },
  { q: "What Are The Three Modes?", a: "One setting decides who runs the call. AI runs it end to end. Hybrid warms the lead, then live-transfers to your closer while the AI stays on. Copilot lets your rep run it with the AI whispering support. Same brain, three settings, changeable per call." },
  { q: "Which Platforms Does It Work With?", a: "Zoom, Google Meet, Microsoft Teams, and phone. If there is audio, Master Closer can work the call." },
  { q: "How Fast Is Setup?", a: "Minutes. Add your offer and objections, pick an autonomy setting, and take your next call." },
];

function Cell({ v }) {
  if (v === 2) return <span className="cmark cmark-yes"><Check size={15} strokeWidth={3} /></span>;
  if (v === 1) return <span className="cmark cmark-part" />;
  return <span className="cmark cmark-no"><Minus size={15} strokeWidth={3} /></span>;
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button className="faq-q" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{q}</span>
        <ChevronDown size={18} className={"faq-chev " + (open ? "faq-chev-open" : "")} />
      </button>
      {open && <p className="faq-a">{a}</p>}
    </div>
  );
}

/* --------------------- Industry objection explorer --------------------- */
function IndustryExplorer() {
  const [active, setActive] = useState(5); // Automotive
  const [locked, setLocked] = useState(false);
  const u = USES[active];
  const Icon = u.icon;
  const half = Math.ceil(USES.length / 2);
  const rows = [USES.slice(0, half), USES.slice(half)];

  const Pill = ({ item, idx }) => {
    const I = item.icon;
    const on = idx === active;
    return (
      <button
        type="button"
        className={"indp " + (on ? "indp-on" : "")}
        onClick={() => { setActive(idx); setLocked(true); }}
        aria-pressed={on}
      >
        <I size={15} strokeWidth={2.2} />
        <span>{item.t}</span>
      </button>
    );
  };

  return (
    <div className="indx">
      <div className={"indrows " + (locked ? "indrows-lock" : "")}>
        {rows.map((row, r) => (
          <div className="indrow" key={r}>
            <div className={"indtrack " + (r === 1 ? "indtrack-rev" : "")}>
              {[0, 1].map((dup) => (
                <div className="indset" key={dup} aria-hidden={dup === 1}>
                  {row.map((item) => (
                    <Pill key={item.t} item={item} idx={USES.indexOf(item)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="indpanel" key={u.t}>
        <div className="indpanel-in">
          <div className="indside">
            <div className="indhead">
              <span className="indhead-ico"><Icon size={17} strokeWidth={2.2} /></span>
              <span className="indhead-t font-display">{u.t}</span>
            </div>
            <div className="indlbl font-mono">REAL-WORLD OBJECTION</div>
            <p className="indquote font-display">“{u.o}”</p>
            <div className="indtags">
              {u.tags.map((t) => <span key={t} className="indtag font-mono">{t}</span>)}
            </div>
          </div>

          <div className="indside indside-ai">
            <div className="indhead">
              <MiniOrb size={44} variant="ai" />
              <span className="indlbl font-mono indlbl-red">MASTER CLOSER · LIVE RESPONSE</span>
            </div>
            <p className="indresp">{u.r}</p>
            <div className="indmeta">
              <span className="indstrat font-mono"><AudioLines size={12} strokeWidth={2.6} />{u.s}</span>
              <span className="indnext font-mono"><ArrowRight size={12} strokeWidth={2.6} />{u.n}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="indfoot">
        <span>Don't see your industry? Master Closer adapts to your offer, sales process and approved playbook.</span>
        <a href="#demo" className="indlink">Train It On My Business <ArrowRight size={14} strokeWidth={2.6} /></a>
      </div>
    </div>
  );
}

/* --------------------- Mode sections: shared system -------------------- */


/* The mesh voice orb is THE Master Closer AI mark — small, functional variants only. */
function meshPath(cx, cy, r, amp, lobes, phase) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r + Math.sin(a * lobes + phase) * amp + Math.sin(a * (lobes + 2) - phase) * amp * 0.5;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return "M" + pts.map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2)).join("L") + "Z";
}

function MiniOrb({ size = 88, variant = "ai" }) {
  if (variant === "hybrid") {
    return (
      <div className="mlink" style={{ width: size * 1.6, height: size * 0.5 }} aria-hidden="true">
        <span className="mlink-node mlink-ai" />
        <span className="mlink-path"><span className="mlink-pulse" /></span>
        <span className="mlink-node mlink-hu" />
      </div>
    );
  }
  if (variant === "copilot") {
    return (
      <div className="mwave" style={{ width: size * 1.1, height: size * 0.42 }} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <span key={i} style={{ animationDelay: i * 0.09 + "s" }} />
        ))}
      </div>
    );
  }
  return (
    <div className="morb" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <path className="morb-l morb-l1" d={meshPath(50, 50, 34, 3.6, 5, 0)} />
        <path className="morb-l morb-l2" d={meshPath(50, 50, 27, 3.0, 7, 1.4)} />
        <path className="morb-l morb-l3" d={meshPath(50, 50, 20, 2.4, 4, 2.8)} />
      </svg>
    </div>
  );
}

const STAGES = ["Discovery", "Qualify", "Present", "Objections", "Close", "Payment"];

function StageStrip({ current }) {
  return (
    <div className="stg">
      {STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <div key={s} className={"stg-i stg-" + state}>
            <span className="stg-dot">
              {state === "done" ? <Check size={11} strokeWidth={3.2} />
                : <span className="stg-num font-mono">{i + 1}</span>}
            </span>
            <span className="stg-lbl">{s}</span>
          </div>
        );
      })}
    </div>
  );
}

function CallCard({ status, elapsed, variant, children, footer }) {
  return (
    <div className="fmock">
      <div className="fmock-bar">
        <span className="rec-dot" />
        <span className="font-mono fmock-live">LIVE</span>
        <span className="fmock-time font-mono">{elapsed}</span>
        <span className="fmock-status font-mono">{status}</span>
      </div>
      <div className="fmock-body">
        <div className="orb-row">
          <MiniOrb variant={variant} />
        </div>
        {children}
      </div>
      {footer}
    </div>
  );
}

function Prob({ value, stage }) {
  return (
    <div className="prob">
      <div className="prob-top">
        <span className="font-mono prob-lbl">CLOSE PROBABILITY</span>
        <b className="font-display prob-val">{value}%</b>
      </div>
      <div className="prob-track"><span className="prob-fill" style={{ width: value + "%" }} /></div>
      <div className="prob-stage font-mono">STAGE · {stage}</div>
    </div>
  );
}

function MockAI() {
  return (
    <CallCard status="AI · SPEAKING" elapsed="04:12" variant="ai"
      footer={<div className="fmock-foot"><StageStrip current={3} /></div>}>
      <div className="line line-them">
        <div className="line-name font-mono">PROSPECT</div>
        Honestly, the price feels high. Your competitor is about half.
      </div>
      <div className="line line-ai">
        <div className="line-name font-mono">MASTER CLOSER</div>
        When you say it feels high, is it the total investment or the monthly amount that gives you pause?
      </div>
      <Prob value={72} stage="Handling Objection" />
    </CallCard>
  );
}

function MockHybrid() {
  return (
    <CallCard status="AI · TRANSFERRING" elapsed="06:38" variant="hybrid"
      footer={<div className="fmock-foot"><StageStrip current={4} /></div>}>
      <div className="xfer">
        <div className="xfer-side"><span className="xfer-av xfer-av-ai"><Bot size={18} strokeWidth={2.2} /></span><span className="xfer-name font-display">AI Closer</span></div>
        <span className="xfer-arrow"><ArrowRight size={18} strokeWidth={2.6} /></span>
        <div className="xfer-side"><span className="xfer-av"><Headphones size={18} strokeWidth={2.2} /></span><span className="xfer-name font-display">Sarah · Closer</span></div>
      </div>
      <div className="say">
        <div className="say-head">
          <PhoneForwarded size={13} strokeWidth={2.4} className="text-signal" />
          <span className="font-mono say-tag">Briefing Your Closer</span>
        </div>
        <p className="say-line">Qualified. Budget confirmed at $4.2k, decision maker on the line, one price objection left. Take the close.</p>
      </div>
      <Prob value={64} stage="Warm Transfer" />
    </CallCard>
  );
}

function MockCopilot() {
  return (
    <CallCard status="REP · SPEAKING" elapsed="09:05" variant="copilot"
      footer={<div className="fmock-foot"><StageStrip current={3} /></div>}>
      <div className="line line-them">
        <div className="line-name font-mono">PROSPECT</div>
        I need to think about it and talk to my partner.
      </div>
      <div className="say">
        <div className="say-head">
          <AudioLines size={13} strokeWidth={2.4} className="text-signal" />
          <span className="font-mono say-tag">Next Best Response</span>
        </div>
        <p className="say-line">Say: "Totally fair. When you two talk, what's the one thing that decides it — the price or the timeline?"</p>
        <div className="say-note font-mono">PRIVATE · PROSPECT CANNOT SEE OR HEAR THIS</div>
      </div>
      <Prob value={58} stage="Handling Objection" />
    </CallCard>
  );
}


const INDUSTRIES = [
  "SaaS", "Real Estate", "Solar", "Insurance", "Recruiting", "Automotive",
  "Home Services", "Legal Services", "Healthcare Sales", "Financial Services",
  "Agencies", "Education", "Telecommunications", "Merchant Services",
  "Coaching", "B2B Services",
];

const STORIES = [
  {
    kicker: "01 · AI Mode",
    icon: Bot,
    t: "AI Runs The Call.\nFrom Hello To Payment.",
    d: "From the first hello to the final payment, Master Closer handles discovery, presentation, objections and closing in one natural conversation.",
    bullets: [
      "Runs the complete sales conversation",
      "Responds to objections in real time",
      "Handles overflow and after-hours calls",
      "Closes and collects payment",
    ],
    Mock: MockAI,
    flip: true,
  },
  {
    kicker: "02 · Hybrid Mode",
    icon: PhoneForwarded,
    t: "AI Starts. Your Closer Finishes.",
    d: "The AI opens, qualifies and warms the prospect, then hands your closer a live call with a short briefing already delivered.",
    bullets: [
      "Qualifies before a human ever picks up",
      "Delivers a one-line brief on transfer",
      "Live handoff, no cold restart",
      "Copilot keeps guiding after the transfer",
    ],
    Mock: MockHybrid,
    flip: false,
  },
  {
    kicker: "03 · Copilot Mode",
    icon: Mic,
    t: "Your Rep Leads.\nAI Guides.",
    d: "Your rep runs the conversation while Master Closer listens and privately puts the next best line on screen — the prospect never sees or hears it.",
    bullets: [
      "Word-for-word next line, not vague coaching",
      "Objection and tone labeled in real time",
      "Completely invisible to the prospect",
      "Close probability updates every turn",
    ],
    Mock: MockCopilot,
    flip: true,
  },
];

function FeatureStories() {
  return (
    <div className="modes-band">
      <span className="modes-glow modes-glow-a" />
      <span className="modes-glow modes-glow-b" />
      {STORIES.map((s) => {
        const Icon = s.icon;
        const Mock = s.Mock;
        return (
          <section key={s.kicker} className="sec sec-story">
            <div className="wrap">
              <div className={"story " + (s.flip ? "story-flip" : "")}>
                <div className="story-copy">
                  <div className="story-kick font-mono"><Icon size={14} strokeWidth={2.3} />{s.kicker}</div>
                  <h3 className="font-display story-h">{s.t}</h3>
                  <p className="story-d">{s.d}</p>
                  <ul className="story-list">
                    {s.bullets.map((b) => (
                      <li key={b}><span className="story-tick"><Check size={13} strokeWidth={3} /></span>{b}</li>
                    ))}
                  </ul>
                </div>
                <div className="story-vis">{React.createElement(Mock)}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}


export default function MasterCloser() {
  return (
    <div className="mc-root">
      <style>{CSS}</style>

      {/* NAV */}
      <header className="nav">
        <div className="wrap nav-in">
          <div className="brand">
            <span className="brand-mark"><AudioLines size={18} strokeWidth={2.6} /></span>
            <span className="brand-word font-display">Master Closer</span>
          </div>
          <nav className="nav-links">
            <a href="#autonomy">Product</a>
            <a href="#uses">Solutions</a>
            <a href="#setup">How It Works</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="nav-cta">
            <a href="#" className="nav-login">Sign In</a>
            <a href="#" className="btn-primary">Get Started</a>
          </div>
        </div>
      </header>

      {/* HERO (dark, floating layered graphics) */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <Eyebrow>AI Closer, Human Closer, Or Both.</Eyebrow>
            <h1 className="font-display hero-h1">Close Every<br />Conversation.</h1>
            <p className="hero-sub">
              Master Closer can run the entire call, warm the lead and hand off to your closer,
              or whisper the next line while your rep talks. You decide how much is AI and how
              much is human on every call.
            </p>
            <div className="hero-actions">
              <a href="#demo" className="btn-primary btn-lg">Try It Live <ArrowRight size={17} strokeWidth={2.4} /></a>
              <a href="#autonomy" className="btn-ghost-light btn-lg"><Play size={16} strokeWidth={2.4} /> See The Three Modes</a>
            </div>
            <div className="hero-pills">
              {[{ i: Bot, t: "Runs The Call" }, { i: Mic, t: "Whispers The Close" }, { i: CreditCard, t: "Closes & Collects" }].map((p) => {
                const Icon = p.i;
                return (
                  <div key={p.t} className="hero-pill">
                    <span className="hero-pill-ico"><Icon size={15} strokeWidth={2.2} /></span>
                    <span className="hero-pill-t font-display">{p.t}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hero-stage">
            <div className="hero-card"><LiveCallCard /></div>

            <div className="float float-rate">
              <span className="float-ico float-ico-red"><TrendingUp size={16} strokeWidth={2.4} /></span>
              <div>
                <div className="font-mono float-label">CLOSE RATE</div>
                <div className="float-big">47%</div>
              </div>
              <span className="float-delta">+12</span>
            </div>

            <div className="float float-whisper">
              <div className="font-mono float-label" style={{ color: "#CC0000" }}>WHISPER · LIVE</div>
              <div className="float-whisper-line">"Anchor the price, then pause."</div>
            </div>

            <div className="float float-deal">
              <span className="float-ico float-ico-green"><BadgeCheck size={16} strokeWidth={2.4} /></span>
              <div>
                <div className="font-mono float-label">DEAL CLOSED</div>
                <div className="float-big">$4,200</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRY MARQUEE */}
      <section className="strip">
        <div className="strip-in">
          <span className="strip-label font-mono">BUILT TO CLOSE IN</span>
          <div className="marquee">
            <div className="marquee-track">
              {[0, 1].map((dup) => (
                <div className="marquee-set" key={dup} aria-hidden={dup === 1}>
                  {INDUSTRIES.map((x) => (
                    <span key={x} className="strip-chip font-display">{x}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* AUTONOMY */}
      <section id="autonomy" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>AI · Hybrid · Copilot</Eyebrow>
            <h2 className="font-display sec-h2">One Platform. Three Ways To Run The Call.</h2>
            <p className="sec-lead">One sales engine. Three ways to use it. Let AI run the call, transfer a qualified prospect to your closer, or privately coach your rep in real time.</p>
          </div>
          <div className="modes">
            {MODES.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={m.key} className="mode-card">
                  <div className="mode-top">
                    <span className="mode-ico"><Icon size={20} strokeWidth={2.2} /></span>
                    <span className="mode-step font-mono">0{i + 1}</span>
                  </div>
                  <h3 className="font-display mode-h">{m.label}</h3>
                  <div className="mode-plain">{m.plain}</div>
                  <p className="mode-b">{m.blurb}</p>
                  <div className="mode-cue">
                    <span className="font-mono mode-cue-tag">{m.tag}</span>
                    <p className="mode-cue-line">{m.cue}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TWO VIEWS */}
      <section className="sec sec-mist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Two Sides Of Every Call</Eyebrow>
            <h2 className="font-display sec-h2">What They Hear. What You See.</h2>
            <p className="sec-lead">Your prospect hears a natural, confident conversation. You see the objection named, the next line, and the close probability, private to your screen only.</p>
          </div>
          <div className="views">
            <div className="view-card">
              <div className="view-head">
                <span className="view-ico view-ico-green"><Ear size={18} strokeWidth={2.2} /></span>
                <span className="view-title font-display">What Your Prospect Hears</span>
                <span className="view-pill view-pill-green font-mono">NATURAL</span>
              </div>
              <ul className="view-list">
                {["A Confident, Human Conversation", "Natural Pauses And Sharp Questions", "No Robotic Script, No Awkward Delay", "A Smooth, Low-Pressure Close"].map((x) => (
                  <li key={x}><Check size={16} strokeWidth={2.6} className="view-check-green" /> {x}</li>
                ))}
              </ul>
            </div>
            <div className="view-card">
              <div className="view-head">
                <span className="view-ico view-ico-red"><Eye size={18} strokeWidth={2.2} /></span>
                <span className="view-title font-display">What You See On Screen</span>
                <span className="view-pill view-pill-red font-mono">PRIVATE</span>
              </div>
              <ul className="view-list">
                {["The Real Objection, Named Instantly", "The Exact Next Line To Say", "Live Close Probability, Moving", "Agreement And Payment, Ready To Send"].map((x) => (
                  <li key={x}><AudioLines size={15} strokeWidth={2.4} className="text-signal" /> {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="sec sec-demo-dark">
        <AudioAtmosphere />
        <div className="wrap" style={{ position: "relative", zIndex: 1 }}>

          <div className="sec-head">
            <Eyebrow light>Live Demo</Eyebrow>
            <h2 className="font-display sec-h2">Throw It A Real Objection.</h2>
            <p className="sec-lead">This is the actual engine, not a video. Pick a line or type your own, choose who's running the call, and watch Master Closer hand back the move in real time.</p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* COMPARISON */}
      <section className="sec sec-mist">
        <div className="wrap wrap-narrow">
          <div className="sec-head">
            <Eyebrow>The Difference</Eyebrow>
            <h2 className="font-display sec-h2">How Master Closer Compares.</h2>
            <p className="sec-lead">Recorders review the call after it's lost. Basic copilots only whisper. Master Closer runs, assists, and closes.</p>
          </div>
          <div className="compare">
            <div className="cmp-row cmp-head">
              <div className="cmp-cap font-mono">CAPABILITY</div>
              <div className="cmp-col font-display">Recorders</div>
              <div className="cmp-col font-display">Basic Copilots</div>
              <div className="cmp-col cmp-col-hi font-display">Master Closer</div>
            </div>
            {COMPARE.map((r) => (
              <div key={r.cap} className="cmp-row">
                <div className="cmp-cap">{r.cap}</div>
                <div className="cmp-col"><Cell v={r.rec} /></div>
                <div className="cmp-col"><Cell v={r.cop} /></div>
                <div className="cmp-col cmp-col-hi"><Cell v={r.mc} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="sec sec-caps-head">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Capabilities</Eyebrow>
            <h2 className="font-display sec-h2">Everything A Closer Needs, In One Place.</h2>
            <p className="sec-lead">Four things happen on every call. Master Closer handles all of them.</p>
          </div>
        </div>
      </section>

      <FeatureStories />

      <section className="sec sec-tight">
        <div className="wrap">
          <div className="caps-more">
            {CAPS.slice(4).map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.t} className="cap">
                  <span className="cap-ico"><Icon size={18} strokeWidth={2.1} /></span>
                  <h3 className="font-display cap-h">{c.t}</h3>
                  <p className="cap-d">{c.d}</p>
                </div>
              );
            })}
          </div>
          <div className="caps-cta">
            <a href="#demo" className="btn-primary btn-lg">Try It Live <ArrowRight size={17} strokeWidth={2.4} /></a>
          </div>
        </div>
      </section>

      {/* INDUSTRY EXPLORER */}
      <section id="uses" className="sec sec-inds">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Industry-Ready</Eyebrow>
            <h2 className="font-display sec-h2">Built For The Objections Your Buyers Actually Raise.</h2>
            <p className="sec-lead">Choose an industry and watch Master Closer turn a familiar objection into the next step toward a sale.</p>
          </div>
          <IndustryExplorer />
        </div>
      </section>


      {/* SETUP / LOOP */}
      <section id="setup" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>The Master Closer Loop</Eyebrow>
            <h2 className="font-display sec-h2">From First Hello To Paid In Full.</h2>
          </div>
          <div className="loop">
            <div className="loop-line" />
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.t} className="loop-step">
                  <div className="loop-node">
                    <span className="loop-node-ico"><Icon size={20} strokeWidth={2.2} /></span>
                    <span className="loop-num font-mono">0{i + 1}</span>
                  </div>
                  <h3 className="font-display loop-h">{s.t}</h3>
                  <p className="loop-d">{s.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section className="sec sec-dark sec-comply">
        <div className="wrap comply">
          <div className="comply-copy">
            <Eyebrow light>Compliance, Built In</Eyebrow>
            <h2 className="font-display sec-h2" style={{ color: "#fff" }}>Win The Call Without Crossing The Line.</h2>
            <p className="sec-lead" style={{ color: "rgba(255,255,255,.66)" }}>
              Master Closer provides a clear recording disclosure, applies consent rules based on the
              caller's location, and keeps private AI coaching out of the recorded conversation. Every
              disclosure and consent event is securely logged—so your team can sell confidently without
              resorting to covert tactics.
            </p>
            <div className="comply-list">
              {["Automatic Recording Disclosure", "State-Aware Consent Guidance", "Private AI Coaching", "Encrypted Consent Logs"].map((x) => (
                <div key={x} className="comply-item"><Check size={16} strokeWidth={2.6} className="text-signal" /> {x}</div>
              ))}
            </div>
          </div>

          <div className="cv">
            <div className="cv-glow" />
            <div className="cv-card">
              <div className="cv-top">
                <div className="cv-title">
                  <span className="cv-ico"><ShieldCheck size={18} strokeWidth={2.2} /></span>
                  <div>
                    <div className="font-display cv-h">Consent Verification</div>
                    <div className="cv-sub font-mono">SESSION LIVE</div>
                  </div>
                </div>
                <span className="cv-badge">Two-Party Consent</span>
              </div>

              <div className="cv-meta">
                <div className="cv-meta-item">
                  <PhoneIncoming size={15} strokeWidth={2.2} />
                  <span>Incoming Call</span>
                </div>
                <div className="cv-meta-item">
                  <MapPin size={15} strokeWidth={2.2} />
                  <span>Location: Florida</span>
                </div>
              </div>

              <div className="cv-steps">
                <div className="cv-line" />
                {[
                  { t: "Disclosure Played", d: "“This call is recorded for quality and training.”", icon: Check, tone: "ok" },
                  { t: "Consent Confirmed", d: "Verbal opt-in captured at 00:07", icon: Check, tone: "ok" },
                  { t: "Recording Started", d: "Encrypted stream · AES-256", icon: Check, tone: "ok" },
                  { t: "AI Coaching Private", d: "Copilot layer excluded from recording", icon: Lock, tone: "lock" },
                ].map((s) => {
                  const I = s.icon;
                  return (
                    <div key={s.t} className="cv-step">
                      <span className={"cv-dot cv-dot-" + s.tone}><I size={13} strokeWidth={3} /></span>
                      <div>
                        <div className="cv-step-t font-display">{s.t}</div>
                        <div className="cv-step-d">{s.d}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cv-foot font-mono">
                <span>2026-07-30 14:22:09 EDT</span>
                <span>LOG ID · CN-8F42-A19D-77E0</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* THREE MODES / OUTCOMES */}
      <section className="sec sec-out">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Three Modes. One Outcome.</Eyebrow>
            <h2 className="font-display sec-h2">However You Sell, Master Closer Keeps It Moving.</h2>
            <p className="sec-lead">Let AI run the call, hand a qualified buyer to your closer, or privately guide your rep through the hardest moments.</p>
          </div>

          <div className="outs">
            {[
              {
                n: "01", variant: "ai", icon: Bot, tag: "AI",
                h: "Close While Your Team Is Offline.",
                c: "AI runs the conversation, handles objections and sends the prospect the next step — even after hours.",
                rows: [
                  { icon: Check, label: "Call Completed" },
                  { icon: CreditCard, label: "Payment Link Sent" },
                ],
                panel: "orb",
              },
              {
                n: "02", variant: "hybrid", icon: PhoneForwarded, tag: "Hybrid",
                h: "Pick Up When The Buyer Is Ready.",
                c: "AI qualifies and warms the prospect, then briefs your closer before making a seamless live transfer.",
                rows: [
                  { icon: BadgeCheck, label: "Lead Qualified" },
                  { icon: PhoneForwarded, label: "Warm Transfer Ready" },
                ],
                panel: "handoff",
              },
              {
                n: "03", variant: "copilot", icon: Headphones, tag: "Copilot",
                h: "Never Let An Objection Stall The Call.",
                c: "Your rep stays in control while AI privately delivers the next best response in real time.",
                rows: [
                  { icon: AudioLines, label: "Price Objection Detected" },
                  { icon: Sparkles, label: "Response Ready" },
                ],
                panel: "whisper",
              },
            ].map((o) => (
              <article key={o.n} className={"out out-" + o.variant}>
                <span className="out-edge" />
                <div className="out-top">
                  <div className="out-head">
                    <span className="out-ico"><o.icon size={20} strokeWidth={2.2} /></span>
                    <span className="out-tag">{o.tag}</span>
                    <span className="out-num">{o.n}</span>
                  </div>
                  <h3 className="font-display out-h">{o.h}</h3>
                  <p className="out-c">{o.c}</p>
                </div>
                <div className="out-panel">
                  <div className="out-rows">
                    {o.rows.map((r) => (
                      <div key={r.label} className="out-row">
                        <span className="out-row-ico"><r.icon size={13} strokeWidth={2.6} /></span>
                        <span className="out-row-l">{r.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="out-viz">
                    {o.panel === "orb" && <MiniOrb size={62} variant="ai" />}
                    {o.panel === "handoff" && (
                      <div className="out-handoff">
                        <MiniOrb size={40} variant="ai" />
                        <span className="out-wire"><span className="out-pulse" /></span>
                        <span className="out-human"><Users size={18} strokeWidth={2.2} /></span>
                      </div>
                    )}
                    {o.panel === "whisper" && (
                      <div className="out-whisper">
                        <span className="out-mic"><Mic size={17} strokeWidth={2.2} /></span>
                        <MiniOrb size={54} variant="copilot" />
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="out-cta">
            <a href="#demo" className="btn-primary btn-lg">Try It Live <ArrowRight size={17} strokeWidth={2.4} /></a>
            <a href="#autonomy" className="out-link">See How The Three Modes Work <ArrowRight size={15} strokeWidth={2.4} /></a>
          </div>
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="sec sec-mist">
        <div className="wrap wrap-narrow">
          <div className="sec-head">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display sec-h2">The Questions Closers Ask First.</h2>
          </div>
          <div className="faq">{FAQS.map((f) => <FAQItem key={f.q} {...f} />)}</div>
        </div>
      </section>

      {/* FINAL CTA (dark) */}
      <section className="cta-final">
        <div className="cta-glow" />
        <div className="wrap cta-in">
          <Eyebrow light>Start Closing</Eyebrow>
          <h2 className="font-display cta-h">Your Next Call Could Be<br />Your Best Close.</h2>
          <p className="cta-sub">Set up in minutes. Pick your mode. Let it work.</p>
          <a href="#" className="btn-primary btn-lg">Get Started <ArrowRight size={17} strokeWidth={2.4} /></a>
          <div className="cta-note">No Contracts · Cancel Anytime</div>
        </div>
      </section>

      {/* FOOTER (dark, columns) */}
      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-brand">
            <div className="brand">
              <span className="brand-mark"><AudioLines size={16} strokeWidth={2.6} /></span>
              <span className="brand-word font-display" style={{ fontSize: 17, color: "#fff" }}>Master Closer</span>
            </div>
            <p className="foot-tag">AI closer, human closer, or both. On one platform.</p>
          </div>
          <div className="foot-cols">
            <div className="foot-col">
              <div className="foot-col-h font-mono">PRODUCT</div>
              <a href="#autonomy">The Three Modes</a>
              <a href="#demo">Live Demo</a>
              <a href="#setup">How It Works</a>
            </div>
            <div className="foot-col">
              <div className="foot-col-h font-mono">SOLUTIONS</div>
              <a href="#uses">By Industry</a>
              <a href="#autonomy">For Teams</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="foot-col">
              <div className="foot-col-h font-mono">COMPANY</div>
              <a href="#">About</a>
              <a href="#">Contact</a>
              <a href="#">Careers</a>
            </div>
            <div className="foot-col">
              <div className="foot-col-h font-mono">LEGAL</div>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Consent Policy</a>
            </div>
          </div>
        </div>
        <div className="wrap foot-bottom">© 2026 Master Closer. All Rights Reserved.</div>
      </footer>
    </div>
  );
}

/* ------------------------------- Styles ------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

.mc-root{
  --ink:#111318; --paper:#FFFFFF; --surface:#F4F5F7; --line:#D9DCE1;
  --signal:#CC0000; --signal-deep:#A30000; --muted:#5A616E; --success:#0E9F6E; --warning:#D97706;
  font-family:'Inter',system-ui,sans-serif; color:var(--ink);
  background:var(--paper); -webkit-font-smoothing:antialiased; line-height:1.5;
}
.mc-root *{box-sizing:border-box;}
.font-display{font-family:'Sora',system-ui,sans-serif; letter-spacing:-.03em; font-weight:700;}
.font-mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
.text-signal{color:var(--signal);}
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.wrap{max-width:1160px;margin:0 auto;padding:0 24px;}
.wrap-narrow{max-width:860px;}
a{text-decoration:none;color:inherit;}
.eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:16px;}
.eyebrow-light{color:#ff6b6b;}

/* buttons (pill) */
.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--signal);color:#fff;
  font-family:'Sora',sans-serif;font-weight:700;border:none;border-radius:999px;padding:11px 20px;
  cursor:pointer;transition:background .18s ease, transform .18s ease;font-size:.94rem;}
.btn-primary:hover{background:var(--signal-deep);transform:translateY(-1px);}
.btn-primary:disabled{opacity:.6;cursor:default;transform:none;}
.btn-ghost-light{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);color:#fff;
  font-family:'Sora',sans-serif;font-weight:700;border:1px solid rgba(255,255,255,.22);border-radius:999px;
  padding:11px 20px;cursor:pointer;transition:all .18s ease;font-size:.94rem;}
.btn-ghost-light:hover{background:rgba(255,255,255,.12);}
.btn-lg{padding:14px 26px;font-size:1rem;}

/* nav */
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);
  backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line);}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:68px;max-width:none;padding:0 34px;}
.nav-links{flex:0 1 auto;}
.brand{display:flex;align-items:center;gap:10px;}
.brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--signal);color:#fff;}
.brand-word{font-weight:800;font-size:19px;letter-spacing:-.02em;}
.nav-links{display:flex;gap:32px;font-size:.94rem;font-weight:500;color:#3a3f4a;}
.nav-links a:hover{color:var(--signal);}
.nav-cta{display:flex;align-items:center;gap:20px;}
.nav-login{font-family:'Sora',sans-serif;font-weight:700;font-size:.92rem;}
.nav-login:hover{color:var(--signal);}
@media(max-width:860px){.nav-links{display:none;}}
@media(max-width:1100px){.sec-h2{white-space:normal;}.hero-pills{flex-wrap:wrap;}}

/* hero (dark) */
.hero{position:relative;background:var(--ink);color:#fff;padding:86px 0 96px;overflow:hidden;}
.hero-glow{position:absolute;top:-160px;right:-120px;width:620px;height:620px;border-radius:50%;
  background:radial-gradient(circle,rgba(204,0,0,.28),transparent 62%);pointer-events:none;}
.hero-grid{max-width:1280px;position:relative;display:grid;grid-template-columns:1.02fr .98fr;gap:52px;align-items:center;}
.hero-h1{font-weight:800;font-size:clamp(3rem,5.8vw,4.6rem);line-height:1;letter-spacing:-.03em;margin:0 0 22px;color:#fff;}
.hero-sub{font-size:1.12rem;color:#B9BEC7;max-width:31em;margin:0 0 30px;}
.hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:30px;}
.hero-pills{display:flex;gap:12px;flex-wrap:nowrap;}
.hero-pill{flex:0 0 auto;white-space:nowrap;}
.hero-pill{display:flex;align-items:center;gap:9px;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:9px 15px;background:rgba(255,255,255,.04);}
.hero-pill-ico{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(204,0,0,.2);color:#ff6b6b;}
.hero-pill-t{font-size:.86rem;font-weight:700;color:#e7e9ee;}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:44px;}.hero{padding:52px 0 60px;}}

/* hero floating graphics */
.hero-stage{position:relative;}
.hero-card{position:relative;z-index:2;}
.float{position:absolute;z-index:3;background:#fff;border:1px solid var(--line);border-radius:14px;
  box-shadow:0 20px 44px -20px rgba(0,0,0,.5);padding:12px 14px;display:flex;align-items:center;gap:10px;}
.float-label{font-size:9px;letter-spacing:.12em;color:var(--muted);}
.float-big{font-size:1.15rem;font-weight:800;font-family:'Sora',sans-serif;color:var(--ink);line-height:1.1;}
.float-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;flex-shrink:0;}
.float-ico-red{background:#fbeaea;color:var(--signal);}
.float-ico-green{background:#e6f6ee;color:var(--success);}
.float-delta{font-size:.72rem;font-weight:700;color:var(--success);background:#e6f6ee;border-radius:999px;padding:2px 7px;}
.float-rate{top:-62px;left:-30px;animation:floaty 6s ease-in-out infinite;}
.float-deal{bottom:-76px;right:-24px;animation:floaty 6s ease-in-out infinite;animation-delay:1.4s;}
.float-whisper{top:38%;right:-46px;flex-direction:column;align-items:flex-start;gap:4px;max-width:190px;animation:floaty 7s ease-in-out infinite;animation-delay:.7s;}
.float-whisper-line{font-size:.82rem;font-weight:600;color:var(--ink);line-height:1.35;}
@keyframes floaty{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
@media(max-width:1040px){.float-whisper{display:none;}}
@media(max-width:900px){.float-rate{left:0;top:-20px;}.float-deal{right:0;}}
@media(max-width:520px){.float{display:none;}}

/* device card */
.device{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 90px -40px rgba(0,0,0,.6);overflow:hidden;}
.device-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);background:#fcfcfd;}
.rec-dot{width:8px;height:8px;border-radius:50%;background:var(--signal);animation:recFade 2.2s ease-in-out infinite;}
@keyframes recFade{0%,100%{opacity:1;}50%{opacity:.35;}}
.device-live{font-size:12px;font-weight:500;color:var(--signal);letter-spacing:.1em;}
.device-time{font-size:12px;color:var(--muted);}
.device-body{padding:18px;display:flex;flex-direction:column;gap:14px;}
.bubble{border-radius:13px;padding:13px 15px;font-size:.95rem;line-height:1.45;}
.bubble-them{background:var(--surface);color:#26262e;}
.bubble-name{font-size:10px;letter-spacing:.14em;color:var(--muted);margin-bottom:5px;}
.analysis{display:flex;flex-direction:column;gap:12px;}
.analysis-row{display:flex;gap:8px;flex-wrap:wrap;}
.chip{font-size:.76rem;font-weight:600;padding:5px 10px;border-radius:999px;background:#eef0f3;color:#4a505c;font-family:'Sora',sans-serif;}
.chip-red{background:#fbeaea;color:var(--signal);}
.conf{display:flex;align-items:center;gap:10px;}
.conf-label{font-size:10px;letter-spacing:.12em;color:var(--muted);white-space:nowrap;}
.conf-track{flex:1;height:6px;border-radius:999px;background:#e9ebef;overflow:hidden;}
.conf-fill{height:100%;background:var(--signal);border-radius:999px;transition:width .5s ease;}
.conf-num{font-size:12px;color:var(--ink);font-weight:500;}
.say{border:1px solid #f2d6d6;background:#fffafa;border-radius:13px;padding:14px 15px;}
.say-flat{background:#fff;}
.say-head{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
.say-tag{font-size:10px;letter-spacing:.1em;color:var(--signal);text-transform:uppercase;}
.say-line{margin:0;font-size:1rem;line-height:1.5;color:var(--ink);font-weight:500;}
.device-foot{padding:14px 18px;border-top:1px solid var(--line);background:#fcfcfd;}

/* segmented */
.seg{display:flex;background:#eef0f3;border-radius:999px;padding:4px;gap:4px;}
.seg-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;background:transparent;
  color:#57606e;font-family:'Sora',sans-serif;font-weight:700;font-size:.8rem;padding:8px 6px;border-radius:999px;cursor:pointer;transition:all .16s ease;white-space:nowrap;}
.seg-btn:hover{color:var(--ink);}
.seg-btn-on{background:#fff;color:var(--signal);box-shadow:0 1px 3px rgba(17,19,24,.12);}

/* strip */
.strip{border-bottom:1px solid var(--line);background:#fff;overflow:hidden;}
.strip-in{display:flex;align-items:center;gap:26px;padding:18px 24px;max-width:100%;}
.strip-label{font-size:11px;letter-spacing:.14em;color:var(--muted);white-space:nowrap;flex:0 0 auto;}
.strip-chip{font-size:.88rem;font-weight:700;color:#3a3f4a;padding:8px 16px;border:1px solid var(--line);border-radius:999px;background:#fcfcfd;white-space:nowrap;line-height:1.2;}
.marquee{position:relative;flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 60px,#000 calc(100% - 60px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 60px,#000 calc(100% - 60px),transparent 100%);}
.marquee::-webkit-scrollbar{display:none;}
.marquee-track{display:flex;width:max-content;animation:mc-marquee 40s linear infinite;}
.marquee:hover .marquee-track,.marquee:active .marquee-track{animation-play-state:paused;}
.marquee-set{display:flex;gap:10px;padding-right:10px;}
@keyframes mc-marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@media (prefers-reduced-motion: reduce){.marquee-track{animation:none;}}
@media (max-width:760px){.strip-in{flex-direction:column;align-items:flex-start;gap:12px;}}


/* sections */
.sec{padding:94px 0;}
.sec-mist{background:var(--surface);}
.sec-dark{background:var(--ink);}
.sec-head{max-width:none;margin:0 auto 54px;text-align:center;}
.sec-head p{max-width:760px;margin-left:auto;margin-right:auto;}
.sec-h2{white-space:nowrap;font-weight:800;font-size:clamp(2rem,4vw,2.85rem);line-height:1.06;letter-spacing:-.03em;margin:0 0 16px;}
.sec-lead{font-size:1.06rem;color:var(--muted);margin:0;line-height:1.55;}

/* modes */
.modes{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.mode-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;transition:border-color .2s ease, transform .2s ease, box-shadow .2s ease;}
.mode-card:hover{border-color:#e2c4c4;transform:translateY(-3px);box-shadow:0 20px 44px -28px rgba(17,19,24,.24);}
.mode-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.mode-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fbeaea;color:var(--signal);}
.mode-step{font-size:13px;color:#c3c8d0;font-weight:500;}
.mode-h{font-weight:800;font-size:1.3rem;margin:0 0 2px;}
.mode-plain{font-family:'Sora',sans-serif;font-weight:700;font-size:.86rem;color:var(--signal);margin-bottom:10px;}
.mode-b{font-size:.92rem;color:var(--muted);margin:0 0 16px;line-height:1.5;}
.mode-cue{border-top:1px solid var(--line);padding-top:14px;}
.mode-cue-tag{display:block;font-size:9px;letter-spacing:.12em;color:var(--signal);text-transform:uppercase;margin-bottom:7px;}
.mode-cue-line{margin:0;font-size:.9rem;line-height:1.5;color:#26262e;font-weight:500;}
@media(max-width:800px){.modes{grid-template-columns:1fr;}}

/* two views */
.views{display:grid;grid-template-columns:1fr 1fr;gap:22px;}
.view-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px;box-shadow:0 18px 40px -30px rgba(17,19,24,.22);}
.view-head{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
.view-ico{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;}
.view-ico-green{background:#e6f6ee;color:var(--success);}
.view-ico-red{background:#fbeaea;color:var(--signal);}
.view-title{font-size:1.1rem;font-weight:800;flex:1;}
.view-pill{font-size:10px;letter-spacing:.1em;padding:4px 9px;border-radius:999px;}
.view-pill-green{background:#e6f6ee;color:var(--success);}
.view-pill-red{background:#fbeaea;color:var(--signal);}
.view-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;}
.view-list li{display:flex;align-items:center;gap:11px;font-size:.98rem;color:#2a2f38;font-weight:500;}
.view-check-green{color:var(--success);flex-shrink:0;}
@media(max-width:800px){.views{grid-template-columns:1fr;}}

/* demo */
.demo{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 26px 64px -36px rgba(17,19,24,.28);}
.demo-controls{margin-bottom:16px;}
.demo-scenarios{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px;}
.scenario{font-size:.86rem;color:#454b57;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:8px 13px;cursor:pointer;transition:all .16s ease;font-family:'Inter',sans-serif;}
.scenario:hover{border-color:var(--signal);color:var(--signal);}
.demo-input{display:flex;gap:10px;margin-bottom:18px;}
.demo-input input{flex:1;border:1px solid var(--line);border-radius:999px;padding:12px 16px;font-size:.98rem;color:var(--ink);outline:none;transition:border-color .16s ease;font-family:'Inter',sans-serif;}
.demo-input input:focus{border-color:var(--signal);}
.demo-go{white-space:nowrap;}
.demo-output{min-height:96px;border-top:1px solid var(--line);padding-top:18px;}
.demo-empty{color:var(--muted);font-size:.96rem;}
.demo-result{animation:fade .3s ease;}
@keyframes fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}

/* dark demo section */
.sec-demo-dark{background:var(--ink);color:#fff;position:relative;overflow:hidden;isolation:isolate;}
.atmo{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:1;-webkit-mask-image:radial-gradient(120% 100% at 50% 50%,#000 60%,rgba(0,0,0,.6) 85%,transparent 100%);mask-image:radial-gradient(120% 100% at 50% 50%,#000 60%,rgba(0,0,0,.6) 85%,transparent 100%);}
.atmo-canvas{display:block;width:100%;height:100%;}

.sec-demo-dark .sec-h2{color:#fff;}
.sec-demo-dark .sec-lead{color:rgba(255,255,255,.66);}
.sec-demo-dark .eyebrow-light{color:#ff6b6b;}
.sec-demo-dark .demo{position:relative;z-index:1;background:rgba(16,16,18,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-color:rgba(255,255,255,.12);box-shadow:0 26px 64px -36px rgba(0,0,0,.65);}
.sec-demo-dark .scenario{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:rgba(255,255,255,.85);}
.sec-demo-dark .scenario:hover{border-color:var(--signal);color:#fff;background:rgba(255,255,255,.1);}
.sec-demo-dark .demo-input input{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.16);color:#fff;}
.sec-demo-dark .demo-input input::placeholder{color:rgba(255,255,255,.45);}
.sec-demo-dark .demo-input input:focus{border-color:var(--signal);}
.sec-demo-dark .demo-output{border-color:rgba(255,255,255,.12);}
.sec-demo-dark .demo-empty{color:rgba(255,255,255,.55);}
.sec-demo-dark .chip{background:rgba(255,255,255,.1);color:rgba(255,255,255,.9);}
.sec-demo-dark .chip-red{background:#fbeaea;color:var(--signal);}
.sec-demo-dark .conf-track{background:rgba(255,255,255,.12);}
.sec-demo-dark .say-flat{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);}
.sec-demo-dark .say-line{color:#fff;}

/* circular audio wave - ai thinking */
.demo-thinking{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:120px;}
.demo-wave{position:relative;display:flex;align-items:center;justify-content:center;gap:5px;height:60px;}
.demo-bar{width:4px;border-radius:99px;background:var(--signal);opacity:.85;height:14px;
  animation:demoBar 1.15s ease-in-out infinite;}
@keyframes demoBar{0%,100%{height:12px;opacity:.55;}50%{height:38px;opacity:1;}}

/* compare */
.compare{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;}
.cmp-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;border-bottom:1px solid var(--line);}
.cmp-row:last-child{border-bottom:none;}
.cmp-head{background:#fafbfc;}
.cmp-cap{padding:16px 20px;font-size:.94rem;font-weight:600;color:#2a2f38;}
.cmp-head .cmp-cap{font-size:11px;letter-spacing:.12em;color:var(--muted);font-weight:500;}
.cmp-col{padding:16px 12px;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:#57606e;}
.cmp-col-hi{background:#e6f6ee;color:var(--success);}
.cmark{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;}
.cmark-yes{background:#e6f6ee;color:var(--success);}
.cmark-no{background:#eef0f3;color:#b1b7c0;}
.cmark-part{width:9px;height:9px;border-radius:50%;background:var(--warning);}
@media(max-width:640px){.cmp-cap{font-size:.82rem;padding:13px 12px;}.cmp-col{padding:13px 4px;}}

/* caps */
.caps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
.cap{padding:6px 4px;}
.cap-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fbeaea;color:var(--signal);margin-bottom:16px;}
.cap-h{font-weight:800;font-size:1.08rem;margin:0 0 7px;}
.cap-d{font-size:.92rem;color:var(--muted);margin:0;line-height:1.5;}
@media(max-width:980px){.caps{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.caps{grid-template-columns:1fr;}}

/* uses */
.uses{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.use{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;transition:transform .2s ease, box-shadow .2s ease;}
.use:hover{transform:translateY(-3px);box-shadow:0 18px 40px -26px rgba(17,19,24,.3);}
.use-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.use-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#fbeaea;color:var(--signal);}
.use-t{font-weight:800;font-size:1.04rem;}
.use-o{font-size:.9rem;color:#3a3f4a;line-height:1.45;background:#fbeaea60;border-radius:11px;padding:12px 13px;}
.use-o-tag{display:block;font-size:9px;letter-spacing:.14em;color:var(--signal);margin-bottom:6px;}
@media(max-width:980px){.uses{grid-template-columns:repeat(2,1fr);}}
@media(max-width:520px){.uses{grid-template-columns:1fr;}}

/* loop */
.loop{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:22px;max-width:1000px;margin:0 auto;}
.loop-line{position:absolute;top:29px;left:12%;right:12%;height:2px;background:linear-gradient(90deg,#f0cccc,var(--signal),#f0cccc);z-index:0;}
.loop-step{position:relative;z-index:1;text-align:center;}
.loop-node{position:relative;width:58px;height:58px;margin:0 auto 18px;border-radius:50%;background:#fff;border:2px solid var(--signal);display:grid;place-items:center;color:var(--signal);box-shadow:0 6px 18px -8px rgba(204,0,0,.4);}
.loop-num{position:absolute;top:-8px;right:-8px;background:var(--ink);color:#fff;font-size:10px;font-weight:500;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;}
.loop-h{font-weight:800;font-size:1.08rem;margin:0 0 8px;}
.loop-d{font-size:.9rem;color:var(--muted);margin:0;line-height:1.5;}
@media(max-width:800px){.loop{grid-template-columns:1fr;gap:28px;}.loop-line{display:none;}}

/* compliance */
.sec-comply{padding-top:72px;}
.comply{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.comply-copy .sec-lead{margin-bottom:28px;text-align:left;max-width:560px;}
.comply-copy .sec-h2{text-align:left;white-space:normal;}
.comply-copy .eyebrow{text-align:left;}
.comply-list{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;}
.comply-item{display:flex;align-items:center;gap:9px;color:rgba(255,255,255,.9);font-size:.95rem;font-weight:600;font-family:'Sora',sans-serif;}

/* consent verification UI */
.cv{position:relative;}
.cv-glow{position:absolute;inset:-8% -6%;background:radial-gradient(closest-side,rgba(204,0,0,.28),transparent 72%);filter:blur(28px);pointer-events:none;}
.cv-card{position:relative;border:1px solid rgba(204,0,0,.34);border-radius:22px;background:#111112;box-shadow:0 30px 70px -30px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.05);padding:26px 26px 20px;color:#fff;}
.cv-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.09);}
.cv-title{display:flex;align-items:center;gap:12px;}
.cv-ico{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:rgba(204,0,0,.16);border:1px solid rgba(204,0,0,.4);color:#ff5a5a;}
.cv-h{font-weight:800;font-size:1.12rem;letter-spacing:-.01em;}
.cv-sub{font-size:10px;letter-spacing:.16em;color:rgba(255,255,255,.42);margin-top:3px;}
.cv-badge{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:7px 12px;border-radius:999px;background:rgba(204,0,0,.14);border:1px solid rgba(204,0,0,.45);color:#ff7b7b;white-space:nowrap;}
.cv-meta{display:flex;gap:10px;flex-wrap:wrap;padding:16px 0 6px;}
.cv-meta-item{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:600;color:rgba(255,255,255,.74);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:8px 12px;}
.cv-steps{position:relative;padding:14px 0 6px;}
.cv-line{position:absolute;left:13px;top:26px;bottom:34px;width:2px;background:linear-gradient(180deg,rgba(45,190,120,.65),rgba(204,0,0,.5));border-radius:2px;}
.cv-step{position:relative;display:flex;gap:14px;align-items:flex-start;padding:11px 0;}
.cv-dot{position:relative;z-index:1;flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;}
.cv-dot-ok{background:rgba(45,190,120,.16);border:1px solid rgba(45,190,120,.55);color:#3ddc91;}
.cv-dot-lock{background:rgba(204,0,0,.16);border:1px solid rgba(204,0,0,.5);color:#ff7b7b;}
.cv-step-t{font-weight:700;font-size:.98rem;}
.cv-step-d{font-size:.84rem;color:rgba(255,255,255,.52);margin-top:2px;line-height:1.45;}
.cv-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09);font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.4);}
@media(max-width:900px){.comply{grid-template-columns:1fr;gap:32px;}.comply-list{grid-template-columns:1fr;}}


/* outcome cards */
.sec-out{background:#f6f3f1;padding:72px 0 78px;}
.outs{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-items:stretch;}
.out{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);
  border-radius:24px;overflow:hidden;transition:transform .25s ease, box-shadow .25s ease, border-color .25s ease;
  box-shadow:0 18px 40px -32px rgba(17,19,24,.35);}
.out:hover{transform:translateY(-5px);border-color:#e6c8c8;
  box-shadow:0 30px 60px -34px rgba(196,32,32,.34), 0 0 0 1px rgba(196,32,32,.06);}
.out-edge{position:absolute;top:0;left:0;right:0;height:3px;background:var(--signal);opacity:0;transition:opacity .25s ease;}
.out:hover .out-edge{opacity:1;}
.out-top{padding:28px 26px 26px;flex:1;}
.out-head{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
.out-ico{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#fbeaea;color:var(--signal);flex:0 0 auto;}
.out-tag{font-size:.74rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a9099;}
.out-num{margin-left:auto;font-family:var(--font-display,inherit);font-weight:800;font-size:1.1rem;color:#dfe3e8;}
.out-h{font-weight:800;font-size:1.24rem;line-height:1.24;letter-spacing:-.02em;margin:0 0 10px;color:#14171c;}
.out-c{font-size:.96rem;line-height:1.6;color:var(--muted);margin:0;}
.out-panel{background:#15181d;padding:20px 22px 22px;display:flex;flex-direction:column;gap:16px;position:relative;}
.out-rows{display:flex;flex-direction:column;gap:9px;position:relative;z-index:1;}
.out-row{display:flex;align-items:center;gap:9px;}
.out-row-ico{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;
  background:rgba(196,32,32,.18);color:#ff6b6b;flex:0 0 auto;}
.out-row-l{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#cfd4db;}
.out-viz{position:relative;z-index:1;min-height:70px;display:grid;place-items:center;}
.out-handoff{display:flex;align-items:center;gap:12px;}
.out-wire{position:relative;width:64px;height:2px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden;}
.out-pulse{position:absolute;top:0;left:0;width:22px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,#ff5a5a,transparent);animation:outTravel 2.2s ease-in-out infinite;}
@keyframes outTravel{0%{transform:translateX(-24px);}100%{transform:translateX(66px);}}
.out-human{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;
  border:1.5px dashed rgba(255,255,255,.35);color:#e7eaef;}
.out-whisper{display:flex;align-items:center;gap:12px;}
.out-mic{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;
  background:rgba(255,255,255,.07);color:#e7eaef;}
.out-wsp{display:flex;align-items:center;gap:5px;}
.out-wsp span{width:6px;height:6px;border-radius:50%;background:#ff5a5a;opacity:.35;animation:outWsp 1.5s ease-in-out infinite;}
.out-wsp span:nth-child(2){animation-delay:.2s;}
.out-wsp span:nth-child(3){animation-delay:.4s;}
@keyframes outWsp{0%,100%{opacity:.25;transform:scale(.85);}50%{opacity:1;transform:scale(1.15);}}
.out-cta{display:flex;align-items:center;justify-content:center;gap:22px;margin-top:44px;flex-wrap:wrap;}
.out-link{display:inline-flex;align-items:center;gap:6px;font-size:.95rem;font-weight:700;color:var(--signal);text-decoration:none;}
.out-link:hover{text-decoration:underline;}
@media(max-width:980px){.outs{grid-template-columns:1fr;}}
@media(prefers-reduced-motion:reduce){
  .out-pulse,.out-wsp span{animation:none;}
  .out:hover{transform:none;}
}


/* faq */
.faq{display:flex;flex-direction:column;gap:12px;}
.faq-item{background:#fff;border:1px solid var(--line);border-radius:14px;padding:4px 20px;}
.faq-q{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:18px 0;font-size:1.04rem;font-weight:700;color:var(--ink);text-align:left;gap:16px;font-family:'Sora',sans-serif;letter-spacing:-.01em;}
.faq-chev{color:var(--muted);transition:transform .2s ease;flex-shrink:0;}
.faq-chev-open{transform:rotate(180deg);color:var(--signal);}
.faq-a{margin:0;padding:0 0 20px;color:var(--muted);font-size:.98rem;line-height:1.6;max-width:64ch;}

/* final cta (dark) */
.cta-final{position:relative;background:var(--ink);color:#fff;padding:104px 0;text-align:center;overflow:hidden;}
.cta-glow{position:absolute;bottom:-200px;left:50%;transform:translateX(-50%);width:700px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(204,0,0,.26),transparent 60%);pointer-events:none;}
.cta-in{position:relative;max-width:680px;margin:0 auto;display:flex;flex-direction:column;align-items:center;}
.cta-in .eyebrow{margin-bottom:14px;}
.cta-h{font-weight:800;font-size:clamp(2.1rem,4.6vw,3.2rem);line-height:1.05;letter-spacing:-.03em;margin:0 0 16px;color:#fff;}
.cta-sub{font-size:1.12rem;color:#B9BEC7;margin:0 0 28px;}
.cta-note{font-size:.86rem;color:rgba(255,255,255,.5);margin-top:16px;font-weight:600;font-family:'Sora',sans-serif;}

/* footer (dark, columns) */
.foot{background:var(--ink);color:#fff;padding:56px 0 30px;border-top:1px solid rgba(255,255,255,.08);}
.foot-in{max-width:none;padding-left:34px;padding-right:34px;display:grid;grid-template-columns:1.3fr 2fr;gap:40px;padding-bottom:36px;border-bottom:1px solid rgba(255,255,255,.08);}
.foot-tag{color:#9aa0ab;font-size:.92rem;margin:14px 0 0;max-width:24em;}
.foot-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
.foot-col{display:flex;flex-direction:column;gap:11px;}
.foot-col-h{font-size:10px;letter-spacing:.14em;color:#6b7280;margin-bottom:3px;}
.foot-col a{font-size:.9rem;color:#c3c8d0;}
.foot-col a:hover{color:#fff;}
.foot-bottom{max-width:none;padding-left:34px;padding-right:34px;padding-top:22px;font-size:.84rem;color:#6b7280;}
@media(max-width:820px){.foot-in{grid-template-columns:1fr;gap:30px;}.foot-cols{grid-template-columns:repeat(2,1fr);}}


/* feature stories (zigzag) */
.sec-caps-head{padding-bottom:0;}
.sec-story{padding:64px 0;}
.sec-tight{padding-top:56px;}
.story{display:grid;grid-template-columns:1fr 1.05fr;gap:70px;align-items:center;}
.story-flip .story-copy{order:2;}
.story-flip .story-vis{order:1;}
.story-kick{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--signal);margin-bottom:16px;}
.story-h{font-weight:800;font-size:clamp(1.6rem,2.7vw,2.3rem);line-height:1.1;letter-spacing:-.03em;margin:0 0 16px;white-space:pre-line;}
.story-d{font-size:1.05rem;color:var(--muted);line-height:1.6;margin:0 0 22px;max-width:34em;}
.story-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px;}
.story-list li{display:flex;align-items:flex-start;gap:11px;font-size:.97rem;font-weight:500;color:#2b3038;}
.story-tick{flex:0 0 auto;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;
  background:#e6f6ee;color:var(--green);margin-top:1px;}
.story-vis{position:relative;}
.fmock{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;
  box-shadow:0 22px 50px -26px rgba(12,14,20,.34);}
.fmock-bar{display:flex;align-items:center;gap:9px;padding:13px 16px;border-bottom:1px solid var(--line);background:#fafafb;}
.fmock-live{font-size:11px;letter-spacing:.12em;color:#57606e;}
.fmock-ico{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:#fbeaea;color:var(--signal);}
.fmock-body{padding:18px;display:flex;flex-direction:column;gap:14px;}
.fmock-note{font-size:10px;letter-spacing:.14em;color:#9aa0ab;}
.fmock-quote{font-size:1rem;font-weight:600;color:#1b1f26;margin:0;line-height:1.45;}
.fmock-rows{display:flex;flex-direction:column;gap:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.fmock-row{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;font-size:.9rem;color:#57606e;border-bottom:1px solid var(--line);}
.fmock-row:last-child{border-bottom:none;}
.fmock-row b{font-size:.8rem;font-family:'Sora',sans-serif;font-weight:700;}
.wavebox{display:flex;align-items:center;gap:4px;height:64px;padding:0 2px;}
.wavebar{flex:1;background:var(--signal);border-radius:3px;height:22%;opacity:.85;
  animation:wv 1.1s ease-in-out infinite;}
@keyframes wv{0%,100%{height:16%}50%{height:92%}}
.xfer{display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 0 4px;}
.xfer-side{display:flex;flex-direction:column;align-items:center;gap:8px;}
.xfer-av{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:#f1f2f5;color:#57606e;}
.xfer-av-ai{background:#fbeaea;color:var(--signal);}
.xfer-name{font-size:.9rem;font-weight:700;}
.xfer-arrow{color:var(--signal);}
.pay{border:1px solid var(--line);border-radius:14px;padding:18px;background:#fafafb;text-align:center;}
.pay-label{font-size:10px;letter-spacing:.14em;color:#9aa0ab;}
.pay-amt{font-size:2.1rem;font-weight:800;letter-spacing:-.03em;margin:6px 0 2px;}
.pay-meta{font-size:.86rem;color:var(--muted);margin-bottom:14px;}
.pay-btn{display:inline-block;background:var(--signal);color:#fff;font-weight:700;font-size:.88rem;
  padding:10px 26px;border-radius:999px;}
.caps-more{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;}
.caps-cta{display:flex;justify-content:center;margin-top:44px;}
@media(max-width:900px){.story{grid-template-columns:1fr;gap:34px;}
  .story-flip .story-copy{order:1;}.story-flip .story-vis{order:2;}
  .caps-more{grid-template-columns:repeat(2,1fr);}}

/* ---- unified mode sections (AI / Hybrid / Copilot) ---- */
.modes-band{position:relative;isolation:isolate;background:#faf8f7;
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;}
.modes-glow{position:absolute;border-radius:50%;pointer-events:none;z-index:0;filter:blur(90px);}
.modes-glow-a{top:4%;left:-10%;width:560px;height:560px;background:rgba(204,0,0,.09);}
.modes-glow-b{bottom:2%;right:-12%;width:620px;height:620px;background:rgba(140,0,0,.07);}
.modes-band .sec-story{position:relative;z-index:1;padding:76px 0;}
.modes-band .sec-story + .sec-story{padding-top:0;}
.modes-band .story{grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.modes-band .story-vis .fmock{max-width:520px;margin:0 auto;border-radius:20px;
  box-shadow:0 26px 60px -30px rgba(90,0,0,.35),0 2px 0 rgba(255,255,255,.6) inset;}
.modes-band .story-copy{max-width:520px;}
.modes-band .story-kick{letter-spacing:.16em;font-size:11.5px;}

/* mesh voice orb — the single AI mark, small functional scale */
.morb{position:relative;display:grid;place-items:center;flex:0 0 auto;animation:morbBreathe 5s ease-in-out infinite;}
.morb svg{display:block;overflow:visible;}
.morb-l{fill:none;stroke:var(--signal);stroke-width:1.3;transform-origin:50% 50%;}
.morb-l1{opacity:.45;animation:morbSpinA 22s linear infinite;}
.morb-l2{opacity:.65;stroke-width:1.15;animation:morbSpinB 16s linear infinite;}
.morb-l3{opacity:.85;stroke-width:1;animation:morbSpinA 11s linear infinite;}
@keyframes morbBreathe{0%,100%{transform:scale(1);}50%{transform:scale(1.045);}}
@keyframes morbSpinA{to{transform:rotate(360deg);}}
@keyframes morbSpinB{to{transform:rotate(-360deg);}}

/* hybrid — two endpoints, one signal path */
.mlink{position:relative;display:flex;align-items:center;justify-content:center;gap:0;}
.mlink-node{width:10px;height:10px;border-radius:50%;flex:none;}
.mlink-ai{background:var(--signal);}
.mlink-hu{background:#8a919d;}
.mlink-path{position:relative;flex:1;height:1.5px;background:linear-gradient(90deg,rgba(204,0,0,.45),rgba(138,145,157,.4));overflow:hidden;}
.mlink-pulse{position:absolute;top:0;left:0;width:26px;height:100%;border-radius:2px;
  background:var(--signal);animation:mlinkGo 2.6s ease-in-out infinite;}
@keyframes mlinkGo{0%{transform:translateX(-30px);opacity:0;}15%{opacity:1;}
  85%{opacity:1;}100%{transform:translateX(320px);opacity:0;}}

/* copilot — compact whisper waveform */
.mwave{display:flex;align-items:center;justify-content:center;gap:3px;}
.mwave span{width:3px;height:8px;border-radius:99px;background:var(--signal);opacity:.75;
  animation:mwaveB 1.3s ease-in-out infinite;}
@keyframes mwaveB{0%,100%{height:7px;opacity:.5;}50%{height:100%;opacity:.95;}}

@media(prefers-reduced-motion:reduce){
  .morb,.morb-l,.mlink-pulse,.mwave span,.demo-bar,.rec-dot{animation:none !important;}
}
.orb-row{display:flex;justify-content:center;padding:4px 0 2px;}

/* call card chrome */
.fmock-time{margin-left:2px;font-size:11px;color:#8a919d;letter-spacing:.08em;}
.fmock-status{margin-left:auto;font-size:10.5px;letter-spacing:.14em;color:var(--signal);}
.line{border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-size:.95rem;
  line-height:1.5;color:#1b1f26;background:#fff;}
.line-name{font-size:9.5px;letter-spacing:.16em;color:#9aa0ab;margin-bottom:5px;}
.line-them{background:#f6f6f7;}
.line-ai{border-color:rgba(204,0,0,.28);background:#fffafa;}
.line-ai .line-name{color:var(--signal);}
.say-note{margin-top:8px;font-size:9.5px;letter-spacing:.14em;color:#9aa0ab;}
.prob{border:1px solid var(--line);border-radius:14px;padding:13px 14px;background:#fafafb;}
.prob-top{display:flex;align-items:center;justify-content:space-between;}
.prob-lbl{font-size:9.5px;letter-spacing:.16em;color:#8a919d;}
.prob-val{font-size:1.05rem;font-weight:800;color:var(--signal);}
.prob-track{height:6px;border-radius:99px;background:#eceef1;overflow:hidden;margin:9px 0 8px;}
.prob-fill{display:block;height:100%;border-radius:99px;background:var(--signal);
  animation:probIn 1.4s cubic-bezier(.2,.8,.2,1) both;}
@keyframes probIn{from{width:0;}}
.prob-stage{font-size:9.5px;letter-spacing:.14em;color:#57606e;}
.fmock-foot{display:flex;padding:12px 14px;border-top:1px solid var(--line);background:#fafafb;}
.stg{display:flex;align-items:center;justify-content:space-between;width:100%;gap:4px;}
.stg-i{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;}
.stg-dot{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;
  border:1px solid var(--line);background:#fff;color:#b9bec7;}
.stg-num{font-size:9px;font-weight:700;line-height:1;}
.stg-lbl{font-size:9.5px;letter-spacing:.05em;color:#a2a8b2;font-weight:600;}
.stg-done .stg-dot{border-color:#bfe6d1;background:#e6f6ee;color:var(--green);}
.stg-done .stg-lbl{color:#6d7480;}
.stg-now .stg-dot{border-color:var(--signal);background:var(--signal);color:#fff;}
.stg-now .stg-lbl{color:var(--signal);font-weight:700;}
@keyframes stgP{0%,100%{box-shadow:0 0 0 3px rgba(204,0,0,.10);}50%{box-shadow:0 0 0 6px rgba(204,0,0,.16);}}
@media(max-width:900px){.modes-band .story{grid-template-columns:1fr;}
  .modes-band .sec-story{padding:52px 0;}
  .modes-band .sec-story + .sec-story{padding-top:0;}
  .stg-lbl{font-size:8.5px;}}

/* ---- industry objection explorer ---- */
.sec-inds{background:#faf8f7;overflow:hidden;}
.indx{margin-top:8px;}
.indrows{display:flex;flex-direction:column;gap:12px;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);}
.indrow{overflow:hidden;}
.indtrack{display:flex;width:max-content;animation:indm 68s linear infinite;}
.indtrack-rev{animation-direction:reverse;}
.indset{display:flex;gap:10px;padding-right:10px;}
@keyframes indm{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.indrows:hover .indtrack,.indrows-lock .indtrack{animation-play-state:paused;}
.indp{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;cursor:pointer;
  border:1px solid var(--line);background:#fff;color:#4b535f;border-radius:999px;
  padding:9px 16px;font-size:.88rem;font-weight:600;font-family:inherit;
  transition:border-color .18s,background .18s,color .18s;}
.indp svg{color:#9aa0ab;transition:color .18s;}
.indp:hover{border-color:#d7d9de;color:#1b1f26;}
.indp-on{border-color:var(--signal);background:#fdecec;color:var(--signal);}
.indp-on svg{color:var(--signal);}

.indpanel{margin-top:34px;background:#14161a;border:1px solid rgba(204,0,0,.28);
  border-radius:24px;overflow:hidden;position:relative;
  box-shadow:0 30px 70px -40px rgba(0,0,0,.6),0 0 60px -30px rgba(204,0,0,.45);
  animation:indIn .38s cubic-bezier(.2,.8,.2,1) both;}
@keyframes indIn{from{opacity:0;transform:translateY(10px);}}
.indpanel-in{display:grid;grid-template-columns:1fr 1fr;}
.indside{position:relative;padding:40px 42px;min-width:0;}
.indside + .indside{border-left:1px solid rgba(255,255,255,.09);}
.indside-ai{background:rgba(255,255,255,.02);}
.indhead{display:flex;align-items:center;gap:12px;margin-bottom:22px;position:relative;}
.indhead-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;
  background:rgba(204,0,0,.14);color:#ff6a5e;}
.indhead-t{font-size:1.05rem;font-weight:700;color:#fff;}
.indlbl{font-size:10px;letter-spacing:.16em;color:#7d838d;margin-bottom:14px;display:block;}
.indlbl-red{color:#ff6a5e;margin-bottom:0;}
.indquote{font-size:clamp(1.25rem,1.9vw,1.6rem);font-weight:700;line-height:1.32;
  letter-spacing:-.02em;color:#fff;margin:0 0 20px;}
.indtags{display:flex;flex-wrap:wrap;gap:8px;}
.indtag{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#a7adb7;
  border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 11px;}
.indresp{position:relative;font-size:1.02rem;line-height:1.6;color:#e6e8ec;margin:0 0 22px;}
.indmeta{position:relative;display:flex;flex-wrap:wrap;gap:10px;}
.indstrat,.indnext{display:inline-flex;align-items:center;gap:7px;font-size:9.5px;
  letter-spacing:.14em;border-radius:999px;padding:7px 13px;}
.indstrat{color:#ff6a5e;background:rgba(204,0,0,.14);border:1px solid rgba(204,0,0,.3);}
.indnext{color:#a7adb7;border:1px solid rgba(255,255,255,.14);}
.indfoot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;
  margin-top:22px;font-size:.94rem;color:var(--muted);text-align:center;}
.indlink{display:inline-flex;align-items:center;gap:6px;color:var(--signal);font-weight:700;
  border-bottom:1px solid rgba(204,0,0,.35);}
@media(max-width:860px){
  .indrows{gap:0;}
  .indrow:last-child{display:none;}
  .indrow{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
  .indrow::-webkit-scrollbar{display:none;}
  .indtrack{animation:none;}
  .indset:last-child{display:none;}
  .indpanel-in{grid-template-columns:1fr;}
  .indside{padding:28px 22px;}
  .indside + .indside{border-left:none;border-top:1px solid rgba(255,255,255,.09);}
}
@media(prefers-reduced-motion:reduce){.indtrack{animation:none;}.indrow{overflow-x:auto;}}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
`;
