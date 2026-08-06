import { PageHeader } from "@/components/back-office/AppShell";
import { EmptyState, Panel } from "@/components/back-office/ui";
import type { LucideIcon } from "lucide-react";

export function StubPage({
  title, description, icon: Icon, note, tabs,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  note?: string;
  tabs?: { label: string; to: string }[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} tabs={tabs} />
      <Panel>
        <EmptyState
          icon={Icon}
          title="Coming In The Next Build Phase"
          hint={note ?? "The data model is live. The UI ships in the next iteration of this module."}
        />
      </Panel>
    </div>
  );
}
