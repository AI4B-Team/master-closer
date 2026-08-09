import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const TITLE = "Privacy Policy — Master Closer";
const DESC = "How Master Closer collects, uses, stores and protects call recordings, transcripts and CRM data.";

export const Route = createFileRoute("/legal/privacy")({
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
      title="Privacy Policy"
      updated="August 2026"
      intro="Master Closer powers live sales conversations, so we handle sensitive data: phone numbers, call audio, transcripts and deal records. This policy explains what we collect, why we collect it, and the controls you have."
      sections={[
        {
          heading: "1. Information We Collect",
          body: [
            "Account data: name, work email, company, role and billing details for workspace owners and members.",
            "Conversation data: outbound and inbound call metadata, recordings where permitted, transcripts, AI coaching suggestions and call outcomes.",
            "CRM data you provide: leads, contact details, pipeline stages, notes, tasks and agreements uploaded or created inside the workspace.",
            "Technical data: IP address, device and browser information, and product usage events used to secure and improve the service.",
          ],
        },
        {
          heading: "2. How We Use Information",
          body: [
            "To operate the dialer, generate live AI responses and coaching, score calls, and maintain your pipeline and reporting.",
            "To enforce compliance features such as consent disclosures, DNC checks and state-specific recording rules.",
            "To secure accounts, prevent abuse, provide support and satisfy legal obligations.",
            "We do not sell your data, and we do not use your customers' call content to train third-party foundation models.",
          ],
        },
        {
          heading: "3. Recordings And Transcripts",
          body: [
            "Recording behavior is controlled per workspace and per state rule set. In all-party consent jurisdictions the AI or your rep must deliver the configured disclosure before the conversation proceeds.",
            "Recordings and transcripts are stored in private, workspace-scoped storage. Only members of that workspace may access them.",
          ],
        },
        {
          heading: "4. Sharing And Subprocessors",
          body: [
            "We share data only with subprocessors required to deliver the service: cloud hosting and database providers, telephony carriers, AI model providers, and payment processors. Each is bound by contractual confidentiality and security terms.",
            "We may disclose information when required by law or to protect the rights and safety of users.",
          ],
        },
        {
          heading: "5. Retention",
          body: [
            "Account and CRM records are retained for the life of the workspace. Recordings and transcripts follow the retention window configured in your compliance settings. Deleting a workspace removes its data from active systems and from backups on our standard backup cycle.",
          ],
        },
        {
          heading: "6. Your Rights",
          body: [
            "Workspace members can export, correct or delete records they have permission to access. Consumers whose data is processed through a workspace may submit access or deletion requests to the workspace operator, or to us and we will route the request.",
            "Depending on your location you may have rights under GDPR, CCPA/CPRA or similar laws, including access, correction, deletion, portability and objection.",
          ],
        },
        {
          heading: "7. Security",
          body: [
            "Data is encrypted in transit and at rest. Access is row-level scoped to a single workspace, storage buckets are private, and privileged operations are audited. Optional two-factor authentication is available for every account.",
          ],
        },
        {
          heading: "8. Changes",
          body: [
            "We will post updates to this page and, for material changes, notify workspace owners by email before the change takes effect.",
          ],
        },
      ]}
    />
  ),
});
