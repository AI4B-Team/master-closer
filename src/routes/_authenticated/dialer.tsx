import { createFileRoute } from "@tanstack/react-router";
import { PhoneOutgoing } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/dialer")({
  head: () => ({ meta: [{ title: "Dialer — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Dialer"
      description="Native outbound with autonomy-aware pacing and consent guardrails."
      icon={PhoneOutgoing}
      note="Phase A (Click-To-Dial) → Phase B (Power) → Phase C (AI-Voice) → Phase D (Predictive). Each phase is gated by consent and calling windows."
    />
  ),
});
