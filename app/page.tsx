import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Terminal, 
  Search, 
  Brain, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  Database,
  ShieldAlert,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await auth();

  // If already logged in, redirect straight to the Agent Chat dashboard
  if (session?.user?.orgId) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-x-hidden selection:bg-purple-500/30 selection:text-white">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-purple-600/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-96 h-96 bg-emerald-600/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative w-full h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-6 rounded-md bg-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-purple-500/20">
              R
            </div>
            <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-500 rounded-full border-2 border-zinc-950 animate-pulse" />
          </div>
          <span className="font-semibold tracking-tight text-white text-lg">Rhea</span>
          <span className="text-[10px] uppercase bg-purple-950/60 border border-purple-800/40 text-purple-300 font-bold px-1.5 py-0.5 rounded tracking-widest">SaaS</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400 font-medium">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#cockpit" className="hover:text-white transition-colors">Interactive Cockpit</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/auth/signin">
            <Button variant="ghost" className="text-zinc-300 hover:text-white hover:bg-zinc-900 text-sm">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signin">
            <Button className="bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/10 text-sm hover:scale-[1.02] transition-transform">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full max-w-6xl mx-auto px-6 pt-24 pb-16 text-center space-y-8 z-10">
          {/* Animated Promo Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-950/20 text-xs font-semibold text-purple-300 shadow-inner">
            <Zap className="size-3.5 fill-purple-400 text-purple-400 animate-pulse" />
            <span>Autonomous DevOps & Incident Response</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter leading-tight max-w-4xl mx-auto bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-200 to-zinc-400">
            Resolve Production Outages <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">In Seconds</span>, Autonomously.
          </h1>

          {/* Subtitle */}
          <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Rhea is an autonomous DevOps engineer that ingests alerts, runs isolated diagnostics inside secure sandbox environments, isolates root causes, and coordinates human-in-the-loop approvals to execute hotfixes instantly.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth/signin">
              <Button size="lg" className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white text-base shadow-xl shadow-purple-500/20 px-8 hover:scale-[1.03] transition-transform flex items-center gap-2">
                Deploy Rhea Now
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#cockpit">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-zinc-800 hover:bg-zinc-900/50 hover:text-white text-zinc-300 text-base px-8">
                Watch Demo
              </Button>
            </a>
          </div>
        </section>

        {/* Mock Cockpit Display */}
        <section id="cockpit" className="w-full max-w-5xl mx-auto px-6 pb-24 z-10 scroll-mt-20">
          <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xs p-1.5 shadow-2xl shadow-purple-500/5">
            {/* Window chrome controls */}
            <div className="absolute top-4 left-5 flex items-center gap-1.5 pointer-events-none">
              <span className="size-2.5 rounded-full bg-red-500/60" />
              <span className="size-2.5 rounded-full bg-yellow-500/60" />
              <span className="size-2.5 rounded-full bg-green-500/60" />
            </div>
            {/* Window title */}
            <div className="w-full h-10 border-b border-zinc-900 bg-zinc-950/30 flex items-center justify-center rounded-t-lg">
              <span className="text-[11px] font-mono text-zinc-500 select-none">rhea-agent-cockpit // Payment Gateway API Outage</span>
            </div>

            {/* Split UI layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-900 bg-zinc-950/40 rounded-b-lg overflow-hidden">
              {/* Left Panel: Checklist */}
              <div className="col-span-7 p-6 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Timeline Checklist</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { name: "Triggered", active: true },
                      { name: "Diagnosing", active: true },
                      { name: "Root Cause", active: true },
                      { name: "Proposed", active: true },
                      { name: "Resolved", active: false }
                    ].map((step, i) => (
                      <div key={step.name} className={`p-2.5 rounded-md border text-center flex flex-col items-center gap-1 ${
                        step.active ? "bg-purple-950/15 border-purple-800/40 text-purple-200" : "bg-zinc-900/10 border-zinc-850 text-zinc-600"
                      }`}>
                        <CheckCircle2 className={`size-3.5 ${step.active ? "text-purple-400 animate-pulse" : "text-zinc-700"}`} />
                        <span className="text-[9px] font-semibold truncate w-full">{step.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analysis findings */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Findings</h3>
                  <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200">Database Connection Pool</span>
                      <span className="font-bold text-purple-400">92% Confidence</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed font-sans">
                      The application database connection pool size is capped at 10, while the incoming traffic volume requires at least 50 connections. Hotfix pattern generated.
                    </p>
                  </div>
                </div>

                {/* Code proposal */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Remediation Script</h3>
                  <div className="bg-zinc-900/50 border border-zinc-900 rounded-lg p-4 font-mono text-[10px] text-zinc-400 whitespace-pre overflow-x-auto">
                    {`import { queryDsql } from '@/lib/dsql';

export async function fixPool() {
  // Recommend: Scale pool size in config variables
  await queryDsql("ALTER SYSTEM SET max_connections = 150;");
  await queryDsql("SELECT pg_reload_conf();");
}`}
                  </div>
                </div>
              </div>

              {/* Right Panel: Scoped Chat */}
              <div className="col-span-5 flex flex-col bg-zinc-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Rhea Scoped Chat</span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-semibold text-zinc-400 font-mono">STREAMING</span>
                  </div>
                </div>

                {/* Simulated messages */}
                <div className="flex-1 space-y-4 text-xs font-sans max-h-72 overflow-y-auto">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500">USER</span>
                    <div className="bg-purple-600 text-white rounded-lg px-3 py-2 max-w-[90%]">
                      Investigate why the payment gateway is failing.
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-zinc-500">Rhea Copilot</span>
                    <div className="bg-zinc-900/60 border border-zinc-850 rounded-lg px-3 py-2 max-w-[95%] space-y-2 leading-relaxed text-zinc-300">
                      <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
                        <Brain className="size-3.5 animate-spin" />
                        <span>Invoking Investigator Subagent...</span>
                      </div>
                      <p>
                        Checking EKS logs. Found OOMKilled state on `rhea-db-proxy-6f8d39c-x291p` pod. Connection pool is exhausted.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <div className="flex items-center justify-between bg-zinc-950 border border-zinc-900 rounded-lg px-3 py-2 text-xs">
                    <span className="text-zinc-500">Type a message...</span>
                    <ArrowRight className="size-4 text-zinc-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="w-full max-w-6xl mx-auto px-6 py-16 space-y-12 scroll-mt-20 z-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Core Competencies</h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto">
              Equipped with a suite of specialist subagents, Rhea completes full incident response loops securely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Auto Diagnosis */}
            <div className="group border border-zinc-900 bg-zinc-950/40 p-6 rounded-xl hover:border-zinc-800 hover:bg-zinc-900/10 transition-all duration-300 space-y-4">
              <div className="size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-[1.05] transition-transform">
                <Search className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">Telemetric Diagnostics</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Connects directly to CloudWatch logs, APM databases, and Kubernetes cluster states to auto-diagnose crash loops, disk exhaustion, or memory spikes.
              </p>
            </div>

            {/* Secure Sandbox */}
            <div className="group border border-zinc-900 bg-zinc-950/40 p-6 rounded-xl hover:border-zinc-800 hover:bg-zinc-900/10 transition-all duration-300 space-y-4">
              <div className="size-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-[1.05] transition-transform">
                <Terminal className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">Isolated Execution</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Runs untrusted CLI diagnostics, replication scripts, and fix verifications inside ephemeral, secure sandboxes to avoid any risk to production.
              </p>
            </div>

            {/* Human in the loop */}
            <div className="group border border-zinc-900 bg-zinc-950/40 p-6 rounded-xl hover:border-zinc-800 hover:bg-zinc-900/10 transition-all duration-300 space-y-4">
              <div className="size-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-[1.05] transition-transform">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">Guardrails & Approvals</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Every write mutation or infrastructure patch proposed by Rhea goes through the Approver agent to enforce safety controls and request manual human authorization.
              </p>
            </div>
          </div>
        </section>

        {/* Architecture overview section */}
        <section id="architecture" className="w-full max-w-6xl mx-auto px-6 py-16 scroll-mt-20 z-10">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 space-y-5">
              <div className="size-8 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Server className="size-4" />
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
                Enterprise Multi-Tenant Infrastructure
              </h2>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Rhea's SaaS architecture uses industry-leading components to ensure data compliance, performance, and tenant isolation:
              </p>
              <ul className="space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Aurora DSQL relational memory database</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>DynamoDB operational execution state logger</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>NextAuth security middleware & tenant isolation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <span>Eve autonomous orchestration channel registry</span>
                </li>
              </ul>
            </div>
            <div className="md:col-span-7 grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                <Database className="size-5 text-indigo-400" />
                <h4 className="text-xs font-bold text-white">Aurora DSQL</h4>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Stateless relational storage for incidents, timelines, configurations, and organizational parameters.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                <Activity className="size-5 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">DynamoDB</h4>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Event-logging pipeline capturing every tool call, subagent task execution, and model response.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                <ShieldAlert className="size-5 text-rose-400" />
                <h4 className="text-xs font-bold text-white">NextAuth & RBAC</h4>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Strict boundaries mapping user permissions (Viewer, Operator, Admin, Owner) to tenant scopes.
                </p>
              </div>
              <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                <Sparkles className="size-5 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Eve Framework</h4>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Durable agent execution engine powering multi-agent loops and tool calls securely.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="w-full max-w-6xl mx-auto px-6 py-20 text-center space-y-6 z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Ready to secure your service?
          </h2>
          <p className="text-zinc-400 text-sm max-w-lg mx-auto">
            Get started today and configure Rhea to monitor your EKS clusters, handle diagnostics, and keep operations running smooth.
          </p>
          <div className="pt-2">
            <Link href="/auth/signin">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/10 px-8 hover:scale-[1.02] transition-transform">
                Get Started For Free
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative w-full border-t border-zinc-900 bg-zinc-950 px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-600 z-10">
        <div>
          <span>© 2026 Rhea Systems, Inc. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Built on the Eve Framework and Aurora DSQL</span>
        </div>
      </footer>
    </div>
  );
}
