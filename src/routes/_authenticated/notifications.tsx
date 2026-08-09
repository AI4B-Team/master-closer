import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/back-office/AppShell";
import { EmptyPanel, SkeletonRows } from "@/components/back-office/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_PREFS,
  ago,
  applyPrefs,
  fetchNotifications,
  fetchReadKeys,
  markNotificationsRead,
  markNotificationsUnread,
  type NotifyCategory,
  type NotifyPrefs,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Master Closer" },
      {
        name: "description",
        content: "One inbox for calls, deals, agreements, compliance flags and follow-ups across your workspace.",
      },
      { property: "og:title", content: "Notifications — Master Closer" },
      {
        property: "og:description",
        content: "One inbox for calls, deals, agreements, compliance flags and follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

const FILTERS: { value: "all" | "unread" | NotifyCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "calls", label: "Calls" },
  { value: "deals", label: "Deals" },
  { value: "leads", label: "Leads" },
  { value: "agreements", label: "Agreements" },
  { value: "compliance", label: "Compliance" },
  { value: "tasks", label: "Follow-Ups" },
];

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const wsId = workspace?.id ?? null;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  const prefs: NotifyPrefs = {
    ...DEFAULT_PREFS,
    ...(((user?.user_metadata as any)?.notify ?? {}) as Partial<NotifyPrefs>),
  };

  const { data: items, isLoading } = useQuery({
    queryKey: ["notifications", wsId, "inbox"],
    enabled: !!wsId,
    refetchInterval: 30000,
    queryFn: () => fetchNotifications(wsId!, 120),
  });

  const { data: readKeys } = useQuery({
    queryKey: ["notification-reads", wsId],
    enabled: !!wsId,
    queryFn: () => fetchReadKeys(wsId!),
  });

  const visible = useMemo(() => applyPrefs(items ?? [], prefs), [
    items,
    prefs.callSummaries,
    prefs.handoffAlerts,
    prefs.dealUpdates,
    prefs.complianceFlags,
    prefs.followUps,
  ]);

  const isRead = (key: string) => !!readKeys?.has(key);
  const unreadCount = visible.filter((i) => !isRead(i.key)).length;

  const filtered = visible.filter((i) => {
    if (filter === "all") return true;
    if (filter === "unread") return !isRead(i.key);
    return i.category === filter;
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notification-reads", wsId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const setRead = useMutation({
    mutationFn: async ({ keys, read }: { keys: string[]; read: boolean }) => {
      if (!wsId || !user?.id) return;
      if (read) await markNotificationsRead(wsId, user.id, keys);
      else await markNotificationsUnread(wsId, keys);
    },
    onSuccess: refresh,
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Everything your workspace surfaced — calls, deals, agreements, compliance and follow-ups."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              disabled={unreadCount === 0 || setRead.isPending}
              onClick={() => setRead.mutate({ keys: visible.filter((i) => !isRead(i.key)).map((i) => i.key), read: true })}
            >
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </Button>
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              disabled={!readKeys?.size || setRead.isPending}
              onClick={() => setRead.mutate({ keys: visible.map((i) => i.key), read: false })}
            >
              <RotateCcw className="h-4 w-4" /> Mark All Unread
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              filter === f.value
                ? "border-[#CC0000] text-[#CC0000] bg-[#CC0000]/5"
                : "border-[#E7E7EC] text-[#6B6B76] hover:border-[#CC0000]/40"
            }`}
          >
            {f.label}
            {f.value === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={visible.length === 0 ? Inbox : Bell}
          title={visible.length === 0 ? "Nothing Yet" : "No Notifications Match"}
          hint={
            visible.length === 0
              ? "Calls, agreements, deals and follow-ups land here as your workspace runs."
              : "Try a different filter."
          }
        />
      ) : (
        <Card className="rounded-2xl border-[#E7E7EC] shadow-none divide-y divide-[#F0F0F3] overflow-hidden">
          {filtered.map((i) => {
            const read = isRead(i.key);
            return (
              <div key={i.key} className={`flex items-start gap-3 px-5 py-4 ${read ? "" : "bg-[#CC0000]/[0.02]"}`}>
                <span
                  className="mt-1.5 h-2 w-2 rounded-full flex-none"
                  style={{ background: read ? "#D6D8DE" : "#CC0000" }}
                  aria-hidden
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setRead.mutate({ keys: [i.key], read: true });
                    navigate({ to: i.href.split("?")[0] as any, search: searchFrom(i.href) as any });
                  }}
                >
                  <p className={`text-sm ${read ? "font-medium text-[#3A3A44]" : "font-semibold text-[#141418]"}`}>
                    {i.title}
                  </p>
                  <p className="text-xs text-[#6B6B76] mt-0.5 truncate">{i.detail}</p>
                </button>
                <div className="flex items-center gap-3 flex-none">
                  <span className="text-xs text-[#9AA0AB]">{ago(i.created_at)}</span>
                  <button
                    type="button"
                    className="text-xs text-[#6B6B76] hover:text-[#CC0000]"
                    onClick={() => setRead.mutate({ keys: [i.key], read: !read })}
                  >
                    {read ? "Unread" : "Read"}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/** Turns "/calls?call=abc" into { call: "abc" } for typed navigation. */
function searchFrom(href: string) {
  const [, query] = href.split("?");
  if (!query) return undefined;
  return Object.fromEntries(new URLSearchParams(query).entries());
}
