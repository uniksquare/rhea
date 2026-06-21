"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  Eye,
  Code,
  Share2,
  Lock,
  GitPullRequest,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
// Mascot illustrations imported as static assets

// Custom Starburst/Sparkle Icon for Logo
function StarburstIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" fill="currentColor" />
    </svg>
  );
}

// Custom logo.dev API Key
const LOGO_DEV_PUBLIC_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || 'pk_DVzJORPoQumYH3A-U6iG2g';

// Integration Connection domains for logo.dev lookup
const CONNECTION_DOMAINS: Record<string, string> = {
  // Planner
  "Jira": "jira.com",
  "Slack": "slack.com",
  "MS Teams": "microsoft.com",
  "PagerDuty": "pagerduty.com",
  "Notion": "notion.so",

  // Investigator
  "CloudWatch": "aws.amazon.com",
  "Datadog": "datadoghq.com",
  "Sentry": "sentry.io",
  "Splunk": "splunk.com",
  "Axiom": "axiom.co",

  // Sandbox
  "AWS EKS": "aws.amazon.com",
  "GCP GKE": "google.com",
  "Helm": "helm.sh",
  "Prometheus": "prometheus.io",
  "Rancher": "rancher.com",

  // Remediation
  "Terraform": "terraform.io",
  "Ansible": "ansible.com",
  "AWS EC2": "aws.amazon.com",
  "GitHub Actions": "github.com",
  "Docker": "docker.com",

  // Approver
  "Okta": "okta.com",
  "AWS IAM": "aws.amazon.com",
  "Google Cloud": "cloud.google.com",
};

// Partner Logo Component using logo.dev along with its wordmark (true colors, uniform size)
function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  return (
    <div className="flex items-center gap-8 relative transition-opacity duration-250 hover:opacity-100 opacity-95 select-none">
      <div className="relative size-24 flex items-center justify-center shrink-0">
        <Image
          src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=96`}
          alt={`${name} icon`}
          width={24}
          height={24}
          className="object-contain"
          unoptimized
        />
      </div>
      <span className="font-sans font-bold text-[16px] tracking-tight text-graphite-ink select-none leading-none shrink-0">
        {name}
      </span>
    </div>
  );
}

// Helper Component for the Redesigned Integrations Grid
function IntegrationGridCell({
  name,
  domain,
  isEmpty = false,
  isSpecial = false,
  specialText = ""
}: {
  name?: string;
  domain?: string;
  isEmpty?: boolean;
  isSpecial?: boolean;
  specialText?: string;
}) {
  if (isEmpty) {
    return <div className="hidden lg:block diagonal-stripes-bg h-[96px] w-full border-r border-b border-mist" />;
  }

  if (isSpecial) {
    return (
      <div className="flex items-center justify-center p-16 bg-paper-white h-[96px] w-full border-r border-b border-mist">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fog font-semibold">
          {specialText}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-8 p-16 bg-paper-white h-[96px] w-full border-r border-b border-mist transition-colors hover:bg-soft-snow/40 duration-200 select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=96`}
        alt={`${name} logo`}
        style={{ width: 32, height: 32 }}
        className="object-contain shrink-0"
      />
      <span className="font-sans font-bold text-[15px] tracking-tight text-graphite-ink leading-none">
        {name}
      </span>
    </div>
  );
}

export function LandingClient() {
  const [activeTab, setActiveTab] = useState<"planner" | "investigator" | "sandbox" | "remediation" | "approver">("planner");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // States & Refs for the Interactive 'How it works' Section
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [displayStep, setDisplayStep] = useState<1 | 2 | 3>(1);
  const [isStepFading, setIsStepFading] = useState(false);
  const [isVolumeMuted, setIsVolumeMuted] = useState(true); // Default to muted to comply with general browser autoplay policies
  const [stepProgress, setStepProgress] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const stepVideoRef = useRef<HTMLVideoElement>(null);

  // Transition the step video source with a fade-out / fade-in effect
  useEffect(() => {
    setIsStepFading(true);
    const timer = setTimeout(() => {
      setDisplayStep(activeStep);
      setIsStepFading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeStep]);

  // Load and play step video when displayStep changes
  useEffect(() => {
    const video = stepVideoRef.current;
    if (!video) return;

    if (displayStep !== 3) {
      video.load();
      video.muted = isVolumeMuted;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Autoplay with audio prevented. Retrying muted...", err);
          video.muted = true;
          video.play().catch(e => console.error("Muted playback failed too:", e));
        });
      }
    }
  }, [displayStep, isVolumeMuted]);

  // Track active video time updates for progress bar sync
  useEffect(() => {
    const video = stepVideoRef.current;
    if (!video || displayStep === 3) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setStepProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [displayStep]);

  // Step 3 (blank/background-only) progress counter and auto-advance loop timer
  useEffect(() => {
    if (activeStep === 3) {
      setStepProgress(0);
      const intervalTime = 100;
      const totalTime = 6000;
      const increment = (intervalTime / totalTime) * 100;

      const progressTimer = setInterval(() => {
        setStepProgress((prev) => {
          const next = prev + increment;
          return next >= 100 ? 100 : next;
        });
      }, intervalTime);

      let loopTimer: NodeJS.Timeout | undefined;
      if (autoPlayEnabled) {
        loopTimer = setTimeout(() => {
          setAutoPlayEnabled(false);
        }, totalTime);
      }

      return () => {
        clearInterval(progressTimer);
        if (loopTimer) clearTimeout(loopTimer);
      };
    } else {
      setStepProgress(0);
    }
  }, [activeStep, autoPlayEnabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly set muted property (crucial for React autoplay/Chrome policy bypass)
    video.muted = true;
    video.defaultMuted = true;

    // Check if video has already loaded enough data (for caching)
    if (video.readyState >= 2) {
      setIsVideoLoaded(true);
      video.play().catch(err => console.warn("Auto-play failed:", err));
    }

    const handleCanPlay = () => {
      setIsVideoLoaded(true);
      video.play().catch(err => console.warn("Play on canplay event failed:", err));
    };

    const handleError = () => {
      console.warn("Video failed to load - showing video container fallback.");
      setIsVideoLoaded(true);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, []);

  // AI Agent Personas Data
  const personas = {
    planner: {
      name: "Planner",
      role: "Incident Director",
      active: true,
      headline: "Orchestrate incident response loops",
      description: "Planner deconstructs production incident context, analyzes anomalies, and generates a structured execution plan represented as an actionable checklist.",
      connectsWith: ["Jira", "Slack", "MS Teams", "PagerDuty", "Notion"],
      mascot: (
        <Image
          src="/planner.jpeg"
          alt="Planner avatar"
          fill
          className="object-cover"
          unoptimized
        />
      )
    },
    investigator: {
      name: "Investigator",
      role: "Log Investigator",
      active: true,
      headline: "Diagnose log anomalies automatically",
      description: "Investigator connects directly to your cloud logs and APM metrics. It monitors error rates, isolates trace anomalies, and highlights regressions without human parsing.",
      connectsWith: ["CloudWatch", "Datadog", "Sentry", "Splunk", "Axiom"],
      mascot: (
        <Image
          src="/investigator.jpeg"
          alt="Investigator avatar"
          fill
          className="object-cover"
          unoptimized
        />
      )
    },
    sandbox: {
      name: "Sandbox",
      role: "Kubernetes Auditor",
      active: true,
      headline: "Run diagnostics in secure containers",
      description: "Sandbox executes command-line diagnostic scripts inside isolated secure environments to reproduce errors, check latency, and inspect node state without risk.",
      connectsWith: ["AWS EKS", "GCP GKE", "Helm", "Prometheus", "Rancher"],
      mascot: (
        <Image
          src="/sandbox.jpeg"
          alt="Sandbox avatar"
          fill
          className="object-cover"
          unoptimized
        />
      )
    },
    remediation: {
      name: "Remediation",
      role: "Remediation Engineer",
      active: true,
      headline: "Craft and execute targeted hotfixes",
      description: "Remediation formulates specific fixes, rollback scripts, or Terraform configuration updates, and drafts GitHub pull requests to resolve incidents.",
      connectsWith: ["Terraform", "Ansible", "AWS EC2", "GitHub Actions", "Docker"],
      mascot: (
        <Image
          src="/remediation.jpeg"
          alt="Remediation avatar"
          fill
          className="object-cover"
          unoptimized
        />
      )
    },
    approver: {
      name: "Approver",
      role: "Security Approver",
      active: true,
      headline: "Enforce ironclad safety gates",
      description: "Approver acts as a zero-trust security gate. It reviews proposed mutations, analyzes execution risks, and intercepts workflows for human-in-the-loop authorization.",
      connectsWith: ["Okta", "AWS IAM", "Slack", "Google Cloud"],
      mascot: (
        <Image
          src="/approval.jpeg"
          alt="Approver avatar"
          fill
          className="object-cover"
          unoptimized
        />
      )
    }
  };

  const currentPersona = personas[activeTab];

  return (
    <div className="min-h-screen bg-paper-white text-graphite-ink flex flex-col font-sans overflow-x-hidden">

      {/* Sticky Navigation Header */}
      <header className="sticky top-0 w-full h-64 border-b border-mist bg-paper-white/80 backdrop-blur-md px-16 md:px-24 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center justify-center size-32 rounded bg-iris-violet text-paper-white shadow-sm">
            <StarburstIcon className="size-[20px]" />
          </div>
          <span className="font-lustria text-xl tracking-tight text-graphite-ink font-bold">rhea</span>
          <span className="font-mono text-[9px] uppercase bg-soft-snow border border-mist text-slate font-medium px-[6px] py-[2px] rounded tracking-wider">
            YOUR NEXT HIRE
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-12 md:gap-24 text-[12px] font-mono tracking-wider font-medium text-graphite-ink">
          <a href="#features" className="hover:text-iris-violet transition-colors">AI WORKERS</a>
          <a href="#cockpit" className="hover:text-iris-violet transition-colors">INTERACTIVE COCKPIT</a>
          <a href="#integrations" className="hover:text-iris-violet transition-colors">INTEGRATIONS</a>
          <a href="#security" className="hover:text-iris-violet transition-colors">SECURITY</a>
        </nav>

        <div className="flex items-center gap-8 md:gap-16">
          <Link href="/auth/signin">
            <button className="px-[12px] py-8 text-[12px] font-mono tracking-wider font-medium text-graphite-ink hover:text-iris-violet uppercase transition-colors">
              LOG IN
            </button>
          </Link>
          <Link href="/auth/signin">
            <button className="bg-iris-violet hover:bg-deep-iris text-paper-white font-medium text-[12px] tracking-wide px-[20px] py-[10px] rounded shadow-sm hover:scale-[1.01] active:scale-95 transition-all">
              GET EARLY ACCESS
            </button>
          </Link>
        </div>
      </header>

      {/* Main Landing Content */}
      <main className="flex-1 flex flex-col bg-paper-white overflow-hidden">

        {/* Main Wrapper Bounded by Thin Slanted Accent Columns on Desktop */}
        <div className="w-full border-b border-mist bg-paper-white">
          <div className="max-w-[1200px] mx-auto border-l border-r border-mist bg-paper-white relative">

            {/* Left Thin Accent Column (hidden on mobile, visible on desktop) */}
            <div className="hidden xl:block absolute top-0 bottom-0 w-16 border-l border-r border-mist diagonal-stripes-bg -left-16" />

            {/* Right Thin Accent Column (hidden on mobile, visible on desktop) */}
            <div className="hidden xl:block absolute top-0 bottom-0 w-16 border-l border-r border-mist diagonal-stripes-bg -right-16" />

            {/* Hero Section (solid bg-paper-white, no dotted background, responsive padding) */}
            <section className="relative w-full px-16 sm:px-24 pt-48 pb-32 md:pt-80 md:pb-64 bg-paper-white z-10 border-b border-mist">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">

                {/* Hero Left Column */}
                <div className="space-y-24 text-left max-w-xl">
                  <div className="inline-block font-mono text-[11px] uppercase tracking-wider text-slate bg-soft-snow border border-mist px-[10px] py-[4px] rounded">
                    DEVOPS COPILOT ENGINE
                  </div>
                  <h1 className="font-lustria text-3xl sm:text-4xl lg:text-[52px] font-normal leading-[1.1] tracking-[-2.6px] text-graphite-ink">
                    Resolve Production Outages in Seconds, Autonomously.
                  </h1>
                  <p className="text-slate text-[14px] sm:text-[16px] leading-[1.6] tracking-[0.32px] font-normal">
                    Rhea is an autonomous DevOps engineer that ingests alerts, runs isolated diagnostics inside secure sandbox environments, isolates root causes, and coordinates human-in-the-loop approvals to execute hotfixes instantly.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-16 pt-8">
                    <Link href="/auth/signin">
                      <button className="bg-iris-violet hover:bg-deep-iris text-paper-white font-semibold text-[13px] tracking-wide px-24 py-[12px] rounded shadow-sm flex items-center justify-center gap-8 transition-all">
                        DEPLOY RHEA NOW
                        <ArrowRight className="size-16" />
                      </button>
                    </Link>
                    <a href="#cockpit" className="flex">
                      <button className="flex-1 border border-slate hover:bg-soft-snow text-graphite-ink font-medium text-[13px] tracking-wide px-24 py-[12px] rounded transition-colors">
                        WATCH LIVE DEMO
                      </button>
                    </a>
                  </div>
                </div>

                {/* Hero Right Column: Video Container in macOS window style */}
                <div className="relative z-20">
                  <div className="relative border border-mist rounded bg-paper-white p-16 sm:p-24 md:p-8 shadow-sm">
                    {/* Window header */}
                    <div className="flex items-center justify-between border-b border-mist pb-8 mb-16">
                      <div className="flex items-center gap-[6px]">
                        <span className="size-8 rounded-full bg-[#ff5f56]" />
                        <span className="size-8 rounded-full bg-[#ffbd2e]" />
                        <span className="size-8 rounded-full bg-[#27c93f]" />
                      </div>
                      <span className="font-mono text-[11px] text-fog">rhea-workers.mp4</span>
                      <span className="size-8" />
                    </div>

                    {/* Video Player Wrapper with gradient fade mask */}
                    <div className="relative overflow-hidden rounded [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]">
                      <video
                        ref={videoRef}
                        src="/hero.mp4"
                        loop
                        playsInline
                        className={`w-full rounded bg-soft-snow transition-opacity duration-1000 ${isVideoLoaded ? "opacity-100" : "opacity-0"
                          }`}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Section Separator */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* Trust Logo Strip Bounded by Left/Right Borders */}
            <section className="bg-paper-white py-24 md:py-40 text-center space-y-16 md:space-y-24 border-b border-mist">
              <span className="font-mono text-[11px] uppercase tracking-[0.22px] text-fog block">
                TRUSTED BY ENTERPRISE DEVOPS TEAMS
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full gap-32 md:gap-48 px-16 md:px-24 justify-items-center items-center">
                <CompanyLogo domain="aws.amazon.com" name="AWS" />
                <CompanyLogo domain="notion.so" name="Notion" />
                <CompanyLogo domain="slack.com" name="Slack" />
                <CompanyLogo domain="github.com" name="GitHub" />
                <CompanyLogo domain="datadoghq.com" name="Datadog" />
                <CompanyLogo domain="pagerduty.com" name="PagerDuty" />
              </div>
            </section>

            {/* Section Separator */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* Persona Tabs Section */}
            <section id="features" className="w-full pt-40 md:pt-80 pb-24 md:pb-32 scroll-mt-40 border-b border-mist">
              <div className="text-center space-y-4 max-w-2xl mx-auto px-16 sm:px-24 mb-32 md:mb-48">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                  YOUR NEXT HIRE
                </span>
                <h2 className="font-lustria text-3xl sm:text-4xl text-graphite-ink leading-tight tracking-[-1.5px] font-normal">
                  Meet the AI Workers
                </h2>
                <p className="text-slate text-[15px] leading-relaxed">
                  Always-on AI workers, purpose-built for complex DevOps tasks so your team can eliminate manual work and focus on winning.
                </p>
              </div>

              {/* Tab Navigation Row */}
              <div className="border-t border-b border-mist bg-paper-white relative">
                <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-mist bg-paper-white w-full">
                  {(Object.keys(personas) as Array<keyof typeof personas>).map((key) => {
                    const persona = personas[key];
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex flex-col items-center justify-center text-center p-16 min-h-[96px] relative transition-colors ${isActive ? "bg-soft-snow" : "bg-paper-white hover:bg-soft-snow/40"
                          }`}
                      >
                        {/* Active tab marker */}
                        {isActive && (
                          <div className="absolute top-0 inset-x-0 h-[3px] bg-iris-violet" />
                        )}

                        {/* COMING SOON badge at the top, overlapping the border */}
                        {!persona.active && (
                          <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-cobalt-info bg-[#e6f0ff] border border-powder-blue px-8 py-[2px] rounded-full whitespace-nowrap leading-none select-none">
                            COMING SOON
                          </span>
                        )}

                        <span className={`font-sans text-[15px] font-bold transition-colors ${isActive ? "text-graphite-ink" : persona.active ? "text-slate" : "text-fog"}`}>
                          {persona.name}
                        </span>
                        <span className={`font-sans text-[11px] mt-6 leading-none transition-colors ${isActive ? "text-slate" : "text-fog"}`}>
                          {persona.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Tab Showcase Block */}
              <div className="px-16 sm:px-24 py-32 md:py-48">
                <div className="border border-mist rounded bg-paper-white p-16 sm:p-32 md:p-48 relative">

                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Feature text */}
                    <div className="space-y-16 text-left max-w-xl">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-slate block">
                        {currentPersona.name}
                      </span>
                      <h3 className="font-lustria text-3xl sm:text-4xl lg:text-[40px] text-graphite-ink leading-tight font-normal tracking-[-1.5px]">
                        {currentPersona.headline}
                      </h3>
                      <p className="text-slate text-[15px] leading-relaxed">
                        {currentPersona.description}
                      </p>

                      <div className="pt-8">
                        <Link href="/auth/signin">
                          <button className="bg-iris-violet hover:bg-deep-iris text-paper-white font-medium text-[13px] tracking-wide px-24 py-[12px] rounded shadow-sm hover:scale-[1.01] active:scale-95 transition-all">
                            GET EARLY ACCESS
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Feature illustration: Avatar + Overlapping Integration Circles */}
                    <div className="relative w-full h-[320px] flex flex-col justify-end items-center mt-24 lg:mt-0">
                      {/* Integration Circles Arched Row */}
                      <div className="absolute top-[32px] left-1/2 -translate-x-1/2 flex items-center justify-center -space-x-[16px] sm:-space-x-[24px] select-none z-20">
                        {/* CONNECTS WITH badge on top */}
                        <span className="absolute -top-[24px] left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-slate bg-soft-snow border border-mist px-[10px] py-[3px] rounded-full whitespace-nowrap leading-none select-none">
                          CONNECTS WITH
                        </span>

                        {currentPersona.connectsWith.map((conn) => {
                          const domain = CONNECTION_DOMAINS[conn] || "logo.dev";
                          return (
                            <div
                              key={conn}
                              title={conn}
                              className="relative size-48 sm:size-64 shrink-0 rounded-full border border-dashed border-slate/30 bg-paper-white flex items-center justify-center p-8 sm:p-16 shadow-sm transition-transform hover:-translate-y-4 duration-300"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&size=64`}
                                alt={conn}
                                style={{ width: 64, height: 64 }}
                                className="object-contain"
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Avatar / Mascot */}
                      <div className="relative size-[180px] sm:size-[200px] z-10 shrink-0 select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]">
                        {currentPersona.mascot}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section Separator */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* How It Works Section */}
            <section id="how-it-works" className="w-full pt-24 md:pt-32 pb-0 scroll-mt-40 border-b border-mist bg-paper-white z-10">
              <div className="text-center space-y-4 max-w-2xl mx-auto px-16 sm:px-24 mb-16 md:mb-24">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                  NO LEARNING CURVE
                </span>
                <h2 className="font-lustria text-3xl sm:text-4xl text-graphite-ink leading-tight tracking-[-1.5px] font-normal">
                  How it works
                </h2>
                <p className="text-slate text-[15px] leading-relaxed">
                  Rhea AI Workers connect to your existing tools and start executing DevOps work autonomously — from day one.
                </p>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-mist divide-y lg:divide-y-0 lg:divide-x divide-mist w-full">

                {/* Left Column: Interactive Steps List */}
                <div className="flex flex-col justify-center divide-y divide-mist w-full bg-paper-white">

                  {/* Step 1 */}
                  <button
                    onClick={() => {
                      setAutoPlayEnabled(false);
                      setActiveStep(1);
                    }}
                    className={`flex flex-col text-left p-24 sm:p-32 relative transition-all duration-300 w-full overflow-hidden outline-none ${activeStep === 1
                      ? "bg-soft-snow/40"
                      : "opacity-60 hover:opacity-100 hover:bg-soft-snow/10"
                      }`}
                  >
                    {/* Vertical Left Progress Bar */}
                    {activeStep === 1 ? (
                      <>
                        <div className="absolute left-0 inset-y-0 w-[4px] bg-mist" />
                        <div
                          className="absolute left-0 top-0 w-[4px] bg-iris-violet transition-all duration-100 ease-linear"
                          style={{ height: `${stepProgress}%` }}
                        />
                      </>
                    ) : (
                      <div className="absolute left-0 inset-y-0 w-[4px] bg-transparent" />
                    )}
                    <span className={`font-mono text-[11px] uppercase tracking-wider mb-8 transition-colors ${activeStep === 1 ? "text-iris-violet font-semibold" : "text-slate"}`}>STEP 1</span>
                    <h3 className={`font-lustria text-xl sm:text-2xl transition-colors ${activeStep === 1 ? "text-graphite-ink font-bold" : "text-fog font-normal"}`}>Ask Rhea</h3>

                    <div className={`grid transition-all duration-300 ease-in-out ${activeStep === 1
                      ? "grid-rows-[1fr] opacity-100 mt-12"
                      : "grid-rows-[0fr] opacity-0 overflow-hidden"
                      }`}>
                      <div className="overflow-hidden">
                        <p className="text-slate text-[14px] leading-relaxed">
                          Tell Rhea what needs to be solved or diagnosed in natural language or forward alert details directly.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Step 2 */}
                  <button
                    onClick={() => {
                      setAutoPlayEnabled(false);
                      setActiveStep(2);
                    }}
                    className={`flex flex-col text-left p-24 sm:p-32 relative transition-all duration-300 w-full overflow-hidden outline-none ${activeStep === 2
                      ? "bg-soft-snow/40"
                      : "opacity-60 hover:opacity-100 hover:bg-soft-snow/10"
                      }`}
                  >
                    {/* Vertical Left Progress Bar */}
                    {activeStep === 2 ? (
                      <>
                        <div className="absolute left-0 inset-y-0 w-[4px] bg-mist" />
                        <div
                          className="absolute left-0 top-0 w-[4px] bg-iris-violet transition-all duration-100 ease-linear"
                          style={{ height: `${stepProgress}%` }}
                        />
                      </>
                    ) : (
                      <div className="absolute left-0 inset-y-0 w-[4px] bg-transparent" />
                    )}
                    <span className={`font-mono text-[11px] uppercase tracking-wider mb-8 transition-colors ${activeStep === 2 ? "text-iris-violet font-semibold" : "text-slate"}`}>STEP 2</span>
                    <h3 className={`font-lustria text-xl sm:text-2xl transition-colors ${activeStep === 2 ? "text-graphite-ink font-bold" : "text-fog font-normal"}`}>Connect tools</h3>

                    <div className={`grid transition-all duration-300 ease-in-out ${activeStep === 2
                      ? "grid-rows-[1fr] opacity-100 mt-12"
                      : "grid-rows-[0fr] opacity-0 overflow-hidden"
                      }`}>
                      <div className="overflow-hidden">
                        <p className="text-slate text-[14px] leading-relaxed">
                          Rhea plugs securely into your cloud infrastructure, databases, and monitoring systems.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Step 3 */}
                  <button
                    onClick={() => {
                      setAutoPlayEnabled(false);
                      setActiveStep(3);
                    }}
                    className={`flex flex-col text-left p-24 sm:p-32 relative transition-all duration-300 w-full overflow-hidden outline-none ${activeStep === 3
                      ? "bg-soft-snow/40"
                      : "opacity-60 hover:opacity-100 hover:bg-soft-snow/10"
                      }`}
                  >
                    {/* Vertical Left Progress Bar */}
                    {activeStep === 3 ? (
                      <>
                        <div className="absolute left-0 inset-y-0 w-[4px] bg-mist" />
                        <div
                          className="absolute left-0 top-0 w-[4px] bg-iris-violet transition-all duration-100 ease-linear"
                          style={{ height: `${stepProgress}%` }}
                        />
                      </>
                    ) : (
                      <div className="absolute left-0 inset-y-0 w-[4px] bg-transparent" />
                    )}
                    <span className={`font-mono text-[11px] uppercase tracking-wider mb-8 transition-colors ${activeStep === 3 ? "text-iris-violet font-semibold" : "text-slate"}`}>STEP 3</span>
                    <h3 className={`font-lustria text-xl sm:text-2xl transition-colors ${activeStep === 3 ? "text-graphite-ink font-bold" : "text-fog font-normal"}`}>Sit back and relax</h3>

                    <div className={`grid transition-all duration-300 ease-in-out ${activeStep === 3
                      ? "grid-rows-[1fr] opacity-100 mt-12"
                      : "grid-rows-[0fr] opacity-0 overflow-hidden"
                      }`}>
                      <div className="overflow-hidden">
                        <p className="text-slate text-[14px] leading-relaxed">
                          Rhea analyzes telemetry, drafts config hotfixes, and loops in your team for approvals.
                        </p>
                      </div>
                    </div>
                  </button>

                </div>

                {/* Right Column: Dynamic Media Container */}
                <div className="relative flex items-stretch bg-soft-snow min-h-[360px] lg:min-h-none overflow-hidden p-24 sm:p-32">
                  <div className={`w-full h-full min-h-[300px] sm:min-h-[350px] border border-mist rounded bg-paper-white relative overflow-hidden transition-all duration-300 shadow-sm flex items-center justify-center ${isStepFading ? "opacity-0 scale-98" : "opacity-100 scale-100"
                    }`}>

                    {displayStep === 3 ? (
                      /* Step 3: Blank background with color and glowing branding */
                      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-iris-violet text-paper-white p-32 select-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]" />
                        <StarburstIcon className="size-48 text-paper-white animate-pulse" />
                        <h4 className="font-lustria text-xl sm:text-2xl mt-16 text-center tracking-tight">Autonomous Remediation Active</h4>
                        <p className="font-mono text-[9px] text-powder-blue mt-6 tracking-wider uppercase bg-deep-iris/30 border border-powder-blue/20 px-8 py-[2px] rounded-full">SIT BACK AND RELAX</p>
                      </div>
                    ) : (
                      /* Step 1 & 2: Video players */
                      <div className="w-full h-full relative flex items-center justify-center bg-soft-snow overflow-hidden">
                        <video
                          ref={stepVideoRef}
                          src={displayStep === 1 ? "/step1.mp4" : "/step2.mp4"}
                          className="w-full h-full object-cover rounded bg-soft-snow [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]"
                          playsInline
                          muted
                          loop={!autoPlayEnabled}
                          onEnded={() => {
                            if (autoPlayEnabled) {
                              if (activeStep < 3) {
                                setActiveStep((prev) => (prev + 1) as 1 | 2 | 3);
                              }
                            }
                          }}
                        />
                      </div>
                    )}

                  </div>
                </div>

              </div>
            </section>

            {/* Integrations Section */}
            <section id="integrations" className="w-full scroll-mt-40 bg-paper-white border-b border-mist z-10">

              {/* Slanted Line Separator on Top */}
              <div className="w-full h-16 border-b border-mist diagonal-stripes-bg" />

              {/* Desktop Constellation Grid view (6 columns) */}
              <div className="hidden lg:grid grid-cols-6 w-full bg-paper-white overflow-hidden">

                {/* Row 1 */}
                <IntegrationGridCell name="Jira" domain="jira.com" />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="Notion" domain="notion.so" />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="Datadog" domain="datadoghq.com" />

                {/* Row 2 */}
                <IntegrationGridCell name="Sentry" domain="sentry.io" />
                <IntegrationGridCell name="Splunk" domain="splunk.com" />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="Prometheus" domain="prometheus.io" />
                <IntegrationGridCell name="Helm" domain="helm.sh" />
                <IntegrationGridCell isEmpty />

                {/* Row 3 */}
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="AWS" domain="aws.amazon.com" />

                {/* Center "Connect Anything" Card (spans Col 3 & 4 of Row 3 and 4) */}
                <div className="col-span-2 row-span-2 flex flex-col items-center justify-center p-24 text-center bg-paper-white h-[192px] w-full z-20 relative border-r border-b border-mist">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate mb-8 block select-none">INTEGRATIONS</span>
                  <h3 className="font-lustria text-3xl text-graphite-ink mb-16 leading-tight select-none">Connect Anything</h3>
                  <button className="border border-slate hover:bg-soft-snow text-graphite-ink font-semibold font-mono text-[9px] tracking-wider px-12 py-6 rounded uppercase transition-colors">
                    EXPLORE INTEGRATIONS
                  </button>
                </div>

                <IntegrationGridCell name="Rancher" domain="rancher.com" />
                <IntegrationGridCell name="Slack" domain="slack.com" />

                {/* Row 4 */}
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell isEmpty />
                {/* Center Card spans Col 3 and Col 4 here */}
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="PagerDuty" domain="pagerduty.com" />

                {/* Row 5 */}
                <IntegrationGridCell name="Okta" domain="okta.com" />
                <IntegrationGridCell name="Google Cloud" domain="cloud.google.com" />
                <IntegrationGridCell name="Terraform" domain="terraform.io" />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="Ansible" domain="ansible.com" />
                <IntegrationGridCell isEmpty />

                {/* Row 6 */}
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell name="Docker" domain="docker.com" />
                <IntegrationGridCell name="GitHub" domain="github.com" />
                <IntegrationGridCell isEmpty />
                <IntegrationGridCell isSpecial specialText="AND 20+ MORE" />

              </div>

              {/* Mobile fallback Grid view */}
              <div className="block lg:hidden w-full bg-paper-white">

                {/* Header block for mobile */}
                <div className="p-24 sm:p-32 text-center bg-paper-white border-b border-mist flex flex-col items-center">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate mb-8 block">INTEGRATIONS</span>
                  <h3 className="font-lustria text-2xl sm:text-3xl text-graphite-ink mb-12">Connect Anything</h3>
                  <p className="text-slate text-[13px] max-w-sm mx-auto mb-16 leading-relaxed">
                    Rhea plugs securely into your cloud infrastructure, databases, notifications, observablity, and compliance systems.
                  </p>
                  <button className="border border-slate hover:bg-soft-snow text-graphite-ink font-semibold font-mono text-[9px] tracking-wider px-12 py-6 rounded uppercase transition-colors">
                    EXPLORE INTEGRATIONS
                  </button>
                </div>

                {/* Responsive grid cells */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 bg-paper-white">
                  <IntegrationGridCell name="Jira" domain="jira.com" />
                  <IntegrationGridCell name="Notion" domain="notion.so" />
                  <IntegrationGridCell name="Datadog" domain="datadoghq.com" />
                  <IntegrationGridCell name="Sentry" domain="sentry.io" />
                  <IntegrationGridCell name="Splunk" domain="splunk.com" />
                  <IntegrationGridCell name="Prometheus" domain="prometheus.io" />
                  <IntegrationGridCell name="Helm" domain="helm.sh" />
                  <IntegrationGridCell name="AWS" domain="aws.amazon.com" />
                  <IntegrationGridCell name="Rancher" domain="rancher.com" />
                  <IntegrationGridCell name="Slack" domain="slack.com" />
                  <IntegrationGridCell name="PagerDuty" domain="pagerduty.com" />
                  <IntegrationGridCell name="Okta" domain="okta.com" />
                  <IntegrationGridCell name="Google Cloud" domain="cloud.google.com" />
                  <IntegrationGridCell name="Terraform" domain="terraform.io" />
                  <IntegrationGridCell name="Ansible" domain="ansible.com" />
                  <IntegrationGridCell name="Docker" domain="docker.com" />
                  <IntegrationGridCell name="GitHub" domain="github.com" />
                  <IntegrationGridCell isSpecial specialText="AND 20+ MORE" />
                </div>

              </div>

            </section>

            {/* Slanted Line Separator after Integrations Section */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* Security & Trust Card Section */}
            <section id="security" className="bg-paper-white py-40 md:py-80 w-full border-b border-mist scroll-mt-40">
              <div className="px-16 md:px-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                  {/* Security Left */}
                  <div className="space-y-6 text-left max-w-lg">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                      SECURITY
                    </span>
                    <h2 className="font-lustria text-3xl sm:text-4xl text-graphite-ink tracking-tight leading-tight">
                      No training on your data. Strict tenant boundaries.
                    </h2>
                    <p className="text-slate text-[16px] leading-[1.6]">
                      Rhea operates with zero persistent data leakage. We do not use user telemetry or source code to train base models. Relational memories are locked to your tenant key.
                    </p>
                    <button className="border border-slate hover:bg-soft-snow text-graphite-ink font-semibold text-[13px] tracking-wide px-5 py-2.5 rounded transition-colors">
                      VISIT TRUST CENTER
                    </button>
                  </div>

                  {/* Security Right: Compliance seals */}
                  <div className="flex flex-col justify-center items-center space-y-16 md:space-y-24 w-full">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-fog block text-center">
                      VERIFIED ENTERPRISE COMPLIANCE
                    </span>

                    <div className="w-full flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://cdn.prod.website-files.com/699341b056e69edfd116210e/699769923b2e71e6a3024322_Frame%201272629275-p-800.png"
                        alt="Verified Enterprise Compliance Badges"
                        className="w-full max-w-[480px] sm:max-w-[560px] md:max-w-[640px] object-contain select-none"
                      />
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Section Separator */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* CTA Banner Section */}
            <section className="bg-paper-white py-32 md:py-64 w-full px-16 md:px-24 border-b border-mist">
              <div className="bg-paper-white border border-mist rounded relative overflow-hidden px-24 py-48 md:py-64 text-center flex flex-col items-center justify-center min-h-[320px]">

                {/* Background Image (cta.jpeg) with fade effect & cache-bypassing version parameter */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cta.jpeg?v=2"
                  alt="CTA Background illustration"
                  className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none opacity-70 z-0"
                />

                {/* White radial gradient overlay to keep text highly legible and fade the image edges */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92)_20%,rgba(255,255,255,0.4)_100%)] z-10 pointer-events-none" />

                {/* Content Block */}
                <div className="relative z-20 max-w-2xl px-16 space-y-16 flex flex-col items-center">
                  <h3 className="font-lustria text-3xl sm:text-4xl lg:text-[44px] text-graphite-ink tracking-tight leading-tight select-none">
                    Resolve Incidents Autonomously
                  </h3>
                  <p className="text-slate text-[14px] sm:text-[16px] leading-relaxed max-w-lg select-none">
                    Every hour your team spends troubleshooting outages, running manual diagnostics, or drafting hotfixes is wasted. Rhea automates DevOps operations autonomously.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-16 pt-8 w-full sm:w-auto">
                    <Link href="/auth/signin" className="w-full sm:w-auto">
                      <button className="w-full bg-iris-violet hover:bg-deep-iris text-paper-white font-medium text-[13px] tracking-wide px-24 py-[12px] rounded shadow-sm hover:scale-[1.01] active:scale-95 transition-all uppercase">
                        GET EARLY ACCESS
                      </button>
                    </Link>
                    <a href="#features" className="w-full sm:w-auto">
                      <button className="w-full border border-slate hover:bg-soft-snow text-graphite-ink font-medium text-[13px] tracking-wide px-24 py-[12px] rounded hover:scale-[1.01] active:scale-95 transition-all uppercase">
                        EXPLORE AI WORKERS
                      </button>
                    </a>
                  </div>
                </div>

              </div>
            </section>

            {/* Section Separator */}
            <div className="w-full h-16 border-b border-mist diagonal-stripes-bg z-10" />

            {/* Redesigned Footer Section inside the main container */}
            <footer className="w-full bg-paper-white px-16 sm:px-32 py-48 md:py-64 z-10 relative overflow-hidden">

              {/* Background Image (footer.jpeg) with fade from upward & cache bypass */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/footer.jpeg?v=1"
                alt="Footer background illustration"
                className="absolute inset-0 w-full h-full object-cover object-bottom select-none pointer-events-none opacity-30 z-0"
              />

              {/* White fade from upward gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-paper-white via-paper-white/85 to-transparent z-10 pointer-events-none" />

              <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-32 md:gap-48 items-start">

                {/* Column 1: Brand Info (spans 2 columns on large viewports) */}
                <div className="lg:col-span-2 space-y-16 text-left">
                  <div className="flex items-center gap-8 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center size-24 rounded bg-iris-violet text-paper-white shadow-sm">
                        <StarburstIcon className="size-3.5" />
                      </div>
                      <span className="font-lustria text-[18px] tracking-tight text-graphite-ink font-bold">rhea</span>
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
                  <p className="text-slate text-[14px] leading-relaxed max-w-sm">
                    The autonomous DevOps engineer that troubleshoots outages, runs isolated sandbox diagnostics, and remediates production incidents safely.
                  </p>
                  <div className="font-sans text-[12px] text-fog pt-8">
                    <p>© 2026 SuperXEpic, Inc. All rights reserved.</p>
                    <p className="mt-2">Built on the Eve Framework.</p>
                  </div>
                </div>

                {/* Column 2: Platform Agents */}
                <div className="space-y-12 text-left">
                  <h5 className="font-mono text-[10px] uppercase tracking-wider text-graphite-ink font-semibold">AI WORKERS</h5>
                  <ul className="space-y-8 text-[13px] font-sans text-slate">
                    <li><a href="#features" className="hover:text-iris-violet transition-colors">Planner</a></li>
                    <li><a href="#features" className="hover:text-iris-violet transition-colors">Investigator</a></li>
                    <li><a href="#features" className="hover:text-iris-violet transition-colors">Sandbox Auditor</a></li>
                    <li><a href="#features" className="hover:text-iris-violet transition-colors">Remediation</a></li>
                    <li><a href="#features" className="hover:text-iris-violet transition-colors">Security Approver</a></li>
                  </ul>
                </div>

                {/* Column 3: Trust & Platform */}
                <div className="space-y-12 text-left">
                  <h5 className="font-mono text-[10px] uppercase tracking-wider text-graphite-ink font-semibold">RESOURCES</h5>
                  <ul className="space-y-8 text-[13px] font-sans text-slate">
                    <li><a href="#integrations" className="hover:text-iris-violet transition-colors">Integrations</a></li>
                    <li><a href="#security" className="hover:text-iris-violet transition-colors">Trust Center</a></li>
                    <li><a href="https://github.com" className="hover:text-iris-violet transition-colors">Eve Framework Docs</a></li>
                    <li><a href="#security" className="hover:text-iris-violet transition-colors">Security Audit</a></li>
                  </ul>
                </div>

                {/* Column 4: Company */}
                <div className="space-y-12 text-left">
                  <h5 className="font-mono text-[10px] uppercase tracking-wider text-graphite-ink font-semibold">COMPANY</h5>
                  <ul className="space-y-8 text-[13px] font-sans text-slate">
                    <li><a href="/about" className="hover:text-iris-violet transition-colors">About Us</a></li>
                    <li><a href="/careers" className="hover:text-iris-violet transition-colors">Careers</a></li>
                    <li><a href="/blog" className="hover:text-iris-violet transition-colors">Outage Blog</a></li>
                    <li><a href="/contact" className="hover:text-iris-violet transition-colors">Contact</a></li>
                  </ul>
                </div>

              </div>
            </footer>

          </div>
        </div>
      </main>

    </div>
  );
}
