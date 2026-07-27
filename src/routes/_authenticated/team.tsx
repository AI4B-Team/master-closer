import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team & Performance — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Team & Performance"
      description="Reps, close rates, revenue, and mode-usage breakdown per rep."
      icon={BarChart3}
    />
  ),
});
