import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/playbook")({
  head: () => ({ meta: [{ title: "Playbook — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Playbook & Objections"
      description="The library your AI Closers draw from — scripts, objections, exact lines."
      icon={BookOpen}
    />
  ),
});
