"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  AlertCircle,
  MessageSquare,
  Users,
  Settings,
  Shield,
  LogOut,
  Plug,
  Briefcase,
  BarChart3,
  History as HistoryIcon,
  ChevronLeft,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSession {
  chat_id: string;
  title: string;
  agent_session_state: any;
  created_at: string;
  updated_at: string;
}

interface DashboardSidebarProps {
  userRole: string;
}

export function DashboardSidebar({ userRole }: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("id");

  const [view, setView] = useState<"menu" | "history">("menu");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    { name: "New Chat", href: "/chat", icon: MessageSquare },
    {
      name: "History", href: "#history", icon: HistoryIcon, onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setView("history");
      }
    },
    { name: "Overview", href: "/overview", icon: LayoutGrid },
    { name: "Incidents", href: "/incidents", icon: AlertCircle },
    { name: "Assignments", href: "/assignments", icon: Briefcase },
    { name: "Roles", href: "/roles", icon: Briefcase },
    { name: "Usage", href: "/usage", icon: BarChart3 },
    { name: "Integrations", href: "/connectors", icon: Plug },
    { name: "Computer", href: "/sandbox", icon: Shield },
    { name: "Team & Keys", href: "/team", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchChats();

    const handleUpdate = () => {
      fetchChats();
    };

    window.addEventListener("chats-updated", handleUpdate);
    return () => {
      window.removeEventListener("chats-updated", handleUpdate);
    };
  }, []);

  // Autofocus input when renaming
  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  // Keep view on history if user navigated to a chat with a specific ID
  useEffect(() => {
    if (activeChatId) {
      setView("history");
    }
  }, [activeChatId]);

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (res.ok) {
        // If we deleted the active chat, redirect to fresh chat
        if (activeChatId === chatId) {
          router.push("/chat");
        }
        fetchChats();
        window.dispatchEvent(new Event("chats-updated"));
      } else {
        alert("Failed to delete chat.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting chat.");
    }
  };

  const startRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingChatId(chat.chat_id);
    setEditTitle(chat.title);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingChatId(null);
  };

  const submitRename = async (chatId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingChatId(null);
      return;
    }

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (res.ok) {
        setEditingChatId(null);
        fetchChats();
        window.dispatchEvent(new Event("chats-updated"));
      } else {
        alert("Failed to rename chat.");
      }
    } catch (err) {
      console.error(err);
      alert("Error renaming chat.");
    }
  };

  return (
    <div className="relative flex-1 overflow-hidden w-full flex flex-col">
      {/* Slide Container */}
      <div className="relative flex-1 w-full overflow-hidden">

        {/* Pane A: Main Navigation Menu */}
        <div
          className={cn(
            "absolute inset-0 p-16 space-y-8 flex flex-col transition-all duration-300 ease-in-out",
            view === "menu"
              ? "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0 pointer-events-none"
          )}
        >
          <nav className="space-y-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href && (!activeChatId || item.href !== "/chat");

              if (item.onClick) {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={item.onClick}
                    className={cn(
                      "flex items-center gap-[12px] px-[12px] h-32 rounded border font-sans text-[14px] font-medium transition-all group",
                      isActive
                        ? "bg-paper-white border-mist text-graphite-ink shadow-2xs"
                        : "border-transparent text-slate hover:text-graphite-ink hover:bg-paper-white hover:border-mist"
                    )}
                  >
                    <Icon className={cn(
                      "size-16 shrink-0 transition-colors",
                      isActive ? "text-iris-violet" : "text-fog group-hover:text-iris-violet"
                    )} />
                    <span>{item.name}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-[12px] px-[12px] h-32 rounded border font-sans text-[14px] font-medium transition-all group",
                    isActive
                      ? "bg-paper-white border-mist text-graphite-ink shadow-2xs"
                      : "border-transparent text-slate hover:text-graphite-ink hover:bg-paper-white hover:border-mist"
                  )}
                >
                  <Icon className={cn(
                    "size-16 shrink-0 transition-colors",
                    isActive ? "text-iris-violet" : "text-fog group-hover:text-iris-violet"
                  )} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pane B: Chat History List */}
        <div
          className={cn(
            "absolute inset-0 pl-16 pr-8 py-16 flex flex-col transition-all duration-300 ease-in-out",
            view === "history"
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0 pointer-events-none"
          )}
        >
          {/* Header & Back Button */}
          <div className="flex items-center justify-between mb-16 border-b border-mist/50 pb-8">
            <button
              onClick={() => setView("menu")}
              className="flex items-center gap-[4px] text-[10px] font-mono uppercase tracking-wider text-slate hover:text-graphite-ink px-8 h-24 rounded hover:bg-paper-white border border-transparent hover:border-mist transition-all cursor-pointer"
            >
              <ChevronLeft className="size-[14px]" />
              <span>Back</span>
            </button>
            <span className="text-[10px] font-sans font-bold text-slate uppercase tracking-wider">
              Chat History
            </span>
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto scrollbar-minimal space-y-8 pr-[2px] min-h-0 select-none">
            {isLoadingChats && chats.length === 0 ? (
              <div className="flex items-center justify-center py-32 text-slate text-xs gap-8">
                <Loader2 className="size-14 animate-spin text-iris-violet" />
                <span>Loading history...</span>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-32 text-slate text-xs font-sans">
                No past chats found
              </div>
            ) : (
              chats.map((chat) => {
                const isActive = activeChatId === chat.chat_id;
                const isEditing = editingChatId === chat.chat_id;

                return (
                  <div
                    key={chat.chat_id}
                    className={cn(
                      "group relative flex items-center justify-between rounded border transition-all text-[13px] font-medium font-sans cursor-pointer h-32 overflow-hidden",
                      isActive
                        ? "bg-paper-white border-mist text-graphite-ink shadow-2xs"
                        : "border-transparent text-slate hover:text-graphite-ink hover:bg-paper-white hover:border-mist"
                    )}
                    onClick={() => {
                      if (!isEditing) {
                        router.push(`/chat?id=${chat.chat_id}`);
                      }
                    }}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-4 w-full px-8 h-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename(chat.chat_id);
                            if (e.key === "Escape") setEditingChatId(null);
                          }}
                          className="flex-1 bg-white border border-mist rounded px-8 h-24 text-[13px] font-sans text-graphite-ink focus:outline-hidden focus:border-iris-violet min-w-0"
                        />
                        <button
                          onClick={() => submitRename(chat.chat_id)}
                          className="p-4 hover:bg-soft-snow rounded text-emerald-600 cursor-pointer shrink-0"
                        >
                          <Check className="size-[14px]" />
                        </button>
                        <button
                          onClick={cancelRename}
                          className="p-4 hover:bg-soft-snow rounded text-rose-600 cursor-pointer shrink-0"
                        >
                          <X className="size-[14px]" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-[10px] pl-[12px] pr-[12px] group-hover:pr-[80px] h-full min-w-0 flex-1 transition-all duration-200">
                          <MessageSquare className={cn(
                            "size-[14px] shrink-0",
                            isActive ? "text-iris-violet" : "text-fog"
                          )} />
                          <span className="truncate text-[13px]" title={chat.title}>
                            {chat.title}
                          </span>
                        </div>

                        {/* Action buttons (Rename & Delete) */}
                        <div className="absolute right-[1px] top-[1px] bottom-[1px] flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity bg-gradient-to-l from-paper-white via-paper-white via-80% to-transparent pl-16 pr-8 rounded-r-[3px]">
                          <button
                            onClick={(e) => startRename(e, chat)}
                            className="p-4 hover:bg-soft-snow rounded text-slate hover:text-graphite-ink cursor-pointer"
                            title="Rename chat"
                          >
                            <Edit2 className="size-[14px]" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, chat.chat_id)}
                            className="p-2 hover:bg-white rounded text-slate hover:text-rose-600 cursor-pointer"
                            title="Delete chat"
                          >
                            <Trash2 className="size-[14px]" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
