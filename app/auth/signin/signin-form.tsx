"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// StarburstIcon
function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

const LOGO_DEV_PUBLIC_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || 'pk_DVzJORPoQumYH3A-U6iG2g';

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
    <div className="min-h-screen w-full flex bg-paper-white text-graphite-ink font-sans overflow-hidden">

      {/* Left Column: Sign In Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-24 sm:p-40 relative z-10 bg-paper-white">

        {/* Back Link / Top Header */}
        <div className="flex items-center justify-between pb-16 w-full">
          <Link
            href="/"
            className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-wider text-slate hover:text-iris-violet transition-colors"
          >
            <ArrowLeft className="h-[10px] w-auto" />
            <span>Back to home</span>
          </Link>
          <span className="font-mono text-[9px] uppercase bg-soft-snow border border-mist text-slate font-medium px-[6px] py-[2px] rounded tracking-wider">
            YOUR NEXT HIRE
          </span>
        </div>

        {/* Form Body Container */}
        <div className="max-w-[360px] w-full mx-auto my-auto py-32 space-y-32">

          {/* Logo & Headline */}
          <div className="space-y-24">
            <div className="flex items-center gap-8 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-24 rounded bg-iris-violet text-paper-white shadow-sm">
                  <StarburstIcon className="size-3.5" />
                </div>
                <span className="font-lustria text-[18px] tracking-tight text-graphite-ink font-bold leading-none">rhea</span>
              </div>
              <div className="flex items-center gap-8 font-mono text-[9px] uppercase tracking-wider text-fog border-l border-mist pl-8 h-[16px]">
                <span>backed by</span>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.logo.dev/v0.dev?token=${LOGO_DEV_PUBLIC_KEY}&size=32`}
                    alt="v0 logo"
                    className="h-[12px] w-auto object-contain"
                  />
                </div>
                <span>&</span>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.logo.dev/aws.amazon.com?token=${LOGO_DEV_PUBLIC_KEY}&size=32`}
                    alt="AWS logo"
                    className="h-[14px] w-auto object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h1 className="font-lustria text-3xl font-normal leading-[1.2] tracking-tight text-graphite-ink">
                Welcome to Rhea
              </h1>
              <p className="text-slate text-[14px] leading-relaxed">
                Connect your account to access the autonomous incident response cockpit.
              </p>
            </div>
          </div>

          {/* Provider Buttons Group */}
          <div className="space-y-8 w-full">
            <button
              onClick={() => handleSignIn("github")}
              disabled={isLoading !== null}
              className="flex items-center justify-center gap-[12px] w-full px-16 py-[12px] border border-mist rounded font-mono text-[11px] uppercase tracking-wider text-graphite-ink hover:bg-soft-snow/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-paper-white"
            >
              {isLoading === "github" ? (
                <div className="size-16 border-2 border-mist border-t-iris-violet rounded-full animate-spin" />
              ) : (
                <svg
                  className="size-16 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              )}
              <span>Continue with GitHub</span>
            </button>

            <button
              onClick={() => handleSignIn("google")}
              disabled={isLoading !== null}
              className="flex items-center justify-center gap-[12px] w-full px-16 py-[12px] border border-mist rounded font-mono text-[11px] uppercase tracking-wider text-graphite-ink hover:bg-soft-snow/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-paper-white"
            >
              {isLoading === "google" ? (
                <div className="size-16 border-2 border-mist border-t-iris-violet rounded-full animate-spin" />
              ) : (
                <svg
                  className="size-16"
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

        </div>

        {/* Terms and Privacy Policy footer */}
        <div className="font-mono text-[9px] uppercase tracking-wider text-fog leading-relaxed pt-24 w-full text-center select-none">
          <span>By signing in, you agree to our </span>
          <Link href="/terms" className="hover:text-iris-violet underline transition-colors text-slate font-medium">Terms of Service</Link>
          <span className="mx-8 text-mist">•</span>
          <Link href="/privacy" className="hover:text-iris-violet underline transition-colors text-slate font-medium">Privacy Policy</Link>
        </div>

      </div>

      {/* Right Column: Visual Showcase (Slanted lines pattern with a clean showcase card) */}
      <div className="hidden lg:flex lg:w-[55%] bg-soft-snow border-l border-mist relative flex-col items-center justify-center p-48 overflow-hidden diagonal-stripes-bg">

        {/* Soft floating background shadows */}
        <div className="absolute inset-0 bg-gradient-to-tr from-iris-violet/5 via-transparent to-transparent z-0" />

        {/* Main Mockup Card Container */}
        <div className="relative w-full max-w-[540px] bg-paper-white border border-mist rounded shadow-sm z-10 overflow-hidden flex flex-col">

          {/* Upper part: Image container */}
          <div className="relative w-full aspect-[16/10] bg-soft-snow border-b border-mist overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cta.jpeg?v=2"
              alt="Showcase background illustration"
              className="w-full h-full object-cover object-center select-none pointer-events-none"
            />
          </div>

          {/* Lower part: Text container */}
          <div className="p-24 sm:p-32 space-y-16 bg-paper-white relative z-20">
            <span className="inline-block font-mono text-[9px] uppercase tracking-wider text-slate bg-soft-snow border border-mist px-[10px] py-[3px] rounded-full whitespace-nowrap leading-none select-none">
              AUTONOMOUS COPILOT
            </span>
            <h3 className="font-lustria text-xl sm:text-2xl text-graphite-ink leading-snug tracking-tight font-normal">
              Resolve Production Outages in Seconds, Autonomously.
            </h3>
            <p className="text-slate text-[13px] leading-relaxed">
              Rhea works durable, multi-step response tasks inside sandboxes. It monitors cloud error logs, identifies code regressions, and drafts targeted remediation hotfixes.
            </p>
          </div>
        </div>


      </div>

    </div>
  );
}
