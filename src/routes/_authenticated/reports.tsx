import { createFileRoute, redirect } from "@tanstack/react-router";

/** Friendly alias: /reports is the name people type, the page lives at /team. */
export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: () => {
    throw redirect({ to: "/team" });
  },
});
