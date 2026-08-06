import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Reports — Master Closer" },
      { name: "description", content: "Rep leaderboards, close rates, revenue, and per-rep AI / Hybrid / Copilot usage." },
      { property: "og:title", content: "Reports — Master Closer" },
      { property: "og:description", content: "Rep leaderboards, close rates, revenue, and per-rep AI / Hybrid / Copilot usage." },
    ],
  }),
  component: () => (
    <StubPage
      title="Reports"
      description="Leaderboards, responsiveness, and per-rep mode-usage breakdown."
      icon={BarChart3}
    />
  ),
});
