import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";
import { TAB_GROUPS } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated/playbook")({
  head: () => ({
    meta: [
      { title: "Playbook — Master Closer" },
      { name: "description", content: "Scripts, objections, and exact closing lines your AI Closers draw from." },
      { property: "og:title", content: "Playbook — Master Closer" },
      { property: "og:description", content: "Scripts, objections, and exact closing lines your AI Closers draw from." },
    ],
  }),
  component: () => (
    <StubPage
      title="AI Studio"
      description="Playbook — the library your AI Closers draw from: scripts, objections, exact lines."
      icon={BookOpen}
      tabs={TAB_GROUPS.studio}
    />
  ),
});
