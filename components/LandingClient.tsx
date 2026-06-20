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
  "Jira": "atlassian.com",
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
  "Terraform": "hashicorp.com",
  "Ansible": "ansible.com",
  "AWS EC2": "aws.amazon.com",
  "GitHub Actions": "github.com",
  "Docker": "docker.com",

  // Approver
  "Okta": "okta.com",
  "AWS IAM": "aws.amazon.com",
  "HashiCorp Vault": "hashicorp.com",
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

export function LandingClient() {
  const [activeTab, setActiveTab] = useState<"planner" | "investigator" | "sandbox" | "remediation" | "approver">("planner");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

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
      connectsWith: ["Okta", "AWS IAM", "Slack", "HashiCorp Vault"],
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

            {/* Trust Logo Strip Bounded by Left/Right Borders */}
            <section className="bg-paper-white py-24 md:py-40 text-center space-y-16 md:space-y-24 border-b border-mist">
              <span className="font-mono text-[11px] uppercase tracking-[0.22px] text-fog block">
                TRUSTED BY ENTERPRISE DEVOPS TEAMS
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full gap-32 md:gap-48 px-16 md:px-24 justify-items-center items-center">
                <CompanyLogo domain="vercel.com" name="Vercel" />
                <CompanyLogo domain="notion.so" name="Notion" />
                <CompanyLogo domain="slack.com" name="Slack" />
                <CompanyLogo domain="github.com" name="GitHub" />
                <CompanyLogo domain="datadoghq.com" name="Datadog" />
                <CompanyLogo domain="pagerduty.com" name="PagerDuty" />
              </div>
            </section>

            {/* Persona Tabs Section */}
            <section id="features" className="w-full py-40 md:py-80 scroll-mt-40 border-b border-mist">
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

            {/* Integrations Bento Grid Section */}
            <section id="integrations" className="bg-soft-snow py-40 md:py-80 w-full scroll-mt-40">
              <div className="px-16 md:px-24 space-y-12">

                <div className="text-center space-y-3 max-w-xl mx-auto">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate">
                    INTEGRATIONS
                  </span>
                  <h2 className="font-lustria text-3xl sm:text-4xl text-graphite-ink tracking-tight leading-tight">
                    Plugs natively into your production stack
                  </h2>
                  <p className="text-slate text-[14px]">
                    No SDKs or code modifications required. Rhea hooks into standard monitoring endpoints and cloud providers.
                  </p>
                </div>

                {/* Bento Grid */}
                <div className="relative border border-mist rounded p-16 sm:p-24 md:p-32 bg-paper-white shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">

                    {/* Cell 1 */}
                    <div className="p-6 bg-paper-white border border-mist rounded flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-fog">OBSERVABILITY</span>
                        <Eye className="size-4 text-iris-violet" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-sans font-semibold text-graphite-ink text-[16px]">Datadog & CloudWatch</h4>
                        <p className="text-slate text-[13px] leading-relaxed">
                          Retrieve APM traces, active logs, error metrics, and trigger alerts in seconds.
                        </p>
                      </div>
                    </div>

                    {/* Cell 2 */}
                    <div className="p-6 bg-paper-white border border-mist rounded flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-fog">COMPUTE</span>
                        <Terminal className="size-4 text-iris-violet" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-sans font-semibold text-graphite-ink text-[16px]">AWS EKS, GCP GKE</h4>
                        <p className="text-slate text-[13px] leading-relaxed">
                          Audit containers, inspect pod configurations, fetch node CPU and scale.
                        </p>
                      </div>
                    </div>

                    {/* Cell 3 */}
                    <div className="p-6 bg-paper-white border border-mist rounded flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-fog">INFRASTRUCTURE</span>
                        <Code className="size-4 text-iris-violet" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-sans font-semibold text-graphite-ink text-[16px]">Terraform & Git</h4>
                        <p className="text-slate text-[13px] leading-relaxed">
                          Execute configurations and auto-draft Github PR remediations safely.
                        </p>
                      </div>
                    </div>

                    {/* Cell 4 (Center - Span/Asymmetric styling) */}
                    <div className="p-8 bg-soft-snow border border-mist rounded flex flex-col justify-center items-center text-center space-y-4 lg:col-span-2 lg:row-span-1">
                      <h3 className="font-lustria text-2xl sm:text-3xl text-graphite-ink tracking-tight max-w-md">
                        Connect anything. Deploy securely in minutes.
                      </h3>
                      <p className="text-slate text-[14px] max-w-sm">
                        Configure webhooks, AWS IAM cross-account roles, or local agent proxies in minutes.
                      </p>
                      <button className="border border-slate hover:bg-paper-white text-graphite-ink font-semibold text-[12px] tracking-wide px-5 py-2.5 rounded transition-all">
                        EXPLORE ALL INTEGRATIONS
                      </button>
                    </div>

                    {/* Cell 5 */}
                    <div className="p-6 bg-paper-white border border-mist rounded flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-fog">NOTIFICATIONS</span>
                        <Share2 className="size-4 text-iris-violet" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-sans font-semibold text-graphite-ink text-[16px]">Slack & MS Teams</h4>
                        <p className="text-slate text-[13px] leading-relaxed">
                          Stream reasoning steps, query progress, and approve hotfixes inside chat.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </section>

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
                  <div className="bg-soft-snow border border-mist p-16 sm:p-24 md:p-32 rounded flex flex-col justify-center space-y-16 md:space-y-24">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-fog block text-center">
                      VERIFIED ENTERPRISE COMPLIANCE
                    </span>

                    <div className="flex flex-wrap items-center justify-center gap-6">
                      {["SOC 2 TYPE II", "GDPR COMPLIANT", "HIPAA SECURE", "CCPA COVERED"].map((seal) => (
                        <div
                          key={seal}
                          className="size-24 rounded-full border border-mist bg-paper-white flex flex-col items-center justify-center p-3 text-center space-y-1 shadow-inner"
                        >
                          <Lock className="size-4 text-iris-violet" />
                          <span className="font-mono text-[9px] font-bold tracking-tight text-graphite-ink leading-tight">
                            {seal}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Custom Workers Banner Section */}
            <section className="bg-paper-white py-32 md:py-64 w-full px-16 md:px-24">
              <div className="border border-mist rounded bg-soft-snow p-16 sm:p-24 md:p-32 flex flex-col md:flex-row items-start md:items-center justify-between gap-16 md:gap-24 relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                  <div className="size-10 rounded bg-iris-violet text-paper-white flex items-center justify-center shadow-sm">
                    <GitPullRequest className="size-5" />
                  </div>
                  <div className="text-left space-y-1">
                    <h4 className="font-sans font-semibold text-graphite-ink text-[16px]">Need a Custom DevOps Agent?</h4>
                    <p className="text-slate text-[14px]">
                      Build custom rules, private VPC tunnels, or custom tools tailored to your legacy environment.
                    </p>
                  </div>
                </div>

                <button className="bg-iris-violet hover:bg-deep-iris text-paper-white font-semibold text-[13px] tracking-wide px-5 py-3 rounded shadow-sm shrink-0 uppercase transition-colors relative z-10">
                  REQUEST CUSTOM WORKER
                </button>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-mist bg-paper-white px-16 md:px-24 py-24 md:py-40 z-10">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-6 rounded bg-iris-violet text-paper-white shadow-sm">
              <StarburstIcon className="size-3.5" />
            </div>
            <span className="font-lustria text-base tracking-tight text-graphite-ink font-bold">rhea</span>
          </div>

          <div className="font-sans text-[12px] text-fog text-center md:text-right space-y-1">
            <p>© 2026 Rhea Systems, Inc. All rights reserved.</p>
            <p>Built on the Eve Framework and Aurora DSQL</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
