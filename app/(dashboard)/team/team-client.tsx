"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, 
  Users,
  UserX
} from "lucide-react";

interface Member {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
}

interface TeamClientProps {
  initialMembers: Member[];
  currentUser: {
    id?: string;
    email?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function TeamClient({ initialMembers, currentUser }: TeamClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);

  // States
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const isAdminOrOwner = currentUser.role === "ADMIN" || currentUser.role === "OWNER";

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingMemberId(userId);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      const updated = await res.json();
      setMembers(members.map(m => m.user_id === userId ? { ...m, role: updated.role } : m));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error updating role.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setDeletingMemberId(userId);
    try {
      const res = await fetch(`/api/team?userId=${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove member");
      }

      setMembers(members.filter(m => m.user_id !== userId));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error removing member.");
    } finally {
      setDeletingMemberId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto rounded border border-mist bg-paper-white p-24 flex flex-col gap-24 shadow-sm">
      {/* Team Management Card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <Users className="size-[20px] text-iris-violet" />
          <h2 className="font-lustria text-xl font-semibold text-graphite-ink">Team Members</h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider px-[8px] py-[2px] rounded bg-soft-snow border border-mist text-slate font-medium select-none">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      <div className="space-y-[16px] divide-y divide-mist">
        {members.map((member) => {
          const isSelf = member.email === currentUser.email;
          const isTargetOwner = member.role === "OWNER";
          const canManage = isAdminOrOwner && !isTargetOwner && !isSelf;

          return (
            <div key={member.user_id} className="flex items-center justify-between pt-[16px] first:pt-0">
              <div className="flex items-center gap-[12px] min-w-0">
                {member.avatar_url ? (
                  <img 
                    src={member.avatar_url} 
                    alt={member.name || "User Avatar"} 
                    className="size-40 rounded-full border border-mist object-cover shrink-0"
                  />
                ) : (
                  <div className="size-40 rounded-full border border-mist bg-soft-snow flex items-center justify-center font-bold text-slate text-sm shrink-0 select-none">
                    {(member.name || member.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-graphite-ink truncate">
                    {member.name || "Pending User"}
                    {isSelf && <span className="text-xs text-iris-violet font-bold ml-[6px]">(You)</span>}
                  </span>
                  <span className="text-xs text-slate truncate mt-[2px]">{member.email}</span>
                </div>
              </div>

              {/* Role Switcher or Badge */}
              <div className="flex items-center gap-[12px]">
                {canManage ? (
                  <div className="flex items-center gap-[8px]">
                    <select
                      disabled={updatingMemberId === member.user_id}
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                      className="bg-paper-white border border-mist rounded text-graphite-ink text-xs font-semibold px-[8px] py-[4px] focus:outline-hidden cursor-pointer"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="OPERATOR">Operator</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    {updatingMemberId === member.user_id && <Loader2 className="size-[12px] animate-spin text-slate" />}
                  </div>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate bg-soft-snow border border-mist px-[8px] py-[2px] rounded leading-none select-none">
                    {member.role}
                  </span>
                )}

                {/* Remove Button */}
                {canManage && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={deletingMemberId === member.user_id}
                    className="hover:bg-rose-50 hover:text-rose-600 p-[8px] text-slate rounded transition-all cursor-pointer border border-transparent hover:border-rose-100 flex items-center justify-center"
                  >
                    {deletingMemberId === member.user_id ? (
                      <Loader2 className="size-[16px] animate-spin" />
                    ) : (
                      <UserX className="size-[16px]" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
