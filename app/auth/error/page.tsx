"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "Access denied. You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An unexpected authentication error occurred.",
  OAuthSignin: "Could not start the sign-in process. Please try again.",
  OAuthCallback: "The sign-in callback failed. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try a different provider.",
  Callback: "The authentication callback encountered an error.",
  OAuthAccountNotLinked: "This email is already linked to another account. Sign in with the original provider.",
  SessionRequired: "Please sign in to access this page.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#f0f0f5",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: "0 1rem",
          padding: "2.5rem 2rem",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.25rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 1.25rem",
            borderRadius: 14,
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px -4px rgba(239, 68, 68, 0.4)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>
          Authentication Error
        </h1>
        <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.55)", margin: "0 0 1.75rem", lineHeight: 1.5 }}>
          {message}
        </p>

        <Link
          href="/auth/signin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            fontSize: "0.9375rem",
            fontWeight: 500,
            color: "#f0f0f5",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "0.75rem",
            textDecoration: "none",
            transition: "all 0.2s ease",
          }}
        >
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
