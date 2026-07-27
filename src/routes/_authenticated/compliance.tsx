import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Consent & Compliance"
      description="Per-state consent rules, disclosure logs, recording toggles, DNC controls."
      icon={ShieldCheck}
      note="This center is how you stay defensible and how you sell trust. Not legal advice — confirm the state matrix with counsel."
    />
  ),
});
