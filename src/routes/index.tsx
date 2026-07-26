import { createFileRoute } from "@tanstack/react-router";
import MasterCloser from "@/components/MasterCloser";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Master Closer — Close Every Conversation" },
      {
        name: "description",
        content:
          "Master Closer runs the whole sales call, warms leads and hands off to your closer, or whispers the next line while your rep talks. One dial, every call.",
      },
      { property: "og:title", content: "Master Closer — Close Every Conversation" },
      {
        property: "og:description",
        content:
          "Real-time sales AI: full autonomy, warm handoff, or human + copilot. Runs, assists, and closes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MasterCloser,
});
