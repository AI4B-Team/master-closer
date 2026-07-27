import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Payments & Agreements"
      description="Take payment on the call. Send the agreement in the same breath."
      icon={CreditCard}
    />
  ),
});
