import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const TITLE = "Consent & AI Disclosure Policy — Master Closer";
const DESC = "How Master Closer handles AI disclosure, call recording consent and state-by-state consent rules.";

export const Route = createFileRoute("/legal/consent")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Consent & AI Disclosure Policy"
      updated="August 2026"
      intro="Every conversation on Master Closer is designed to be transparent. This policy describes when an AI disclosure is delivered, how recording consent is captured, and how state rules are enforced inside the product."
      sections={[
        {
          heading: "1. AI Disclosure",
          body: [
            "When a call is run in AI or Hybrid mode, the disclosure script configured in your Compliance Center is spoken before the conversation begins. It identifies the caller, states that an automated assistant is on the line, and notes that the call may be recorded.",
            "In Copilot mode a human leads the call, so the platform surfaces a Read Disclosure card. In states classified as Required, the call surface stays gated until the rep confirms the disclosure was read.",
          ],
        },
        {
          heading: "2. Recording Consent",
          body: [
            "Recording behavior follows the strictest rule that applies to the parties on the call. In all-party consent jurisdictions, recording only proceeds after the disclosure is delivered and the prospect does not object.",
            "If a prospect objects, the rep or AI must stop recording or end the call. Objections are logged against the lead record.",
          ],
        },
        {
          heading: "3. State Rules",
          body: [
            "The Compliance Center maintains a state rule table covering one-party, all-party and Required-disclosure jurisdictions, including states such as California, Florida, Illinois, Pennsylvania and Washington that impose all-party consent.",
            "Workspace owners can review and update the disclosure script and delivery method, but cannot disable delivery in a Required state.",
          ],
        },
        {
          heading: "4. Do Not Call",
          body: [
            "Internal DNC entries are checked before every dial, and a prospect's request to stop contact is honored immediately and recorded. Suppression applies across every campaign in the workspace.",
          ],
        },
        {
          heading: "5. Prospect Requests",
          body: [
            "A prospect may ask for a copy or deletion of their recording and transcript. Requests received by us are routed to the workspace operating the campaign, who must respond within the timeframe required by applicable law.",
            "To submit a request directly, email privacy@mastercloser.ai with the phone number and approximate call date.",
          ],
        },
        {
          heading: "6. Operator Responsibility",
          body: [
            "The workspace placing calls is the caller of record and remains responsible for lawful basis, calling hours, consent records and industry-specific rules. Master Closer provides the controls; you configure and supervise them.",
          ],
        },
      ]}
    />
  ),
});
