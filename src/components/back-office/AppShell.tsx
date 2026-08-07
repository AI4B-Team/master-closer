import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, PhoneCall, Megaphone, Bot, BarChart3,
  CreditCard, Settings, Crosshair, ChevronsLeft, ChevronsRight,
  ChevronDown, ChevronRight, Check, Search, Bell, LogOut, Zap, UserPlus, Mail, Languages, Sun,
  Youtube, Instagram, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/back-office/ui";


type NavItem = { to: string; label: string; icon: any; also?: string[] };

const NAV_PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users, also: ["/pipeline"] },
  { to: "/calls", label: "Calls", icon: PhoneCall, also: ["/dialer"] },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, also: ["/lists"] },
  { to: "/ai-closers", label: "AI Studio", icon: Bot, also: ["/playbook", "/practice"] },
  { to: "/team", label: "Reports", icon: BarChart3, also: ["/members"] },
];

/* Payments, Compliance, Integrations and Settings now live on the Account page. */


/** Tab groups: consolidated nav homes that render as tabbed sub-views. */
export const TAB_GROUPS: Record<string, { label: string; to: string }[]> = {
  leads: [
    { label: "List", to: "/leads" },
    { label: "Pipeline", to: "/pipeline" },
  ],
  calls: [
    { label: "Live Dialer", to: "/dialer" },
    { label: "History", to: "/calls" },
    { label: "Agreements", to: "/agreements" },
  ],
  studio: [
    { label: "Closers", to: "/ai-closers" },
    { label: "Playbook", to: "/playbook" },
    { label: "Practice", to: "/practice" },
  ],
  campaigns: [
    { label: "Campaigns", to: "/campaigns" },
    { label: "Lists", to: "/lists" },
  ],
  reports: [
    { label: "Overview", to: "/team" },
    { label: "Team", to: "/members" },
  ],
};

function isActive(pathname: string, item: NavItem) {
  return [item.to, ...(item.also ?? [])].some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

const SEARCH_SCOPES = ["Everything", "Leads", "Calls", "Campaigns", "Deals", "Notes"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [scope, setScope] = useState<(typeof SEARCH_SCOPES)[number]>("Everything");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = (user?.user_metadata?.full_name as string) || user?.email || "Account";
  const displayName =
    (user?.user_metadata?.full_name as string) || (user?.email ?? "Account").split("@")[0];



  const renderNav = (items: NavItem[], muted = false) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(pathname, item);
      return (
        <Link
          key={item.to}
          to={item.to}
          title={item.label}
          className={`nav-item ${muted ? "nav-muted" : ""} ${active ? "nav-on" : ""}`}
        >
          <span className="nav-ico">
            <Icon size={muted ? 16 : 17} strokeWidth={muted ? 2 : 2.1} />
          </span>
          {!collapsed && <span className="nav-label">{item.label}</span>}
        </Link>
      );
    });

  return (
    <div className="mc-shell">
      <aside className={"side " + (collapsed ? "side-collapsed" : "")}>
        <div className="side-brand">
          <span className="side-mark">
            <Crosshair size={17} strokeWidth={2.6} />
          </span>
          {!collapsed && <span className="side-word font-display">Master Closer</span>}
          <button
            type="button"
            className="side-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
        </div>

        <nav className="side-nav">{renderNav(NAV_PRIMARY)}</nav>

      </aside>


      <div className={"main " + (collapsed ? "main-collapsed" : "")}>
        <header className="topbar">
          <div className="search-wrap">
            <div className="search">
              <Search size={15} />
              <input placeholder={`Search ${scope}…`} />
              <button
                type="button"
                className="search-caret"
                onClick={() => setScopeOpen((v) => !v)}
                aria-label="Search options"
              >
                {scope} <ChevronDown size={14} />
              </button>
            </div>
            {scopeOpen && (
              <div className="search-menu">
                <div className="search-menu-label">Search in</div>
                {SEARCH_SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-on={s === scope}
                    onClick={() => {
                      setScope(s);
                      setScopeOpen(false);
                    }}
                  >
                    {s === scope && <Check size={14} />} {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <span className="status-chip">
              <span className="status-dot" /> On Call
            </span>
            <button type="button" className="icon-btn" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <div className="profile-wrap">
              <button
                type="button"
                className="profile-btn"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Profile menu"
              >
                <Avatar name={name} size={36} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="pm-id">
                    <Avatar name={name} size={48} />
                    <div className="pm-id-t">
                      <span className="pm-name font-display">{displayName}</span>
                      <span className="pm-email">{user?.email ?? "—"}</span>
                    </div>
                  </div>

                  <button type="button" className="pm-cta pm-cta-primary">
                    <Zap size={17} /> Upgrade
                  </button>
                  <button type="button" className="pm-cta pm-cta-outline">
                    <UserPlus size={17} /> Add Members
                  </button>

                  <div className="pm-sep" />

                  <Link to="/account" className="pm-row" onClick={() => setProfileOpen(false)}>
                    <Settings size={18} /> Account
                  </Link>
                  <Link to="/payments" className="pm-row" onClick={() => setProfileOpen(false)}>
                    <CreditCard size={18} /> Subscription
                    <span className="pm-row-meta">Pro</span>
                  </Link>
                  <Link to="/team" className="pm-row" onClick={() => setProfileOpen(false)}>
                    <Mail size={18} /> Invites
                  </Link>

                  <div className="pm-sep" />

                  <button type="button" className="pm-row">
                    <Languages size={18} /> Language:
                    <span className="pm-row-meta">
                      English <ChevronRight size={15} />
                    </span>
                  </button>
                  <button type="button" className="pm-row">
                    <Sun size={18} /> Theme:
                    <span className="pm-row-meta">
                      Light <ChevronRight size={15} />
                    </span>
                  </button>

                  <div style={{ height: 10 }} />
                  <button type="button" className="pm-cta pm-cta-amber">
                    Join Affiliate Program
                  </button>
                  <button type="button" className="pm-cta pm-cta-primary" onClick={signOut}>
                    <LogOut size={17} /> Log Out
                  </button>

                  <div className="pm-foot">
                    <span>
                      <a href="#">Terms</a> &nbsp;|&nbsp; <a href="#">Privacy</a>
                    </span>
                    <span className="pm-social">
                      <MessageCircle size={16} />
                      <Youtube size={16} />
                      <Instagram size={16} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </header>


        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function TabStrip({ tabs }: { tabs: { label: string; to: string }[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <Link key={t.to} to={t.to} className={"tab " + (pathname === t.to ? "tab-on" : "")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function PageHeader({
  title, description, action, tabs,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tabs?: { label: string; to: string }[];
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="font-display page-title">{title}</h1>
        {description && <p className="page-sub">{description}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {tabs && <TabStrip tabs={tabs} />}
        {action}
      </div>
    </div>
  );
}
