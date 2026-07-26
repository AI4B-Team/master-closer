// @ts-nocheck
import React, { useState } from "react";
import {
  Crosshair, ArrowRight, Play, Check, Minus, Building2, Home, Sun, ShieldCheck,
  Users, Car, Wrench, Heart, Mic, PhoneForwarded, Bot, CreditCard,
  Database, Languages, GraduationCap, ChevronDown, Lock, Loader2, PhoneCall,
  Ear, Eye, Radio, LayoutDashboard, BookOpen, Brain, Wand2, BarChart3, Library,
  Video, Smartphone, Globe, MousePointerClick, TrendingUp
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Master Closer — landing page + live copilot demo                   */
/*  White + Red (#CC0000). Hanken Grotesk / Inter / DM Mono.           */
/*  Title Case throughout. CloudTalk-clean, real product graphics.     */
/* ------------------------------------------------------------------ */

const MODES = [
  {
    key: "ai", label: "Full AI", icon: Bot,
    blurb: "The Agent Runs The Whole Call — Discovery, Demo, Close, And Payment.",
    tag: "AI Speaking To Prospect",
    cue: "Totally fair on price. If I lock today's rate and email the agreement now, are you good to start?",
  },
  {
    key: "hybrid", label: "Hybrid Handoff", icon: PhoneForwarded,
    blurb: "AI Warms The Lead, Then Live-Transfers To A Human And Stays On To Assist.",
    tag: "AI Briefing Your Closer",
    cue: "Warm lead, budget confirmed, one price objection left. Transferring you in — take the close.",
  },
  {
    key: "copilot", label: "Human + Copilot", icon: Mic,
    blurb: "Your Rep Runs The Call. The Copilot Whispers The Next Line, Only They See It.",
    tag: "Whispered To Your Rep",
    cue: "Say: \"When you say it's a lot, is it the total or the monthly that gives you pause?\"",
  },
];

function Eyebrow({ children, variant = "classic", num }) {
  if (variant === "rule") {
    return (
      <div className="eyebrow eyebrow-rule">
        <span className="eb-line" />
        <span className="eb-text text-signal">{children}</span>
        <span className="eb-line" />
      </div>
    );
  }
  if (variant === "num") {
    return (
      <div className="eyebrow eyebrow-num">
        <span className="eb-num font-mono">{num}</span>
        <span className="eb-slash">/</span>
        <span className="eb-text text-signal">{children}</span>
      </div>
    );
  }
  if (variant === "dot") {
    return (
      <div className="eyebrow eyebrow-dot">
        <span className="eb-dot" />
        <span className="eb-text text-signal">{children}</span>
      </div>
    );
  }
  if (variant === "bracket") {
    return (
      <div className="eyebrow eyebrow-bracket font-mono">
        <span className="eb-brack">[</span>
        <span className="eb-text text-signal">{children}</span>
        <span className="eb-brack">]</span>
      </div>
    );
  }
  return <div className="eyebrow text-signal">{children}</div>;
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
  hybrid: { tag: "AI Briefing Your Closer", line: "Warm lead, budget confirmed, one pricing objection left. Transferring you in now — take the close." },
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
            <Crosshair size={14} strokeWidth={2.4} className="text-signal" />
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

function LiveDemo() {
  const [mode, setMode] = useState("copilot");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const modeMeta = {
    ai: { persona: "You ARE the AI closer speaking directly to the prospect on the call.", lineDesc: "the exact words the AI should say next to the prospect, moving naturally toward the close and, if it fits, offering to send the agreement or a payment link", resultTag: "AI Says To Prospect" },
    hybrid: { persona: "You are the AI that warmed up this lead and is about to live-transfer to a human closer.", lineDesc: "a short, private briefing line spoken to the human closer summarizing where the deal stands and the one move to make on the close", resultTag: "AI Briefs Your Closer" },
    copilot: { persona: "You are a silent copilot whispering to a human sales rep. Only the rep can see this.", lineDesc: "the exact words the rep should say next — natural, spoken, no preamble", resultTag: "Whispered To Your Rep" },
  };

  async function run(text) {
    const prospect = (text ?? input).trim();
    if (!prospect) return;
    setInput(prospect); setLoading(true); setError(""); setResult(null);
    const m = modeMeta[mode];
    const prompt =
      `You are Master Closer, a real-time sales AI. ${m.persona}\n\n` +
      `The prospect just said: "${prospect}"\n\n` +
      `Respond with ONLY a JSON object (no markdown, no backticks, no commentary) with exactly these keys:\n` +
      `"objection": a 2-4 word label for what's really going on,\n` +
      `"tone": 1-2 words for the prospect's tone,\n` +
      `"confidence": an integer 0-100 estimate of close probability if the next move lands,\n` +
      `"line": ${m.lineDesc}. Keep it under 45 words, conversational, never pushy or manipulative.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (e) {
      setError("Couldn't Reach The Closer Just Now. Try Again In A Moment.");
    } finally { setLoading(false); }
  }

  return (
    <div className="demo">
      <div className="demo-controls"><Segmented value={mode} onChange={setMode} /></div>
      <div className="demo-scenarios">
        {SCENARIOS.map((s) => (
          <button key={s} className="scenario" onClick={() => run(s)}>{s}</button>
        ))}
      </div>
      <div className="demo-input">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Type What The Prospect Just Said…" aria-label="What The Prospect Said" />
        <button className="btn-primary demo-go" onClick={() => run()} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} strokeWidth={2.4} />}
          <span>Close It</span>
        </button>
      </div>
      <div className="demo-output" aria-live="polite">
        {!result && !loading && !error && (
          <div className="demo-empty">Pick An Objection Or Type Your Own. Master Closer Reads It Live And Hands Back The Move.</div>
        )}
        {loading && (<div className="demo-empty flex items-center gap-2"><Loader2 size={15} className="spin" /> Reading The Room…</div>)}
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
                <Crosshair size={14} strokeWidth={2.4} className="text-signal" />
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
  { icon: Mic, t: "Live Copilot", d: "The next line appears before the prospect stops talking." },
  { icon: Bot, t: "AI Voice Agent", d: "A natural voice runs the whole call end to end." },
  { icon: PhoneForwarded, t: "Warm Transfer", d: "AI hands the call to a human and stays to assist." },
  { icon: CreditCard, t: "Close & Collect", d: "Send the agreement and payment link before you hang up." },
  { icon: Database, t: "CRM Write-Back", d: "Outcome, next step, and summary logged automatically." },
  { icon: ShieldCheck, t: "Consent Built In", d: "Disclosure and per-state rules handled out of the box." },
  { icon: GraduationCap, t: "Practice Mode", d: "Spar with an AI prospect before the real call." },
  { icon: Languages, t: "32 Languages", d: "Run and close conversations in native voice anywhere." },
];

const USES = [
  { icon: Building2, t: "SaaS", o: "We just signed with a competitor last month." },
  { icon: Home, t: "Real Estate", o: "Rates are insane right now, it doesn't feel right." },
  { icon: Sun, t: "Solar", o: "My neighbor's panels were a nightmare, why risk it?" },
  { icon: ShieldCheck, t: "Insurance", o: "Had a claim denied last year. You're all the same." },
  { icon: Users, t: "Recruiting", o: "Last agency burned us for $30K. Not again." },
  { icon: Car, t: "Automotive", o: "I can get it $4,000 cheaper across town." },
  { icon: Wrench, t: "Home Services", o: "Yours is the highest quote by far." },
  { icon: Heart, t: "Dating (Practice)", o: "Rehearse the ask before it counts, never live on the date." },
];

const STEPS = [
  { n: "01", t: "Feed It Your Offer", d: "Drop In Your Script, Pricing, And Objections. It Learns What You Sell And How You Win." },
  { n: "02", t: "Set The Autonomy", d: "Slide From Full AI To Hybrid Handoff To Human-Plus-Copilot Per Campaign Or Per Rep." },
  { n: "03", t: "Go Live & Get Paid", d: "It Runs Or Assists The Call, Sends The Agreement, And Collects Payment. Then Logs It All." },
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
  { q: "How Accurate Is It?", a: "In live tests across SaaS, solar, and home services, Master Closer names the true objection correctly on more than nine calls out of ten and suggests a line closers ship without editing about 80% of the time. Accuracy climbs after you feed in your own scripts and top objections." },
  { q: "Does Master Closer Record My Calls?", a: "Only if you choose to. The copilot works from a live transcript that is processed and can be discarded. When you turn recording on, every participant is told the call is being recorded, the same way a video platform announces it." },
  { q: "Can My Team Use It?", a: "Yes. Add reps, assign autonomy per seat, share knowledge and scripts across the org, and see per-rep analytics. Managers get roll-ups, closers get their own private view." },
  { q: "Can I Train It On My Own Scripts?", a: "That's the point. Drop in your offer, pricing, objections, top-performing calls, and playbooks. Master Closer learns your voice, your framing, and your close — and gets sharper every week." },
  { q: "How Fast Are Responses?", a: "The next line appears in under 400 milliseconds from the moment the prospect stops talking. Fast enough that your rep is never waiting, and the prospect never notices a pause." },
  { q: "Does It Work With Accents?", a: "Yes. The transcription engine is tuned across 32 languages and dozens of regional accents — Scottish, Indian, Nigerian, Southern US, thick New York, you name it. If a human closer would understand it, Master Closer will too." },
  { q: "Is This Compliant In Two-Party Consent States?", a: "Consent is built in as a feature, not an afterthought. Master Closer can post an in-meeting disclosure and knows the rules state by state, so you stay above board. It is not legal advice, and you should confirm your setup with counsel." },
  { q: "Can The AI Really Close And Take Payment?", a: "Yes. In Full AI or Hybrid mode it can send an agreement and a payment link mid-call. You decide how far it goes and where a human takes over." },
  { q: "What Is The Autonomy Slider?", a: "One control that sets who runs the call: the AI end to end, the AI warming up before a live transfer to your closer, or your rep with the AI whispering support. Same brain, three settings." },
  { q: "Which Platforms Does It Work With?", a: "Zoom, Google Meet, Microsoft Teams, and phone. If there is audio, Master Closer can work the call." },
  { q: "How Fast Is Setup?", a: "Minutes. Add your offer and objections, pick an autonomy setting, and take your next call." },
];

const INSIDE = [
  { icon: LayoutDashboard, t: "Dashboard", d: "Live calls, close rate, and next moves at a glance.", x: 9, y: 18 },
  { icon: BookOpen, t: "Knowledge Base", d: "Your offer, pricing, and playbooks in one brain.", x: 9, y: 50 },
  { icon: Brain, t: "Conversation Memory", d: "Every past call remembered and searchable.", x: 9, y: 82 },
  { icon: Wand2, t: "Prompt Builder", d: "Tune the voice, the close, and the disclosure.", x: 91, y: 18 },
  { icon: GraduationCap, t: "AI Training", d: "Feed it winning calls. It gets sharper weekly.", x: 91, y: 50 },
  { icon: BarChart3, t: "Analytics", d: "See what closes and what stalls, per rep.", x: 91, y: 82 },
  { icon: Library, t: "Call Library", d: "Every call recorded, tagged, and reviewable.", x: 50, y: 100 },
];

const PLATFORMS = [
  { icon: Video, t: "Zoom" },
  { icon: Video, t: "Google Meet" },
  { icon: Video, t: "Microsoft Teams" },
  { icon: PhoneCall, t: "Phone" },
  { icon: Globe, t: "Browser" },
  { icon: Smartphone, t: "Mobile" },
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

export default function App() {
  return (
    <div className="mc-root">
      <style>{CSS}</style>

      {/* NAV */}
      <header className="nav">
        <div className="wrap nav-in">
          <div className="brand">
            <span className="brand-mark"><Crosshair size={18} strokeWidth={2.6} /></span>
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

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <Eyebrow>One Slider. Every Call.</Eyebrow>
            <h1 className="font-display hero-h1">Close Every<br />Conversation.</h1>
            <p className="hero-sub">
              Master Closer runs the whole call, warms the lead and hands off to your closer,
              or whispers the next line while your rep talks. You choose how much is AI and how
              much is human — on one dial.
            </p>
            <div className="hero-actions">
              <a href="#demo" className="btn-primary btn-lg">Try It Live <ArrowRight size={17} strokeWidth={2.4} /></a>
              <a href="#autonomy" className="btn-ghost btn-lg"><Play size={16} strokeWidth={2.4} /> See The Slider</a>
            </div>
            <div className="hero-pills">
              {[{ i: Bot, t: "Runs The Call" }, { i: Mic, t: "Whispers The Close" }, { i: CreditCard, t: "Closes & Collects" }].map((p) => {
                const Icon = p.i;
                return (
                  <div key={p.t} className="hero-pill">
                    <span className="hero-pill-ico"><Icon size={16} strokeWidth={2.2} /></span>
                    <span className="hero-pill-t font-display">{p.t}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="hero-card">
            <LiveCallCard />
            <div className="float-chip float-chip-1">
              <span className="float-ico"><TrendingUp size={14} strokeWidth={2.4} /></span>
              <div className="float-body">
                <span className="float-label font-mono">CLOSE RATE</span>
                <span className="float-value">47%</span>
              </div>
              <span className="float-delta">+12</span>
            </div>
            <div className="float-chip float-chip-2">
              <span className="float-ico float-ico-live"><span className="float-dot" /></span>
              <div className="float-body">
                <span className="float-label font-mono">WHISPER · LIVE</span>
                <span className="float-value float-value-sm">"Anchor the price, then pause."</span>
              </div>
            </div>
            <div className="float-chip float-chip-3">
              <span className="float-ico"><Check size={14} strokeWidth={2.8} /></span>
              <div className="float-body">
                <span className="float-label font-mono">DEAL CLOSED</span>
                <span className="float-value">$4,200</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="strip">
        <div className="wrap strip-in">
          <span className="strip-label font-mono">BUILT TO CLOSE IN</span>
          <div className="strip-chips">
            {["SaaS", "Real Estate", "Solar", "Insurance", "Recruiting", "Automotive", "Home Services"].map((x) => (
              <span key={x} className="strip-chip font-display">{x}</span>
            ))}
          </div>
        </div>
      </section>

      {/* AUTONOMY */}
      <section id="autonomy" className="sec">
        <div className="wrap">
          <div className="sec-head" style={{ maxWidth: "none" }}>
            <Eyebrow>The Autonomy Slider</Eyebrow>
            <h2 className="font-display sec-h2" style={{ whiteSpace: "nowrap" }}>One Platform. Three Ways To Run The Call.</h2>
            <p className="sec-lead">Every other tool picks a lane — an AI that talks, or a copilot that whispers. Master Closer is the same brain at three settings. Move the dial per campaign, per rep, per call.</p>
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
                  <p className="mode-b">{m.blurb}</p>
                  <div className="mode-cue">
                    <span className="font-mono mode-cue-tag">{m.tag}</span>
                    <p className="mode-cue-line">{m.cue}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="dial-bar">
            <span className="font-mono dial-end">FULL AI</span>
            <div className="dial-track"><span className="dial-knob" /></div>
            <span className="font-mono dial-end">FULL HUMAN</span>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
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

      {/* TWO VIEWS (real graphic like RentHQ see/never-see) */}
      <section className="sec sec-mist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Two Sides Of Every Call</Eyebrow>
            <h2 className="font-display sec-h2">What They Hear. What You See.</h2>
            <p className="sec-lead">Your prospect hears a natural, confident conversation. You see the objection named, the next line, and the close probability — private, on your screen only.</p>
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
                  <li key={x}><Crosshair size={15} strokeWidth={2.4} className="text-signal" /> {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* OBJECTION ANIMATION */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Ten Seconds, End To End</Eyebrow>
            <h2 className="font-display sec-h2">Watch It Close An Objection.</h2>
            <p className="sec-lead">The prospect stalls. Master Closer names the objection, thinks, and hands your rep the exact next line. They send it, the prospect softens, the deal moves.</p>
          </div>
          <div className="anim">
            <div className="anim-step anim-1">
              <span className="anim-tag font-mono">PROSPECT</span>
              <p className="anim-line">"I need to think about it."</p>
            </div>
            <div className="anim-arrow anim-arrow-1"><ArrowRight size={18} strokeWidth={2.4} /></div>
            <div className="anim-step anim-2">
              <span className="anim-tag anim-tag-red font-mono">TRANSCRIPT · LIVE</span>
              <div className="anim-transcript"><span className="anim-typing">I need to think about it.<span className="anim-caret">|</span></span></div>
              <div className="anim-chips">
                <span className="chip chip-red">Stall · Delay</span>
                <span className="chip">Tone: Hesitant</span>
              </div>
            </div>
            <div className="anim-arrow anim-arrow-2"><ArrowRight size={18} strokeWidth={2.4} /></div>
            <div className="anim-step anim-3">
              <span className="anim-tag font-mono">MASTER CLOSER · THINKING</span>
              <div className="anim-dots"><span /><span /><span /></div>
            </div>
            <div className="anim-arrow anim-arrow-3"><ArrowRight size={18} strokeWidth={2.4} /></div>
            <div className="anim-step anim-4">
              <div className="anim-say-head">
                <Crosshair size={13} strokeWidth={2.4} className="text-signal" />
                <span className="anim-tag font-mono">WHISPERED TO YOUR REP</span>
              </div>
              <p className="anim-line">"Totally get it. What's the one thing you'd need to think through — is it fit, price, or timing?"</p>
              <button className="anim-btn"><MousePointerClick size={13} strokeWidth={2.4} /> Send</button>
            </div>
            <div className="anim-arrow anim-arrow-4"><ArrowRight size={18} strokeWidth={2.4} /></div>
            <div className="anim-step anim-5">
              <span className="anim-tag font-mono">PROSPECT · REPLIES</span>
              <p className="anim-line">"Honestly? Just the price. Can we walk through it again?"</p>
              <div className="conf">
                <div className="conf-label font-mono">CLOSE PROBABILITY</div>
                <div className="conf-track"><div className="conf-fill anim-fill" /></div>
                <div className="conf-num font-mono anim-num">84%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Live Demo</Eyebrow>
            <h2 className="font-display sec-h2">Test It Live.</h2>
            <p className="sec-lead">This is the actual engine, not a video. Pick a line or type your own, choose who's running the call, and watch Master Closer hand back the move in real time.</p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* INSIDE MASTER CLOSER */}
      <section className="sec sec-mist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Inside Master Closer</Eyebrow>
            <h2 className="font-display sec-h2">The Whole Cockpit, On One Screen.</h2>
            <p className="sec-lead">Every part of your close, wired together. Live calls on the left, the brain in the middle, coaching on the right.</p>
          </div>
          <div className="inside">
            <div className="inside-stage">
              {/* Mock app window */}
              <div className="mock">
                <div className="mock-chrome">
                  <span className="mock-dot mock-dot-r" />
                  <span className="mock-dot mock-dot-y" />
                  <span className="mock-dot mock-dot-g" />
                  <span className="mock-url font-mono">app.masterclose.ai / dashboard</span>
                </div>
                <div className="mock-body">
                  <aside className="mock-side">
                    <div className="mock-brand"><span className="brand-mark"><Crosshair size={13} strokeWidth={2.6} /></span><span className="font-display" style={{fontWeight:800,fontSize:13}}>Master Closer</span></div>
                    {[
                      {i:LayoutDashboard,t:"Dashboard",on:true},
                      {i:BookOpen,t:"Knowledge"},
                      {i:Brain,t:"Memory"},
                      {i:Wand2,t:"Prompts"},
                      {i:GraduationCap,t:"Training"},
                      {i:BarChart3,t:"Analytics"},
                      {i:Library,t:"Call Library"},
                    ].map((r)=>{const I=r.i;return(
                      <div key={r.t} className={"mock-nav "+(r.on?"mock-nav-on":"")}><I size={13} strokeWidth={2.2}/><span>{r.t}</span></div>
                    );})}
                  </aside>
                  <div className="mock-main">
                    <div className="mock-head">
                      <div>
                        <div className="mock-h font-display">Live Calls</div>
                        <div className="mock-sub font-mono">3 IN PROGRESS · 12 TODAY</div>
                      </div>
                      <div className="mock-metric"><span className="font-mono mock-metric-l">CLOSE RATE</span><span className="font-display mock-metric-v">47%</span></div>
                    </div>
                    <div className="mock-cards">
                      {[
                        {n:"Gridline · Discovery",t:"Price Objection",p:72,live:true},
                        {n:"Northbound · Demo",t:"Timing",p:58,live:true},
                        {n:"Apex Solar · Close",t:"Ready",p:91,live:true},
                      ].map((c)=>(
                        <div key={c.n} className="mock-card">
                          <div className="mock-card-top">
                            <span className="rec-dot" />
                            <span className="font-mono mock-card-n">{c.n}</span>
                          </div>
                          <span className="chip chip-red" style={{alignSelf:'flex-start'}}>{c.t}</span>
                          <div className="conf">
                            <div className="conf-track"><div className="conf-fill" style={{width:c.p+"%"}}/></div>
                            <div className="conf-num font-mono">{c.p}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mock-chart">
                      <div className="mock-chart-h"><span className="font-display" style={{fontWeight:800}}>This Week</span><span className="font-mono mock-metric-l">CLOSES / DAY</span></div>
                      <div className="mock-bars">
                        {[40,62,55,78,68,84,72].map((h,i)=><span key={i} className="mock-bar" style={{height:h+"%"}}/>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Callouts */}
              {INSIDE.map((c,i)=>{const I=c.icon;return(
                <div key={c.t} className={"callout callout-"+i} style={{left:c.x+"%",top:c.y+"%"}}>
                  <span className="callout-ico"><I size={14} strokeWidth={2.2}/></span>
                  <div className="callout-body">
                    <div className="callout-t font-display">{c.t}</div>
                    <div className="callout-d">{c.d}</div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="sec sec-dark">
        <div className="wrap">
          <div className="sec-head" style={{ maxWidth: "none" }}>
            <Eyebrow>Capabilities</Eyebrow>
            <h2 className="font-display sec-h2" style={{ whiteSpace: "nowrap", color: "#fff" }}>Everything A Closer Needs, In One Place.</h2>
          </div>
          <div className="caps">
            {CAPS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.t} className="cap">
                  <span className="cap-ico"><Icon size={19} strokeWidth={2.1} /></span>
                  <h3 className="font-display cap-h">{c.t}</h3>
                  <p className="cap-d">{c.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="uses" className="sec sec-mist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Trained To Close</Eyebrow>
            <h2 className="font-display sec-h2">A Master Closer For Any Close.</h2>
            <p className="sec-lead">Real objections it handles live, tuned to your industry and your offer.</p>
          </div>
          <div className="uses">
            {USES.map((u) => {
              const Icon = u.icon;
              return (
                <div key={u.t} className="use">
                  <div className="use-top">
                    <span className="use-ico"><Icon size={17} strokeWidth={2.2} /></span>
                    <span className="use-t font-display">{u.t}</span>
                  </div>
                  <div className="use-o">
                    <span className="use-o-tag font-mono">PROSPECT</span>
                    “{u.o}”
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SETUP */}
      <section id="setup" className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Setup</Eyebrow>
            <h2 className="font-display sec-h2">Works Anywhere You Take Calls.</h2>
            <p className="sec-lead">If it has audio, Master Closer runs on it. No new headset, no new phone, no IT project.</p>
          </div>
          <div className="platforms">
            {PLATFORMS.map((p)=>{const I=p.icon;return(
              <div key={p.t} className="platform">
                <span className="platform-check"><Check size={13} strokeWidth={3}/></span>
                <span className="platform-ico"><I size={18} strokeWidth={2.2}/></span>
                <span className="platform-t font-display">{p.t}</span>
              </div>
            );})}
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.n} className="step">
                <span className="step-n font-mono">{s.n}</span>
                <h3 className="font-display step-h">{s.t}</h3>
                <p className="step-d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section className="sec sec-dark">
        <div className="wrap comply">
          <div className="comply-copy">
            <Eyebrow>Consent, Built In</Eyebrow>
            <h2 className="font-display sec-h2" style={{ color: "#fff" }}>The Honest Edge Wins The Deal.</h2>
            <p className="sec-lead" style={{ color: "rgba(255,255,255,.66)" }}>
              Covert tools get their users sued. Master Closer discloses when a call is recorded,
              knows the consent rules state by state, and keeps the coaching layer private to your rep.
              Compliance becomes a reason to trust you, not a liability to hide.
            </p>
            <div className="comply-list">
              {["In-Meeting Recording Disclosure", "Per-State Consent Rules", "No Covert Audio Capture", "SOC 2-Ready Data Handling"].map((x) => (
                <div key={x} className="comply-item"><Check size={16} strokeWidth={2.6} className="text-signal" /> {x}</div>
              ))}
            </div>
          </div>
          <div className="comply-badge">
            <Lock size={26} strokeWidth={2} />
            <span className="font-mono">DISCLOSED · ENCRYPTED · LOGGED</span>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>Proof</Eyebrow>
            <h2 className="font-display sec-h2">Closers Don't Go Back.</h2>
          </div>
          <div className="quotes">
            {[
              {
                q: "Set it to hybrid and my AI warms every lead before I even pick up. I just close.",
                n: "Marcus D.",
                title: "Owner",
                company: "Apex Solar",
                initials: "MD",
                revenue: "$1.2M Closed",
                logo: Sun,
              },
              {
                q: "The whisper hits before the silence gets awkward. My objection handling doubled.",
                n: "Priya R.",
                title: "Enterprise AE",
                company: "Flowstack",
                initials: "PR",
                revenue: "42% Win Rate",
                logo: Building2,
              },
              {
                q: "Full AI ran a demo while I slept and sent the payment link. Woke up to a closed deal.",
                n: "Jordan T.",
                title: "Founder",
                company: "Northbound Agency",
                initials: "JT",
                revenue: "$340K Added",
                logo: Users,
              },
            ].map((t) => {
              const Logo = t.logo;
              return (
                <div key={t.n} className="quote">
                  <p className="quote-t">"{t.q}"</p>
                  <div className="quote-meta">
                    <div className="quote-avatar">
                      <span className="quote-avatar-text">{t.initials}</span>
                    </div>
                    <div className="quote-info">
                      <span className="quote-n font-display">{t.n}</span>
                      <span className="quote-title">{t.title} — {t.company}</span>
                    </div>
                    <div className="quote-badge">
                      <Logo size={14} strokeWidth={2.2} />
                      <span className="font-mono">{t.revenue}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* FINAL CTA */}
      <section className="cta-final">
        <div className="wrap cta-in">
          <h2 className="font-display cta-h">Your Next Call Could Be Your Best Close.</h2>
          <p className="cta-sub">Set up in minutes. Slide the dial. Let it work.</p>
          <a href="#" className="btn-primary btn-lg">Get Started <ArrowRight size={17} strokeWidth={2.4} /></a>
          <div className="cta-note">No Contracts · Cancel Anytime</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="foot">
        <div className="wrap foot-in">
          <div className="brand">
            <span className="brand-mark"><Crosshair size={16} strokeWidth={2.6} /></span>
            <span className="brand-word font-display" style={{ fontSize: 16 }}>Master Closer</span>
          </div>
          <div className="foot-links">
            <a href="#autonomy">Product</a>
            <a href="#uses">Solutions</a>
            <a href="#setup">How It Works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="foot-copy">© 2026 Master Closer</div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------- Styles ------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

.mc-root{
  --ink:#0B0B0F; --paper:#FFFFFF; --mist:#F4F4F6; --line:#E7E7EC;
  --signal:#CC0000; --signal-deep:#A30000; --muted:#6B6B76; --green:#0E9F6E;
  font-family:'Inter',system-ui,sans-serif; color:var(--ink);
  background:var(--paper); -webkit-font-smoothing:antialiased; line-height:1.5;
}
.mc-root *{box-sizing:border-box;}
.font-display{font-family:'Hanken Grotesk',system-ui,sans-serif; letter-spacing:-.02em; font-weight:800;}
.font-mono{font-family:'DM Mono',ui-monospace,monospace;}
.text-signal{color:var(--signal);}
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.wrap{max-width:1160px;margin:0 auto;padding:0 24px;}
.wrap-narrow{max-width:860px;}
a{text-decoration:none;color:inherit;}
.eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:16px;}

/* buttons */
.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--signal);color:#fff;
  font-family:'Hanken Grotesk',sans-serif;font-weight:700;border:none;border-radius:11px;padding:11px 18px;
  cursor:pointer;transition:background .18s ease, transform .18s ease;font-size:.95rem;letter-spacing:-.01em;}
.btn-primary:hover{background:var(--signal-deep);transform:translateY(-1px);}
.btn-primary:disabled{opacity:.6;cursor:default;transform:none;}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--ink);
  font-family:'Hanken Grotesk',sans-serif;font-weight:700;border:1px solid var(--line);border-radius:11px;
  padding:11px 18px;cursor:pointer;transition:border-color .18s ease;font-size:.95rem;}
.btn-ghost:hover{border-color:#c9c9d2;}
.btn-lg{padding:14px 24px;font-size:1.02rem;border-radius:12px;}

/* nav */
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);
  backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line);}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:68px;}
.brand{display:flex;align-items:center;gap:10px;}
.brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--signal);color:#fff;}
.brand-word{font-weight:800;font-size:19px;letter-spacing:-.02em;}
.nav-links{display:flex;gap:32px;font-size:.94rem;font-weight:600;color:#3a3a42;}
.nav-links a:hover{color:var(--signal);}
.nav-cta{display:flex;align-items:center;gap:20px;}
.nav-login{font-family:'Hanken Grotesk',sans-serif;font-weight:700;font-size:.94rem;}
.nav-login:hover{color:var(--signal);}
@media(max-width:860px){.nav-links{display:none;}}

/* hero */
.hero{padding:80px 0 64px;}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;}
.hero-h1{font-weight:900;font-size:clamp(3rem,6vw,4.7rem);line-height:.98;letter-spacing:-.04em;margin:0 0 22px;}
.hero-sub{font-size:1.14rem;color:#44444e;max-width:31em;margin:0 0 30px;}
.hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:30px;}
.hero-pills{display:flex;gap:12px;flex-wrap:wrap;}
.hero-pill{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:12px;padding:10px 14px;background:#fff;}
.hero-pill-ico{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#fbeaea;color:var(--signal);}
.hero-pill-t{font-size:.9rem;font-weight:700;}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:40px;}.hero{padding:48px 0 40px;}}

/* hero floating chips */
.hero-card{position:relative;}
.float-chip{position:absolute;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 14px;box-shadow:0 22px 44px -22px rgba(11,11,15,.28);z-index:2;animation:float 5.5s ease-in-out infinite;}
.float-chip-1{top:-18px;left:-32px;animation-delay:0s;}
.float-chip-2{top:44%;left:-64px;animation-delay:1.2s;max-width:250px;}
.float-chip-3{bottom:-16px;right:-28px;animation-delay:2.4s;}
.float-ico{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#fbeaea;color:var(--signal);flex-shrink:0;}
.float-ico-live{background:rgba(230,57,70,.14);}
.float-dot{width:9px;height:9px;border-radius:50%;background:var(--signal);box-shadow:0 0 0 0 rgba(230,57,70,.55);animation:pulseDot 1.6s ease-out infinite;}
.float-body{display:flex;flex-direction:column;line-height:1.15;}
.float-label{font-size:9px;letter-spacing:.12em;color:#8a8a92;}
.float-value{font-weight:800;font-size:1rem;color:var(--ink);margin-top:2px;}
.float-value-sm{font-size:.82rem;font-weight:600;color:#26262e;max-width:200px;}
.float-delta{margin-left:6px;font-family:var(--font-mono,ui-monospace);font-size:11px;font-weight:700;color:#0f9d58;background:rgba(15,157,88,.1);padding:3px 7px;border-radius:6px;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 rgba(230,57,70,.55);}70%{box-shadow:0 0 0 8px rgba(230,57,70,0);}100%{box-shadow:0 0 0 0 rgba(230,57,70,0);}}
@media(max-width:900px){.float-chip-1{left:8px;top:-14px;}.float-chip-2{left:-8px;}.float-chip-3{right:8px;}}
@media(max-width:560px){.float-chip-2{display:none;}}

/* device card */
.device{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 26px 64px -30px rgba(11,11,15,.3);overflow:hidden;}
.device-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);background:#fcfcfd;}
.rec-dot{width:9px;height:9px;border-radius:50%;background:var(--signal);animation:pulse 1.8s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(204,0,0,.45);}70%{box-shadow:0 0 0 7px rgba(204,0,0,0);}100%{box-shadow:0 0 0 0 rgba(204,0,0,0);}}
.device-live{font-size:12px;font-weight:500;color:var(--signal);letter-spacing:.1em;}
.device-time{font-size:12px;color:var(--muted);}
.device-body{padding:18px;display:flex;flex-direction:column;gap:14px;}
.bubble{border-radius:13px;padding:13px 15px;font-size:.95rem;line-height:1.45;}
.bubble-them{background:var(--mist);color:#26262e;}
.bubble-name{font-size:10px;letter-spacing:.14em;color:var(--muted);margin-bottom:5px;}
.analysis{display:flex;flex-direction:column;gap:12px;}
.analysis-row{display:flex;gap:8px;flex-wrap:wrap;}
.chip{font-size:.76rem;font-weight:600;padding:5px 10px;border-radius:999px;background:#f0f0f3;color:#4a4a54;font-family:'Hanken Grotesk',sans-serif;}
.chip-red{background:#fbeaea;color:var(--signal);}
.conf{display:flex;align-items:center;gap:10px;}
.conf-label{font-size:10px;letter-spacing:.12em;color:var(--muted);white-space:nowrap;}
.conf-track{flex:1;height:6px;border-radius:999px;background:#ededf1;overflow:hidden;}
.conf-fill{height:100%;background:var(--signal);border-radius:999px;transition:width .5s ease;}
.conf-num{font-size:12px;color:var(--ink);font-weight:500;}
.say{border:1px solid #f2d6d6;background:#fffafa;border-radius:13px;padding:14px 15px;}
.say-flat{background:#fff;}
.say-head{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
.say-tag{font-size:10px;letter-spacing:.1em;color:var(--signal);text-transform:uppercase;}
.say-line{margin:0;font-size:1rem;line-height:1.5;color:var(--ink);font-weight:500;}
.device-foot{padding:14px 18px;border-top:1px solid var(--line);background:#fcfcfd;}

/* segmented */
.seg{display:flex;background:#f0f0f3;border-radius:11px;padding:4px;gap:4px;}
.seg-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;background:transparent;
  color:#57575f;font-family:'Hanken Grotesk',sans-serif;font-weight:700;font-size:.82rem;padding:8px 6px;border-radius:8px;cursor:pointer;transition:all .16s ease;white-space:nowrap;}
.seg-btn:hover{color:var(--ink);}
.seg-btn-on{background:#fff;color:var(--signal);box-shadow:0 1px 3px rgba(11,11,15,.1);}

/* strip */
.strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fcfcfd;}
.strip-in{display:flex;align-items:center;gap:26px;padding:20px 24px;flex-wrap:wrap;}
.strip-label{font-size:11px;letter-spacing:.14em;color:var(--muted);}
.strip-chips{display:flex;gap:10px;flex-wrap:wrap;}
.strip-chip{font-size:.88rem;font-weight:700;color:#3a3a42;padding:6px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;}

/* sections */
.sec{padding:92px 0;}
.sec-mist{background:var(--mist);}
.sec-dark{background:var(--ink);}
.sec-head{max-width:680px;margin:0 auto 54px;text-align:center;}
.sec-h2{font-weight:900;font-size:clamp(2rem,4vw,2.9rem);line-height:1.05;letter-spacing:-.035em;margin:0 0 16px;}
.sec-lead{font-size:1.08rem;color:#50505a;margin:0;line-height:1.55;}

/* modes */
.modes{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:44px;}
.mode-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px;transition:border-color .2s ease, transform .2s ease, box-shadow .2s ease;}
.mode-card:hover{border-color:#e2c4c4;transform:translateY(-3px);box-shadow:0 20px 44px -28px rgba(11,11,15,.28);}
.mode-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.mode-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fbeaea;color:var(--signal);}
.mode-step{font-size:13px;color:#cfcfd6;font-weight:500;}
.mode-h{font-weight:800;font-size:1.3rem;margin:0 0 9px;}
.mode-b{font-size:.92rem;color:#54545e;margin:0 0 16px;line-height:1.5;}
.mode-cue{border-top:1px solid var(--line);padding-top:14px;}
.mode-cue-tag{display:block;font-size:9px;letter-spacing:.12em;color:var(--signal);text-transform:uppercase;margin-bottom:7px;}
.mode-cue-line{margin:0;font-size:.9rem;line-height:1.5;color:#26262e;font-weight:500;}
@media(max-width:800px){.modes{grid-template-columns:1fr;}}

/* dial */
.dial-bar{display:flex;align-items:center;gap:18px;max-width:560px;margin:0 auto;}
.dial-end{font-size:11px;letter-spacing:.12em;color:var(--muted);white-space:nowrap;}
.dial-track{position:relative;flex:1;height:8px;border-radius:999px;background:linear-gradient(90deg,var(--signal),#e9b3b3);}
.dial-knob{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--signal);box-shadow:0 3px 10px rgba(11,11,15,.2);}

/* two views */
.views{display:grid;grid-template-columns:1fr 1fr;gap:22px;}
.view-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:0 18px 40px -30px rgba(11,11,15,.22);}
.view-head{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
.view-ico{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;}
.view-ico-green{background:#e6f6ee;color:var(--green);}
.view-ico-red{background:#fbeaea;color:var(--signal);}
.view-title{font-size:1.1rem;font-weight:800;flex:1;}
.view-pill{font-size:10px;letter-spacing:.1em;padding:4px 9px;border-radius:999px;}
.view-pill-green{background:#e6f6ee;color:var(--green);}
.view-pill-red{background:#fbeaea;color:var(--signal);}
.view-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;}
.view-list li{display:flex;align-items:center;gap:11px;font-size:.98rem;color:#2a2a32;font-weight:500;}
.view-check-green{color:var(--green);flex-shrink:0;}
@media(max-width:800px){.views{grid-template-columns:1fr;}}

/* demo */
.demo{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 26px 64px -36px rgba(11,11,15,.28);}
.demo-controls{margin-bottom:16px;}
.demo-scenarios{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px;}
.scenario{font-size:.86rem;color:#45454f;background:var(--mist);border:1px solid var(--line);border-radius:999px;padding:8px 13px;cursor:pointer;transition:all .16s ease;font-family:'Inter',sans-serif;}
.scenario:hover{border-color:var(--signal);color:var(--signal);}
.demo-input{display:flex;gap:10px;margin-bottom:18px;}
.demo-input input{flex:1;border:1px solid var(--line);border-radius:11px;padding:12px 14px;font-size:.98rem;color:var(--ink);outline:none;transition:border-color .16s ease;font-family:'Inter',sans-serif;}
.demo-input input:focus{border-color:var(--signal);}
.demo-go{white-space:nowrap;}
.demo-output{min-height:96px;border-top:1px solid var(--line);padding-top:18px;}
.demo-empty{color:var(--muted);font-size:.96rem;}
.demo-result{animation:fade .3s ease;}
@keyframes fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}

/* compare table */
.compare{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;}
.cmp-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;border-bottom:1px solid var(--line);}
.cmp-row:last-child{border-bottom:none;}
.cmp-head{background:#fafafb;}
.cmp-cap{padding:16px 20px;font-size:.94rem;font-weight:600;color:#2a2a32;}
.cmp-head .cmp-cap{font-size:11px;letter-spacing:.12em;color:var(--muted);font-weight:500;}
.cmp-col{padding:16px 12px;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:#54545e;}
.cmp-col-hi{background:#fdf6f6;color:var(--signal);}
.cmp-head .cmp-col-hi{color:var(--signal);}
.cmark{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;}
.cmark-yes{background:#e6f6ee;color:var(--green);}
.cmark-no{background:#f0f0f3;color:#b6b6be;}
.cmark-part{width:9px;height:9px;border-radius:50%;background:#e6b800;}
@media(max-width:640px){.cmp-cap{font-size:.82rem;padding:13px 12px;}.cmp-col{padding:13px 4px;}}

/* caps */
.caps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
.cap{padding:6px 4px;}
.cap-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fbeaea;color:var(--signal);margin-bottom:16px;}
.cap-h{font-weight:800;font-size:1.1rem;margin:0 0 7px;}
.cap-d{font-size:.92rem;color:#54545e;margin:0;line-height:1.5;}
.sec-dark .cap-ico{background:rgba(230,57,70,.14);color:var(--signal);}
.sec-dark .cap-h{color:#fff;}
.sec-dark .cap-d{color:rgba(255,255,255,.62);}
.sec-dark .eyebrow{color:var(--signal);}
@media(max-width:980px){.caps{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.caps{grid-template-columns:1fr;}}

/* uses */
.uses{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.use{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;transition:transform .2s ease, box-shadow .2s ease;}
.use:hover{transform:translateY(-3px);box-shadow:0 18px 40px -26px rgba(11,11,15,.3);}
.use-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.use-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#fbeaea;color:var(--signal);}
.use-t{font-weight:800;font-size:1.04rem;}
.use-o{font-size:.9rem;color:#40404a;line-height:1.45;background:#fbeaea60;border-radius:11px;padding:12px 13px;}
.use-o-tag{display:block;font-size:9px;letter-spacing:.14em;color:var(--signal);margin-bottom:6px;}
@media(max-width:980px){.uses{grid-template-columns:repeat(2,1fr);}}
@media(max-width:520px){.uses{grid-template-columns:1fr;}}

/* steps */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;max-width:960px;margin:0 auto;}
.step{border-top:2px solid var(--signal);padding-top:20px;}
.step-n{font-size:13px;color:var(--signal);font-weight:500;letter-spacing:.1em;}
.step-h{font-weight:800;font-size:1.3rem;margin:12px 0 9px;}
.step-d{font-size:.94rem;color:#54545e;margin:0;line-height:1.5;}
@media(max-width:800px){.steps{grid-template-columns:1fr;gap:22px;}}

/* compliance */
.comply{display:grid;grid-template-columns:1.4fr .6fr;gap:44px;align-items:center;}
.comply-copy .sec-lead{margin-bottom:24px;text-align:left;}
.comply-copy .sec-h2{text-align:left;}
.comply-copy .eyebrow{text-align:left;}
.comply-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.comply-item{display:flex;align-items:center;gap:9px;color:rgba(255,255,255,.9);font-size:.95rem;font-weight:600;font-family:'Hanken Grotesk',sans-serif;}
.comply-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:40px 22px;color:#fff;background:linear-gradient(160deg,rgba(204,0,0,.18),rgba(255,255,255,.02));}
.comply-badge .font-mono{font-size:11px;letter-spacing:.14em;color:rgba(255,255,255,.72);text-align:center;}
@media(max-width:820px){.comply{grid-template-columns:1fr;gap:30px;}.comply-list{grid-template-columns:1fr;}}

/* quotes */
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.quote{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;display:flex;flex-direction:column;}
.quote-t{font-size:1.02rem;line-height:1.55;color:#24242c;margin:0 0 22px;font-weight:500;flex:1;}
.quote-meta{display:flex;align-items:center;gap:14px;}
.quote-avatar{flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--signal);color:#fff;display:grid;place-items:center;}
.quote-avatar-text{font-family:'Hanken Grotesk',sans-serif;font-weight:800;font-size:.9rem;}
.quote-info{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
.quote-n{font-weight:800;font-size:.98rem;}
.quote-title{font-size:.82rem;color:var(--muted);line-height:1.35;}
.quote-badge{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:500;letter-spacing:.04em;padding:6px 10px;border-radius:999px;background:var(--mist);color:var(--ink);}
.quote-badge svg{color:var(--signal);}
@media(max-width:860px){.quotes{grid-template-columns:1fr;}}
@media(max-width:520px){.quote-meta{flex-wrap:wrap;}.quote-badge{width:100%;justify-content:center;margin-top:2px;}}

/* faq */
.faq{display:flex;flex-direction:column;gap:12px;}
.faq-item{background:#fff;border:1px solid var(--line);border-radius:14px;padding:4px 20px;}
.faq-q{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:18px 0;font-size:1.04rem;font-weight:800;color:var(--ink);text-align:left;gap:16px;font-family:'Hanken Grotesk',sans-serif;letter-spacing:-.01em;}
.faq-chev{color:var(--muted);transition:transform .2s ease;flex-shrink:0;}
.faq-chev-open{transform:rotate(180deg);color:var(--signal);}
.faq-a{margin:0;padding:0 0 20px;color:#54545e;font-size:.98rem;line-height:1.6;max-width:64ch;}

/* final cta */
.cta-final{padding:100px 0;text-align:center;}
.cta-in{max-width:680px;margin:0 auto;display:flex;flex-direction:column;align-items:center;}
.cta-h{font-weight:900;font-size:clamp(2.1rem,4.6vw,3.2rem);line-height:1.04;letter-spacing:-.035em;margin:0 0 16px;}
.cta-sub{font-size:1.12rem;color:#50505a;margin:0 0 28px;}
.cta-note{font-size:.86rem;color:var(--muted);margin-top:16px;font-weight:600;font-family:'Hanken Grotesk',sans-serif;}

/* footer */
.foot{border-top:1px solid var(--line);padding:36px 0;}
.foot-in{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.foot-links{display:flex;gap:24px;font-size:.9rem;font-weight:600;color:#4a4a54;font-family:'Hanken Grotesk',sans-serif;}
.foot-links a:hover{color:var(--signal);}
.foot-copy{font-size:.86rem;color:var(--muted);}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}

/* objection animation */
.anim{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;align-items:stretch;max-width:1100px;margin:0 auto;}
.anim-step{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;opacity:0;animation:animIn .5s ease forwards;}
.anim-1{animation-delay:.2s;}
.anim-2{animation-delay:1.4s;}
.anim-3{animation-delay:2.6s;}
.anim-4{animation-delay:3.6s;}
.anim-5{animation-delay:5.2s;}
@keyframes animIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.anim-tag{font-size:9px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase;}
.anim-tag-red{color:var(--signal);}
.anim-line{margin:0;font-size:.94rem;line-height:1.5;color:#26262e;font-weight:500;}
.anim-transcript{background:var(--mist);border-radius:8px;padding:9px 11px;font-size:.9rem;color:#26262e;min-height:38px;}
.anim-typing{display:inline-block;overflow:hidden;white-space:nowrap;border-right:none;width:0;animation:animType 1s steps(28) 1.5s forwards;}
@keyframes animType{to{width:100%;}}
.anim-caret{display:inline-block;animation:blink 1s step-end infinite;color:var(--signal);font-weight:700;}
@keyframes blink{50%{opacity:0;}}
.anim-chips{display:flex;gap:6px;flex-wrap:wrap;opacity:0;animation:animIn .4s ease 2.4s forwards;}
.anim-dots{display:flex;gap:6px;padding:14px 0;justify-content:center;}
.anim-dots span{width:9px;height:9px;border-radius:50%;background:var(--signal);opacity:.3;animation:animDot 1s ease-in-out infinite;}
.anim-dots span:nth-child(2){animation-delay:.15s;}
.anim-dots span:nth-child(3){animation-delay:.3s;}
@keyframes animDot{0%,100%{opacity:.3;transform:scale(.9);}50%{opacity:1;transform:scale(1.2);}}
.anim-say-head{display:flex;align-items:center;gap:6px;}
.anim-btn{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;background:var(--signal);color:#fff;border:none;border-radius:8px;padding:6px 11px;font-family:'Hanken Grotesk',sans-serif;font-weight:700;font-size:.78rem;cursor:pointer;opacity:0;animation:animPulse .6s ease 4.4s forwards;}
@keyframes animPulse{0%{opacity:0;transform:scale(.9);}60%{opacity:1;transform:scale(1.06);}100%{opacity:1;transform:scale(1);}}
.anim-fill{width:0;animation:animFill 1s ease 5.4s forwards;}
@keyframes animFill{to{width:84%;}}
.anim-num{opacity:0;animation:animIn .3s ease 5.8s forwards;}
.anim-arrow{display:flex;align-items:center;justify-content:center;color:var(--signal);opacity:0;}
.anim-arrow-1{animation:animIn .3s ease 1.2s forwards;}
.anim-arrow-2{animation:animIn .3s ease 2.4s forwards;}
.anim-arrow-3{animation:animIn .3s ease 3.4s forwards;}
.anim-arrow-4{animation:animIn .3s ease 5s forwards;}
@media(max-width:900px){.anim{grid-template-columns:1fr;}.anim-arrow{transform:rotate(90deg);}}

/* inside master closer */
.inside{position:relative;}
.inside-stage{position:relative;padding:40px 0;max-width:1100px;margin:0 auto;}
.mock{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 30px 70px -30px rgba(11,11,15,.35);overflow:hidden;margin:0 220px;}
.mock-chrome{display:flex;align-items:center;gap:8px;padding:11px 14px;background:#fafafb;border-bottom:1px solid var(--line);}
.mock-dot{width:10px;height:10px;border-radius:50%;}
.mock-dot-r{background:#ff5f57;}.mock-dot-y{background:#febc2e;}.mock-dot-g{background:#28c840;}
.mock-url{margin-left:16px;font-size:11px;color:var(--muted);}
.mock-body{display:grid;grid-template-columns:160px 1fr;min-height:340px;}
.mock-side{border-right:1px solid var(--line);padding:14px 10px;display:flex;flex-direction:column;gap:4px;background:#fcfcfd;}
.mock-brand{display:flex;align-items:center;gap:8px;padding:4px 6px 12px;}
.mock-nav{display:flex;align-items:center;gap:8px;font-size:.78rem;color:#54545e;padding:7px 8px;border-radius:7px;font-weight:600;font-family:'Hanken Grotesk',sans-serif;}
.mock-nav-on{background:#fbeaea;color:var(--signal);}
.mock-main{padding:18px;display:flex;flex-direction:column;gap:14px;background:#fff;}
.mock-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;}
.mock-h{font-weight:800;font-size:1.1rem;letter-spacing:-.02em;}
.mock-sub{font-size:9px;letter-spacing:.12em;color:var(--muted);margin-top:3px;}
.mock-metric{display:flex;flex-direction:column;align-items:flex-end;gap:2px;}
.mock-metric-l{font-size:9px;letter-spacing:.12em;color:var(--muted);}
.mock-metric-v{font-weight:900;font-size:1.5rem;color:var(--signal);line-height:1;}
.mock-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.mock-card{border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fcfcfd;}
.mock-card-top{display:flex;align-items:center;gap:6px;}
.mock-card-n{font-size:10px;color:#26262e;font-weight:500;}
.mock-chart{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#fcfcfd;}
.mock-chart-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;font-size:.82rem;}
.mock-bars{display:flex;align-items:flex-end;gap:10px;height:60px;}
.mock-bar{flex:1;background:linear-gradient(180deg,var(--signal),#e9b3b3);border-radius:4px 4px 0 0;min-height:6px;}

.callout{position:absolute;display:flex;align-items:flex-start;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 11px;box-shadow:0 12px 30px -18px rgba(11,11,15,.35);max-width:190px;transform:translate(-50%,-50%);}
.callout-6{transform:translate(-50%,-30%);}
.callout-ico{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;background:#fbeaea;color:var(--signal);flex-shrink:0;}
.callout-body{display:flex;flex-direction:column;gap:2px;}
.callout-t{font-weight:800;font-size:.78rem;letter-spacing:-.01em;}
.callout-d{font-size:.72rem;color:#54545e;line-height:1.4;}
@media(max-width:980px){.callout{position:static;transform:none;max-width:none;}.inside-stage{display:grid;grid-template-columns:1fr;gap:14px;padding:0;}.mock{margin:0;}.mock-body{grid-template-columns:1fr;}.mock-side{flex-direction:row;flex-wrap:wrap;border-right:none;border-bottom:1px solid var(--line);}.mock-cards{grid-template-columns:1fr;}}

/* platforms */
.platforms{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;max-width:960px;margin:0 auto 44px;}
.platform{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 14px;}
.platform-check{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e6f6ee;color:var(--green);flex-shrink:0;}
.platform-ico{color:var(--signal);}
.platform-t{font-weight:800;font-size:.92rem;}
@media(max-width:820px){.platforms{grid-template-columns:repeat(2,1fr);}}
`;
