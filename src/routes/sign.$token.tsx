import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAgreementByToken, signAgreement, declineAgreement } from "@/lib/agreements.functions";
import { money } from "@/lib/agreements";
import { printSignedCopy } from "@/lib/agreement-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, FileSignature, Download, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sign/$token")({
  loader: ({ params }) => getAgreementByToken({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Review & Sign Your Agreement — Master Closer" },
      { name: "description", content: "Review the terms discussed on your call and add your signature securely." },
      { property: "og:title", content: "Review & Sign Your Agreement — Master Closer" },
      { property: "og:description", content: "Review the terms discussed on your call and add your signature securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <Shell><Missing /></Shell>,
  notFoundComponent: () => <Shell><Missing /></Shell>,
  component: SignPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0B0E", color: "#fff", padding: "48px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <FileSignature size={18} color="#CC0000" />
          <span style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>MASTER CLOSER</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function Missing() {
  return (
    <div style={{ background: "#fff", color: "#111318", borderRadius: 20, padding: 40, textAlign: "center" }}>
      <XCircle size={30} color="#CC0000" style={{ margin: "0 auto 12px" }} />
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>This Link Is No Longer Active</h1>
      <p style={{ color: "#6B6B76", marginTop: 8 }}>
        The agreement may have been voided or replaced. Reach out to your closer for a fresh link.
      </p>
    </div>
  );
}

function SignPage() {
  const agreement = Route.useLoaderData();
  const { token } = Route.useParams();
  const doSign = useServerFn(signAgreement);
  const doDecline = useServerFn(declineAgreement);

  const [name, setName] = useState(agreement?.signerName ?? "");
  const [email, setEmail] = useState(agreement?.signerEmail ?? "");
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [typed, setTyped] = useState(agreement?.signerName ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(agreement?.status === "signed");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111318";
  }, [mode]);

  const signedRef = useRef<{ data: string; at: string } | null>(null);

  if (!agreement) return <Shell><Missing /></Shell>;


  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Enter your full legal name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Enter a valid email.");
    let signatureData = typed.trim();
    if (mode === "drawn") {
      if (!hasInk.current) return toast.error("Draw your signature first.");
      signatureData = canvasRef.current?.toDataURL("image/png") ?? "";
    } else if (signatureData.length < 2) {
      return toast.error("Type your signature.");
    }
    setBusy(true);
    try {
      await doSign({
        data: { token, signerName: name.trim(), signerEmail: email.trim(), signatureType: mode, signatureData },
      });
      signedRef.current = { data: signatureData, at: new Date().toISOString() };
      setDone(true);
      toast.success("Signed. A copy is on the record.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not record the signature.");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await doDecline({ data: { token } });
      toast.success("Declined. Your closer has been notified.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not record that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div style={{ background: "#fff", color: "#111318", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "28px 32px", borderBottom: "1px solid #EDEDF1", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{agreement.title}</h1>
            <p style={{ color: "#6B6B76", fontSize: 14, marginTop: 4 }}>
              Prepared by {agreement.orgName ?? "Master Closer"} · {money(agreement.amount, agreement.currency)}
            </p>
          </div>
          {agreement.fileUrl && (
            <Button variant="outline" className="rounded-xl" onClick={() => window.open(agreement.fileUrl!, "_blank", "noopener")}>
              <Download className="h-4 w-4 mr-1" /> {agreement.fileName ?? "Attachment"}
            </Button>
          )}
        </div>

        <pre style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.75, padding: "28px 32px", maxHeight: 460, overflow: "auto", fontFamily: "inherit" }}>
          {agreement.body}
        </pre>

        {done ? (
          <div style={{ padding: "28px 32px", background: "#E6F6EE", display: "flex", gap: 12, alignItems: "center" }}>
            <CheckCircle2 size={24} color="#0E9F6E" />
            <div>
              <div style={{ fontWeight: 700, color: "#0E7A55" }}>Signed. Nothing Else Needed.</div>
              <div style={{ fontSize: 13, color: "#4A6B5C" }}>
                A signed copy is stored with the call record. You can close this window.
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-xl ml-auto bg-white"
              onClick={() =>
                printSignedCopy({
                  title: agreement.title,
                  body: agreement.body,
                  amount: agreement.amount,
                  currency: agreement.currency,
                  orgName: agreement.orgName,
                  signerName: name.trim(),
                  signerEmail: email.trim(),
                  signedAt: signedRef.current?.at ?? new Date().toISOString(),
                  signatureType: mode,
                  signatureData: signedRef.current?.data ?? typed.trim(),
                })
              }
            >
              <Download className="h-4 w-4 mr-1" /> Download Signed Copy
            </Button>
          </div>
        ) : (
          <div style={{ padding: "28px 32px", borderTop: "1px solid #EDEDF1" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Sign Here</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <Label>Full Legal Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, margin: "16px 0 10px" }}>
              <button type="button" className={"tab " + (mode === "typed" ? "tab-on" : "")} onClick={() => setMode("typed")}>
                Type Signature
              </button>
              <button type="button" className={"tab " + (mode === "drawn" ? "tab-on" : "")} onClick={() => setMode("drawn")}>
                Draw Signature
              </button>
            </div>

            {mode === "typed" ? (
              <div style={{ border: "1px dashed #D9D9E0", borderRadius: 14, padding: "14px 16px" }}>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Your name"
                  style={{ fontFamily: "cursive", fontSize: 30, border: 0, outline: "none", width: "100%" }}
                />
              </div>
            ) : (
              <div style={{ border: "1px dashed #D9D9E0", borderRadius: 14, position: "relative" }}>
                <canvas
                  ref={canvasRef}
                  width={760}
                  height={150}
                  style={{ width: "100%", height: 150, touchAction: "none", borderRadius: 14 }}
                  onPointerDown={(e) => {
                    drawing.current = true;
                    hasInk.current = true;
                    const ctx = canvasRef.current?.getContext("2d");
                    const p = point(e);
                    ctx?.beginPath();
                    ctx?.moveTo(p.x, p.y);
                  }}
                  onPointerMove={(e) => {
                    if (!drawing.current) return;
                    const ctx = canvasRef.current?.getContext("2d");
                    const p = point(e);
                    ctx?.lineTo(p.x, p.y);
                    ctx?.stroke();
                  }}
                  onPointerUp={() => (drawing.current = false)}
                  onPointerLeave={() => (drawing.current = false)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const c = canvasRef.current;
                    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
                    hasInk.current = false;
                  }}
                  style={{ position: "absolute", top: 8, right: 10, fontSize: 12, color: "#6B6B76" }}
                >
                  Clear
                </button>
              </div>
            )}

            <p style={{ fontSize: 12, color: "#6B6B76", margin: "12px 0 16px", display: "flex", gap: 6, alignItems: "center" }}>
              <ShieldCheck size={14} color="#0E9F6E" />
              By signing you agree these terms are binding. Your name, email, timestamp and IP are recorded.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <Button className="bg-[#CC0000] hover:bg-[#A30000] rounded-xl" disabled={busy} onClick={submit}>
                <FileSignature className="h-4 w-4 mr-1" /> Sign Agreement
              </Button>
              <Button variant="ghost" disabled={busy} onClick={decline}>Decline</Button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
