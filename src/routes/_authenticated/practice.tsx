import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Practice Mode"
      description="Rehearse against an AI prospect. Live feedback, tracked improvement."
      icon={GraduationCap}
    />
  ),
});
