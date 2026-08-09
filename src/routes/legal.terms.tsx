import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const TITLE = "Terms Of Service — Master Closer";
const DESC = "The agreement governing use of the Master Closer AI calling platform, back office and dialer.";

export const Route = createFileRoute("/legal/terms")({
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
      title="Terms Of Service"
      updated="August 2026"
      intro="These terms govern your access to the Master Closer platform, including the AI calling modes, the dialer, the back office and all related APIs. By creating a workspace you agree to them on behalf of yourself and your organization."
      sections={[
        {
          heading: "1. The Service",
          body: [
            "Master Closer provides AI-assisted sales calling in three modes: AI runs the call, Hybrid where AI starts and a human closes, and Copilot where a human leads and AI assists with live suggested responses.",
            "We may add, change or remove features. We will not materially degrade a paid feature during an active billing term without notice.",
          ],
        },
        {
          heading: "2. Your Account",
          body: [
            "You are responsible for the accuracy of your account information, for keeping credentials secure, and for the activity of every member you invite to your workspace.",
            "Accounts are for named humans. Do not share logins across people.",
          ],
        },
        {
          heading: "3. Acceptable Use And Calling Compliance",
          body: [
            "You must have a lawful basis to contact every number you dial and must honor DNC lists, calling-hour restrictions and applicable consent requirements.",
            "You may not disable or misrepresent the required disclosure in jurisdictions where it is mandated, impersonate another organization, or use the platform for fraud, harassment, or the sale of prohibited products.",
            "You are the caller of record. You remain responsible for compliance with TCPA, state recording laws, and any regulations specific to your industry.",
          ],
        },
        {
          heading: "4. AI Output",
          body: [
            "AI suggestions, scripts and summaries are generated automatically and may be inaccurate. You are responsible for reviewing claims made on your calls and for any commitments made to a prospect.",
            "Do not use AI output to make legal, medical, financial or eligibility promises you are not authorized to make.",
          ],
        },
        {
          heading: "5. Fees And Billing",
          body: [
            "Subscription and usage fees are billed in advance or in arrears as described at purchase. Usage-based charges such as call minutes and AI processing are metered and invoiced monthly.",
            "Late or failed payments may result in suspension. Fees are non-refundable except where required by law.",
          ],
        },
        {
          heading: "6. Your Data",
          body: [
            "You own your leads, recordings, transcripts and agreements. You grant us the limited license needed to host and process that data to deliver the service. Handling is described in the Privacy Policy.",
          ],
        },
        {
          heading: "7. Termination",
          body: [
            "You may cancel at any time; access continues to the end of the paid term. We may suspend or terminate accounts for material breach, unlawful calling activity, or non-payment.",
          ],
        },
        {
          heading: "8. Disclaimers And Liability",
          body: [
            "The service is provided \"as is\" without warranties of any kind. To the maximum extent permitted by law our aggregate liability is limited to the fees you paid in the twelve months preceding the claim, and we are not liable for indirect or consequential damages, including regulatory penalties arising from your calling practices.",
          ],
        },
        {
          heading: "9. Changes To These Terms",
          body: [
            "We will post revisions here and notify workspace owners of material changes. Continued use after the effective date constitutes acceptance.",
          ],
        },
      ]}
    />
  ),
});
