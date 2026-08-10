import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  User, Lock, Bell, CreditCard, ShieldCheck, Plug, Settings, Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: "/account" | "/payments" | "/compliance" | "/integrations" | "/settings" | "/activity";
  search?: { tab: "profile" | "security" | "notifications" };
};

const GROUPS: { label: string; items: NavDef[] }[] = [
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", icon: User, to: "/account", search: { tab: "profile" } },
      { key: "security", label: "Security", icon: Lock, to: "/account", search: { tab: "security" } },
      { key: "notifications", label: "Notifications", icon: Bell, to: "/account", search: { tab: "notifications" } },
    ],
  },
  {
    label: "Workspace",
    items: [
      { key: "settings", label: "Settings", icon: Settings, to: "/settings" },
      { key: "payments", label: "Payments", icon: CreditCard, to: "/payments" },
    ],
  },
  {
    label: "Automation",
    items: [
      { key: "integrations", label: "Integrations", icon: Plug, to: "/integrations" },
      { key: "activity", label: "Activity Log", icon: Activity, to: "/activity" },
    ],
  },

  {
    label: "Compliance",
    items: [{ key: "compliance", label: "Compliance", icon: ShieldCheck, to: "/compliance" }],
  },
];

export function AccountShell({ current, children }: { current: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Account" className="min-w-0 lg:sticky lg:top-6">
        <div className="mb-4 hidden text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:block">
          Account &amp; Workspace
        </div>
        <div className="flex min-w-0 gap-4 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {GROUPS.map((g) => (
            <div key={g.label} className="min-w-0 shrink-0 lg:shrink">

              <div className="mb-1.5 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 lg:block">
                {g.label}
              </div>
              <div className="flex gap-1.5 lg:flex-col">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.to === "/account" ? item.key === current : pathname === item.to;
                  return (
                    <Link
                      key={item.key}
                      to={item.to}
                      {...(item.search ? { search: item.search } : {})}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
