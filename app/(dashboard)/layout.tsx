import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  LayoutGrid, 
  AlertCircle, 
  MessageSquare, 
  Users, 
  Settings,
  Shield,
  LogOut,
  Plug
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

// Custom Starburst/Sparkle Icon for Logo
function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const navItems = [
    { name: "Agent Chat", href: "/chat", icon: MessageSquare },
    { name: "Overview", href: "/overview", icon: LayoutGrid },
    { name: "Incidents", href: "/incidents", icon: AlertCircle },
    { name: "Integrations", href: "/connectors", icon: Plug },
    { name: "Sandbox Security", href: "/sandbox", icon: Shield },
    { name: "Team & Keys", href: "/team", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-paper-white text-graphite-ink font-sans">
      
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-mist bg-soft-snow flex flex-col justify-between">
        <div className="flex flex-col">
          
          {/* Brand Header */}
          <div className="h-[64px] flex items-center px-16 gap-8 border-b border-mist shrink-0">
            <div className="flex items-center justify-center size-24 rounded bg-iris-violet text-paper-white shadow-sm">
              <StarburstIcon className="size-[14px]" />
            </div>
            <span className="font-lustria font-bold text-base tracking-tight text-graphite-ink leading-none">rhea</span>
            <span className="text-[9px] uppercase font-mono tracking-wider px-[6px] py-[2px] rounded bg-paper-white text-slate border border-mist ml-auto leading-none select-none">
              COCKPIT
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-16 space-y-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-[12px] px-[12px] py-8 rounded border border-transparent font-sans text-[13px] font-medium text-slate hover:text-graphite-ink hover:bg-paper-white hover:border-mist transition-all group"
                >
                  <Icon className="size-16 shrink-0 text-fog group-hover:text-iris-violet transition-colors" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile section at the bottom */}
        <div className="p-16 border-t border-mist bg-paper-white/30 flex flex-col gap-[12px] shrink-0">
          <div className="flex items-center gap-[12px]">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User avatar"}
                className="size-32 rounded-full border border-mist object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-32 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-semibold text-white text-xs shrink-0">
                {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-graphite-ink truncate">
                {session.user.name || "User"}
              </span>
              <span className="text-[10px] text-slate truncate leading-none mt-[4px]">
                {session.user.email}
              </span>
            </div>
            <span className="text-[9px] uppercase font-mono tracking-wider px-[6px] py-[2px] rounded bg-[#e6f0ff]/50 text-cobalt-info border border-powder-blue shrink-0 leading-none select-none">
              {session.user.role || "VIEWER"}
            </span>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/signin" });
            }}
            className="w-full"
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-8 px-[12px] py-8 text-xs font-mono uppercase tracking-wider text-slate bg-paper-white hover:bg-soft-snow border border-mist hover:text-graphite-ink rounded transition-all cursor-pointer shadow-sm select-none"
            >
              <LogOut className="size-[14px] text-fog shrink-0" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-paper-white">
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </div>

    </div>
  );
}
