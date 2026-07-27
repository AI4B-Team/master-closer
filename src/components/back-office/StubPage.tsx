import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/back-office/AppShell";
import type { LucideIcon } from "lucide-react";

export function StubPage({
  title, description, icon: Icon, note,
}: { title: string; description: string; icon: LucideIcon; note?: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="p-12 rounded-2xl border-[#E7E7EC] shadow-none text-center">
        <Icon className="h-10 w-10 mx-auto text-[#CC0000] mb-4" />
        <h3 className="font-semibold text-lg">Coming In The Next Build Phase</h3>
        <p className="text-sm text-[#6B6B76] mt-2 max-w-md mx-auto">
          {note ?? "The data model is live. The UI ships in the next iteration of this module."}
        </p>
      </Card>
    </div>
  );
}
