// @ts-nocheck
import React, { useState } from "react";
import {
  Crosshair, ArrowRight, Play, Check, Minus, Building2, Home, Sun, ShieldCheck,
  Users, Car, Wrench, Heart, Mic, PhoneForwarded, Bot, CreditCard,
  Database, Languages, GraduationCap, ChevronDown, Lock, Loader2, PhoneCall,
  Ear, Eye, TrendingUp, Upload, SlidersHorizontal, Headphones, BadgeCheck, Sparkles
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Master Closer — landing page + live copilot demo                   */
/*  JobProof design language: Syne / DM Sans, dark hero, floating       */
/*  layered graphics, pill buttons, connected loop. White + Red #CC0000 */
/* ------------------------------------------------------------------ */

const MODES = [
  {
    key: "ai", label: "Full AI", plain: "The AI Closer", icon: Bot,
    blurb: "It runs the whole call: discovery, demo, close, and payment. No human required.",
    tag: "AI Speaking To Prospect",
    cue: "Totally fair on price. If I lock today's rate and email the agreement now, are you good to start?",
  },
  {
    key: "hybrid", label: "Hybrid Handoff", plain: "Both, Working Together", icon: PhoneForwarded,
    blurb: "The AI warms the lead, live-transfers to your closer, and stays on to assist.",
    tag: "AI Briefing Your Closer",
    cue: "Warm lead, budget confirmed, one price objection left. Transferring you in, take the close.",
  },
  {
    key: "copilot", label: "Human + Copilot", plain: "Your Human Closer", icon: Mic,
    blurb: "Your rep runs the call. The copilot whispers the next line, only they see it.",
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
function DemoWave() {
  return (
    <div className="demo-wave" aria-hidden="true">
      <span className="demo-wave-ring" />
      <span className="demo-wave-ring" />
      <span className="demo-wave-ring" />
      <span className="demo-wave-core" />
    </div>
  );
}

function LiveDemo() {
  const [mode, setMode] = useState("copilot");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const modeMeta = {
    ai: { persona: "You ARE the AI closer speaking directly to the prospect on the call.", lineDesc: "the exact words the AI should say next to the prospect, moving naturally toward the close and, if it fits, offering to send the agreement or a payment link", resultTag: "AI Says To Prospect" },
    hybrid: { persona: "You are the AI that warmed up this lead and is about to live-transfer to a human closer.", lineDesc: "a short, private briefing line spoken to the human closer summarizing where the deal stands and the one move to make on the close", resultTag: "AI Briefs Your Closer" },
    copilot: { persona: "You are a silent copilot whispering to a human sales rep. Only the rep can see this.", lineDesc: "the exact words the rep should say next, natural, spoken, no preamble", resultTag: "Whispered To Your Rep" },
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
  { icon: Upload, t: "Feed It Your Offer", d: "Drop in your script, pricing, and objections. It learns what you sell and how you win." },
  { icon: SlidersHorizontal, t: "Set The Autonomy", d: "Choose Full AI, Hybrid, or Copilot, per campaign or per rep." },
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
  { q: "Can The AI Really Close And Take Payment?", a: "Yes. In Full AI or Hybrid mode it can send an agreement and a payment link mid-call. You decide how far it goes and where a human takes over." },
  { q: "What Are The Three Modes?", a: "One setting decides who runs the call. Full AI runs it end to end. Hybrid warms the lead, then live-transfers to your closer while the AI stays on. Copilot lets your rep run it with the AI whispering support. Same brain, three settings, changeable per call." },
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


/* --------------------- Feature story mocks (zigzag) -------------------- */
function MockWhisper() {
  return (
    <div className="fmock">
      <div className="fmock-bar">
        <span className="rec-dot" /><span className="font-mono fmock-live">LIVE · COPILOT</span>
      </div>
      <div className="fmock-body">
        <div className="bubble bubble-them">
          <div className="bubble-name font-mono">PROSPECT</div>
          Honestly, your competitor is cheaper.
        </div>
        <div className="say">
          <div className="say-head">
            <Crosshair size={13} strokeWidth={2.4} className="text-signal" />
            <span className="font-mono say-tag">Next Best Response</span>
          </div>
          <p className="say-line">Say: "Cheaper on the sticker, sure. Are they closing 4 in 10 for you?"</p>
        </div>
        <div className="fmock-note font-mono">ONLY YOUR REP SEES THIS</div>
      </div>
    </div>
  );
}
function MockVoice() {
  return (
    <div className="fmock">
      <div className="fmock-bar">
        <span className="fmock-ico"><Bot size={14} strokeWidth={2.3} /></span>
        <span className="font-mono fmock-live">AI CLOSER · SPEAKING</span>
      </div>
      <div className="fmock-body">
        <div className="wavebox">
          {Array.from({ length: 26 }).map((_, i) => (
            <span key={i} className="wavebar" style={{ animationDelay: (i * 0.055) + "s" }} />
          ))}
        </div>
        <p className="fmock-quote">"If I lock today's rate and email the agreement now, are you good to start?"</p>
        <div className="fmock-rows">
          <div className="fmock-row"><span>Discovery</span><b className="text-green">Done</b></div>
          <div className="fmock-row"><span>Demo</span><b className="text-green">Done</b></div>
          <div className="fmock-row"><span>Close</span><b className="text-signal">In Progress</b></div>
        </div>
      </div>
    </div>
  );
}
function MockTransfer() {
  return (
    <div className="fmock">
      <div className="fmock-bar">
        <span className="fmock-ico"><PhoneForwarded size={14} strokeWidth={2.3} /></span>
        <span className="font-mono fmock-live">WARM TRANSFER</span>
      </div>
      <div className="fmock-body">
        <div className="xfer">
          <div className="xfer-side"><span className="xfer-av xfer-av-ai"><Bot size={18} strokeWidth={2.2} /></span><span className="xfer-name font-display">AI Closer</span></div>
          <span className="xfer-arrow"><ArrowRight size={18} strokeWidth={2.6} /></span>
          <div className="xfer-side"><span className="xfer-av"><Headphones size={18} strokeWidth={2.2} /></span><span className="xfer-name font-display">Sarah</span></div>
        </div>
        <div className="say">
          <div className="say-head">
            <Crosshair size={13} strokeWidth={2.4} className="text-signal" />
            <span className="font-mono say-tag">Briefing Your Closer</span>
          </div>
          <p className="say-line">Warm lead, budget confirmed, one price objection left. Take the close.</p>
        </div>
      </div>
    </div>
  );
}
function MockCollect() {
  return (
    <div className="fmock">
      <div className="fmock-bar">
        <span className="fmock-ico"><CreditCard size={14} strokeWidth={2.3} /></span>
        <span className="font-mono fmock-live">CLOSE & COLLECT</span>
      </div>
      <div className="fmock-body">
        <div className="pay">
          <div className="pay-label font-mono">AGREEMENT SENT</div>
          <div className="pay-amt font-display">$4,200</div>
          <div className="pay-meta">Gridline Ops · Annual Plan</div>
          <div className="pay-btn font-display">Pay Now</div>
        </div>
        <div className="fmock-rows">
          <div className="fmock-row"><span>Signature</span><b className="text-green">Received</b></div>
          <div className="fmock-row"><span>Payment</span><b className="text-green">Captured</b></div>
          <div className="fmock-row"><span>CRM Write-Back</span><b className="text-green">Logged</b></div>
        </div>
      </div>
    </div>
  );
}

const STORIES = [
  {
    kicker: "Live Copilot",
    icon: Mic,
    t: "The Next Line, Before They Finish Talking.",
    d: "Master Closer listens to the live call, names the objection, and puts the exact words on your rep's screen. Invisible to the prospect.",
    bullets: ["Word-for-word response, not vague coaching", "Objection and tone labeled in real time", "Close probability updates every turn"],
    Mock: MockWhisper,
  },
  {
    kicker: "AI Voice Agent",
    icon: Bot,
    t: "Let The AI Run The Entire Call.",
    d: "A natural voice that opens, qualifies, demos, and closes on its own. Turn it on for the calls your team never gets to.",
    bullets: ["Runs discovery through close, end to end", "Never skips the disclosure or the ask", "Handles overflow and after-hours calls"],
    Mock: MockVoice,
  },
  {
    kicker: "Warm Transfer",
    icon: PhoneForwarded,
    t: "The AI Warms It, Your Closer Lands It.",
    d: "When the lead is hot, the AI live-transfers to a human with a full brief already delivered, then stays on the line to assist.",
    bullets: ["Instant briefing before the human speaks", "No repeated questions, no cold restart", "Copilot keeps whispering after handoff"],
    Mock: MockTransfer,
  },
  {
    kicker: "Close & Collect",
    icon: CreditCard,
    t: "Signed And Paid Before The Call Ends.",
    d: "Send the agreement and a payment link mid-call, then let the outcome, next step, and summary write themselves back to your CRM.",
    bullets: ["Agreement and payment link in-call", "Outcome logged the moment you hang up", "Nothing left for your rep to type"],
    Mock: MockCollect,
  },
];

function FeatureStories() {
  return (
    <>
      {STORIES.map((s, i) => {
        const Icon = s.icon;
        const Mock = s.Mock;
        const flip = i % 2 === 1;
        return (
          <section key={s.kicker} className={"sec sec-story " + (flip ? "sec-mist" : "")}>
            <div className="wrap">
              <div className={"story " + (flip ? "story-flip" : "")}>
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
    </>
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
          <div className="sec-head">
            <Eyebrow>AI, Hybrid, Or Copilot</Eyebrow>
            <h2 className="font-display sec-h2">One Platform. Three Ways To Run The Call.</h2>
            <p className="sec-lead">Same brain, three settings. Let the AI close for you, split the call with your team, or run it yourself with the AI in your ear. Set it per campaign, per rep, per call.</p>
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
                  <li key={x}><Crosshair size={15} strokeWidth={2.4} className="text-signal" /> {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="sec sec-demo-dark">
        <div className="wrap">
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
      <section className="sec sec-dark">
        <div className="wrap comply">
          <div className="comply-copy">
            <Eyebrow light>Consent, Built In</Eyebrow>
            <h2 className="font-display sec-h2" style={{ color: "#fff" }}>The Honest Edge Wins The Deal.</h2>
            <p className="sec-lead" style={{ color: "rgba(255,255,255,.66)" }}>
              Covert tools get their users sued. Master Closer delivers a light quality-and-training
              disclosure when a call is recorded, knows the consent rules state by state, and keeps
              the coaching layer private to your rep. Compliance becomes a reason to trust you, not a
              liability to hide.
            </p>
            <div className="comply-list">
              {["Light, State-Aware Disclosure", "Per-State Consent Rules", "No Covert Audio Capture", "SOC 2-Ready Data Handling"].map((x) => (
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
              { q: "Set it to hybrid and my AI warms every lead before I even pick up. I just close.", n: "Marcus D.", r: "Solar" },
              { q: "The whisper hits before the silence gets awkward. My objection handling doubled.", n: "Priya R.", r: "SaaS AE" },
              { q: "Full AI ran a demo while I slept and sent the payment link. Woke up to a closed deal.", n: "Jordan T.", r: "Agency Owner" },
            ].map((t) => (
              <div key={t.n} className="quote">
                <p className="quote-t">“{t.q}”</p>
                <div className="quote-by">
                  <span className="quote-n font-display">{t.n}</span>
                  <span className="quote-r">{t.r}</span>
                </div>
              </div>
            ))}
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
              <span className="brand-mark"><Crosshair size={16} strokeWidth={2.6} /></span>
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
.rec-dot{width:9px;height:9px;border-radius:50%;background:var(--signal);animation:pulse 1.8s infinite;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(204,0,0,.45);}70%{box-shadow:0 0 0 7px rgba(204,0,0,0);}100%{box-shadow:0 0 0 0 rgba(204,0,0,0);}}
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
.strip{border-bottom:1px solid var(--line);background:#fff;}
.strip-in{display:flex;align-items:center;gap:26px;padding:22px 24px;flex-wrap:wrap;}
.strip-label{font-size:11px;letter-spacing:.14em;color:var(--muted);}
.strip-chips{display:flex;gap:10px;flex-wrap:wrap;}
.strip-chip{font-size:.88rem;font-weight:700;color:#3a3f4a;padding:6px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;}

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
.sec-demo-dark{background:var(--ink);color:#fff;}
.sec-demo-dark .sec-h2{color:#fff;}
.sec-demo-dark .sec-lead{color:rgba(255,255,255,.66);}
.sec-demo-dark .eyebrow-light{color:#ff6b6b;}
.sec-demo-dark .demo{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12);box-shadow:0 26px 64px -36px rgba(0,0,0,.5);}
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
.demo-wave{position:relative;width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.demo-wave-ring{position:absolute;border:2px solid rgba(204,0,0,.55);border-radius:50%;animation:demoWave 2s ease-out infinite;opacity:0;}
.demo-wave-ring:nth-child(2){animation-delay:.45s;}
.demo-wave-ring:nth-child(3){animation-delay:.9s;}
.demo-wave-core{width:18px;height:18px;background:var(--signal);border-radius:50%;animation:demoPulse 1.2s ease-in-out infinite;box-shadow:0 0 18px rgba(204,0,0,.5);}
.demo-thinking-text{font-size:.9rem;color:rgba(255,255,255,.7);font-weight:500;letter-spacing:.02em;}
@keyframes demoWave{0%{width:22px;height:22px;opacity:.8;}100%{width:90px;height:90px;opacity:0;}}
@keyframes demoPulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.25);opacity:.75;}}

/* compare */
.compare{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;}
.cmp-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;border-bottom:1px solid var(--line);}
.cmp-row:last-child{border-bottom:none;}
.cmp-head{background:#fafbfc;}
.cmp-cap{padding:16px 20px;font-size:.94rem;font-weight:600;color:#2a2f38;}
.cmp-head .cmp-cap{font-size:11px;letter-spacing:.12em;color:var(--muted);font-weight:500;}
.cmp-col{padding:16px 12px;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:#57606e;}
.cmp-col-hi{background:#fdf6f6;color:var(--signal);}
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
.comply{display:grid;grid-template-columns:1.4fr .6fr;gap:44px;align-items:center;}
.comply-copy .sec-lead{margin-bottom:24px;text-align:left;}
.comply-copy .sec-h2{text-align:left;white-space:normal;}
.comply-copy .eyebrow{text-align:left;}
.comply-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.comply-item{display:flex;align-items:center;gap:9px;color:rgba(255,255,255,.9);font-size:.95rem;font-weight:600;font-family:'Sora',sans-serif;}
.comply-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:40px 22px;color:#fff;background:linear-gradient(160deg,rgba(204,0,0,.2),rgba(255,255,255,.02));}
.comply-badge .font-mono{font-size:11px;letter-spacing:.14em;color:rgba(255,255,255,.72);text-align:center;}
@media(max-width:820px){.comply{grid-template-columns:1fr;gap:30px;}.comply-list{grid-template-columns:1fr;}}

/* quotes */
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.quote{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;}
.quote-t{font-size:1.02rem;line-height:1.55;color:#22262e;margin:0 0 20px;font-weight:500;}
.quote-by{display:flex;flex-direction:column;gap:2px;}
.quote-n{font-weight:800;font-size:.98rem;}
.quote-r{font-size:.84rem;color:var(--muted);}
@media(max-width:860px){.quotes{grid-template-columns:1fr;}}

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
.story-h{font-weight:800;font-size:clamp(1.6rem,2.7vw,2.3rem);line-height:1.1;letter-spacing:-.03em;margin:0 0 16px;}
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

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
`;
