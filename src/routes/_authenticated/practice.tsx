import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";
import { TAB_GROUPS } from "@/components/back-office/AppShell";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Practice — Master Closer" },
      { name: "description", content: "Scored AI roleplay so reps drill objections before they hit a live call." },
      { property: "og:title", content: "Practice — Master Closer" },
      { property: "og:description", content: "Scored AI roleplay so reps drill objections before they hit a live call." },
    ],
  }),
  component: () => (
    <StubPage
      title="AI Studio"
      description="Practice — scored AI roleplay so reps drill objections before a live call."
      icon={GraduationCap}
      tabs={TAB_GROUPS.studio}
    />
  ),
});
