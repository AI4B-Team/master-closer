import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Users, KanbanSquare, PhoneCall, PhoneOutgoing, Megaphone,
  Bot, BookOpen, GraduationCap, BarChart3, CreditCard, ShieldCheck, Plug,
  Settings, Crosshair, LogOut, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads & Contacts", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/calls", label: "Calls & Transcripts", icon: PhoneCall },
  { to: "/dialer", label: "Dialer", icon: PhoneOutgoing },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/ai-closers", label: "AI Closers", icon: Bot },
  { to: "/playbook", label: "Playbook & Objections", icon: BookOpen },
  { to: "/practice", label: "Practice", icon: GraduationCap },
  { to: "/team", label: "Team & Performance", icon: BarChart3 },
  { to: "/payments", label: "Payments & Agreements", icon: CreditCard },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (user?.user_metadata?.full_name || user?.email || "?")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-white text-[#0B0B0F]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 border-r border-[#E7E7EC] flex flex-col fixed h-screen bg-white">
        <div className="h-14 flex items-center gap-2 px-5 border-b border-[#E7E7EC]">
          <Crosshair className="h-5 w-5 text-[#CC0000]" strokeWidth={2.5} />
          <span className="font-bold tracking-tight" style={{ fontFamily: "Sora, Inter, sans-serif" }}>
            Master Closer
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                  active
                    ? "bg-[#CC0000]/10 text-[#CC0000] font-medium"
                    : "text-[#0B0B0F] hover:bg-[#F4F4F6]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 text-[10px] text-[#6B6B76] border-t border-[#E7E7EC]">
          v0.1 · Back Office Build
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-[240px] flex flex-col min-h-screen">
        <header className="h-14 border-b border-[#E7E7EC] flex items-center justify-between px-6 sticky top-0 bg-white z-10">
          <div className="text-sm text-[#6B6B76]">
            <span className="font-medium text-[#0B0B0F]">Master Closer</span> · Back Office
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F4F4F6]">
                <div className="h-7 w-7 rounded-full bg-[#CC0000] text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <span className="text-sm max-w-[160px] truncate">{user?.email}</span>
                <ChevronDown className="h-4 w-4 text-[#6B6B76]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-[#CC0000]">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-8 bg-[#FAFAFB]">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title, description, action,
}: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "Sora, Inter, sans-serif" }}>
          {title}
        </h1>
        {description && <p className="text-sm text-[#6B6B76] mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
