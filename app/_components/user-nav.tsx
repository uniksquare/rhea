"use client";

import { signOut } from "next-auth/react";
import styles from "./user-nav.module.css";

interface UserNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    orgId?: string;
  };
}

export function UserNav({ user }: UserNavProps) {
  return (
    <div className={styles.navbar}>
      <div className={styles.brand}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="40" height="40" rx="10" fill="url(#nav-logo)" />
          <path
            d="M12 28V12h4.5c1.5 0 2.7.4 3.6 1.2.9.8 1.4 1.9 1.4 3.2 0 1-.3 1.8-.8 2.5-.5.7-1.2 1.2-2.1 1.4l3.4 7.7h-3l-3-7h-1.2v7H12zm2.8-9.5h1.5c.8 0 1.4-.2 1.9-.6.5-.4.7-1 .7-1.7s-.2-1.3-.7-1.7c-.5-.4-1.1-.6-1.9-.6h-1.5v4.6z"
            fill="white"
          />
          <defs>
            <linearGradient id="nav-logo" x1="0" y1="0" x2="40" y2="40">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <span className={styles.brandName}>Rhea</span>
        {user.role && (
          <span className={styles.roleBadge}>{user.role}</span>
        )}
      </div>

      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || "User avatar"}
              className={styles.avatar}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={styles.avatarFallback}>
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.userDetails}>
            <span className={styles.userName}>{user.name || "User"}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>

        <button
          className={styles.signOutButton}
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
