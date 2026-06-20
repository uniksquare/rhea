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
  LogOut
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Navigation Items
  const navItems = [
    { name: "Agent Chat", href: "/chat", icon: MessageSquare },
    { name: "Overview", href: "/overview", icon: LayoutGrid },
    { name: "Incidents", href: "/incidents", icon: AlertCircle },
    { name: "Team & Keys", href: "/team", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex flex-col justify-between">
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 gap-3 border-b border-zinc-800">
            <svg
              width="28"
              height="28"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="40" height="40" rx="10" fill="url(#sidebar-logo)" />
              <path
                d="M12 28V12h4.5c1.5 0 2.7.4 3.6 1.2.9.8 1.4 1.9 1.4 3.2 0 1-.3 1.8-.8 2.5-.5.7-1.2 1.2-2.1 1.4l3.4 7.7h-3l-3-7h-1.2v7H12zm2.8-9.5h1.5c.8 0 1.4-.2 1.9-.6.5-.4.7-1 .7-1.7s-.2-1.3-.7-1.7c-.5-.4-1.1-.6-1.9-.6h-1.5v4.6z"
                fill="white"
              />
              <defs>
                <linearGradient id="sidebar-logo" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#a855f7" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-semibold text-lg tracking-wide text-white">Rhea</span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 ml-auto">
              SaaS
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all group"
                >
                  <Icon className="size-4 shrink-0 text-zinc-500 group-hover:text-purple-400 transition-colors" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile section at the bottom */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User avatar"}
                className="size-9 rounded-full border border-zinc-700 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-semibold text-white text-xs shrink-0">
                {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-200 truncate">
                {session.user.name || "User"}
              </span>
              <span className="text-[10px] text-zinc-500 truncate leading-none mt-0.5">
                {session.user.email}
              </span>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-purple-950/20 text-purple-400 border border-purple-800/30 shrink-0">
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
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-400 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-750 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="size-3.5 text-zinc-500 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        <main className="flex-1 overflow-y-auto relative p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
