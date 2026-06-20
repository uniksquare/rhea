"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import styles from "./signin.module.css";

export function SignInForm() {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/" });
    } catch {
      setIsLoading(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Animated background mesh */}
      <div className={styles.bgMesh} aria-hidden="true">
        <div className={styles.meshOrb1} />
        <div className={styles.meshOrb2} />
        <div className={styles.meshOrb3} />
      </div>

      <div className={styles.card}>
        {/* Logo & branding */}
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="40"
                  height="40"
                  rx="10"
                  fill="url(#logo-gradient)"
                />
                <path
                  d="M12 28V12h4.5c1.5 0 2.7.4 3.6 1.2.9.8 1.4 1.9 1.4 3.2 0 1-.3 1.8-.8 2.5-.5.7-1.2 1.2-2.1 1.4l3.4 7.7h-3l-3-7h-1.2v7H12zm2.8-9.5h1.5c.8 0 1.4-.2 1.9-.6.5-.4.7-1 .7-1.7s-.2-1.3-.7-1.7c-.5-.4-1.1-.6-1.9-.6h-1.5v4.6z"
                  fill="white"
                />
                <defs>
                  <linearGradient
                    id="logo-gradient"
                    x1="0"
                    y1="0"
                    x2="40"
                    y2="40"
                  >
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <h1 className={styles.title}>Welcome to Rhea</h1>
          <p className={styles.subtitle}>
            Autonomous Incident Response & DevOps Agent
          </p>
        </div>

        {/* OAuth buttons */}
        <div className={styles.providers}>
          <button
            className={styles.providerButton}
            onClick={() => handleSignIn("github")}
            disabled={isLoading !== null}
          >
            {isLoading === "github" ? (
              <span className={styles.spinner} />
            ) : (
              <svg
                className={styles.providerIcon}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            )}
            <span>Continue with GitHub</span>
          </button>

          <button
            className={styles.providerButton}
            onClick={() => handleSignIn("google")}
            disabled={isLoading !== null}
          >
            {isLoading === "google" ? (
              <span className={styles.spinner} />
            ) : (
              <svg
                className={styles.providerIcon}
                viewBox="0 0 24 24"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
