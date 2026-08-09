import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export type LegalSection = { heading: string; body: string[] };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0B0E", color: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 96px" }}>
        <Link
          to="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.72)", fontWeight: 600, fontSize: 14 }}
        >
          <ArrowLeft size={16} /> Back To Home
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 40 }}>
          <ShieldCheck size={18} color="#CC0000" />
          <span style={{ fontSize: 12, letterSpacing: ".14em", fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
            MASTER CLOSER LEGAL
          </span>
        </div>

        <h1 style={{ fontSize: 44, lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 800, margin: "14px 0 10px" }}>
          {title}
        </h1>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, margin: 0 }}>Last Updated: {updated}</p>
        <p style={{ color: "rgba(255,255,255,.78)", fontSize: 17, lineHeight: 1.7, marginTop: 24 }}>{intro}</p>

        <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "36px 0" }} />

        {sections.map((s) => (
          <section key={s.heading} style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" }}>{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ color: "rgba(255,255,255,.7)", fontSize: 16, lineHeight: 1.75, margin: "0 0 12px" }}>
                {p}
              </p>
            ))}
          </section>
        ))}

        <div style={{ height: 1, background: "rgba(255,255,255,.1)", margin: "36px 0 20px" }} />
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14 }}>
          Questions about this policy? Email{" "}
          <a href="mailto:legal@mastercloser.ai" style={{ color: "#FF6A55" }}>
            legal@mastercloser.ai
          </a>
          .
        </p>
        <p style={{ color: "rgba(255,255,255,.35)", fontSize: 13, marginTop: 26 }}>
          This page is provided for general information and is not legal advice.
        </p>
      </div>
    </div>
  );
}
