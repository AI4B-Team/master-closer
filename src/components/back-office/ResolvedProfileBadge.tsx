import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { BotMessageSquare, TriangleAlert } from "lucide-react";
import { resolveProfileForLead } from "@/lib/closer-profiles.functions";

/**
 * Shows which closer profile this lead would actually get, and why.
 * The resolution order is industry+source, then industry, then workspace default,
 * then the platform industry default — so operators can see the fallback in play.
 */
export function ResolvedProfileBadge({ leadId }: { leadId: string }) {
  const resolve = useServerFn(resolveProfileForLead);
  const { data, isLoading } = useQuery({
    queryKey: ["resolved-closer-profile", leadId],
    queryFn: () => resolve({ data: { leadId } }),
  });

  if (isLoading) return <span className="text-xs text-[#6B6B76]">Resolving closer…</span>;
  if (!data) return null;

  if (!data.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#CC0000]">
        <TriangleAlert className="h-3.5 w-3.5" /> No closer profile matches this lead
      </span>
    );
  }

  return (
    <Link to="/closer-profiles" className="inline-flex items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <BotMessageSquare className="h-3.5 w-3.5" />
        <span className="truncate max-w-[180px]">{data.profileName}</span>
      </Badge>
      <span className="text-xs text-[#6B6B76]">
        {data.matchedLabel}
        {data.isPlatformDefault ? " · platform" : ""}
      </span>
    </Link>
  );
}
