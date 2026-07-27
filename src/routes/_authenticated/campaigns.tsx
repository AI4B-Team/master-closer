import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { StubPage } from "@/components/back-office/StubPage";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Master Closer" }] }),
  component: () => (
    <StubPage
      title="Campaigns"
      description="Outbound campaigns tied to lists, agents, and autonomy modes."
      icon={Megaphone}
    />
  ),
});
