"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Terminal, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Database, 
  Network, 
  Globe, 
  Lock, 
  Play, 
  ChevronRight, 
  Search, 
  Activity, 
  Clock,
  Sparkles,
  KeyRound,
  FileCode,
  Server,
  Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface SandboxSession {
  sessionId: string;
  status: string;
  allowedDomains: string[];
  configLimits: { memoryMiB: number; vcpus: number };
  createdAt: string;
  updatedAt: string;
}

interface SandboxExecution {
  executionId: string;
  sessionId: string;
  command: string;
  status: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  createdAt: string;
}

interface UserInfo {
  id?: string;
  email?: string | null;
  role?: string;
  orgId?: string;
}

interface SandboxClientProps {
  initialSession: SandboxSession | null;
  initialExecutions: SandboxExecution[];
  user: UserInfo;
}

export function SandboxClient({ initialSession, initialExecutions, user }: SandboxClientProps) {
  const router = useRouter();
  const [session, setSession] = useState<SandboxSession | null>(initialSession);
  const [executions, setExecutions] = useState<SandboxExecution[]>(initialExecutions);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Diagnostic states
  const [isTesting, setIsTesting] = useState(false);
  const [diagResults, setDiagResults] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleRunDiagnostics = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    setDiagResults(null);
    try {
      const res = await fetch("/api/sandbox/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to execute diagnostic self-test");
      }
      setDiagResults(data.testResults);
      showToast("Sandbox Diagnostic Self-Test completed successfully.");

      // Re-fetch recent executions to show the test logs
      const logsRes = await fetch("/api/sandbox/logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setExecutions(logsData);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsTesting(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const filteredExecutions = executions.filter((exec) => {
    const query = searchQuery.toLowerCase();
    return (
      exec.command.toLowerCase().includes(query) ||
      exec.status.toLowerCase().includes(query) ||
      exec.sessionId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-32 max-w-7xl mx-auto p-24 pb-40">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-24 right-24 z-50 bg-graphite-ink text-paper-white px-16 py-[12px] rounded shadow-md border border-charcoal-hairline text-xs font-sans flex items-center gap-[12px] animate-in slide-in-from-bottom duration-250 select-none">
          <Sparkles className="size-[14px] text-iris-violet shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row gap-16 justify-between items-start sm:items-center pb-24 border-b border-mist">
        <div className="space-y-[4px]">
          <div className="flex items-center gap-8">
            <Shield className="size-[20px] text-iris-violet shrink-0" />
            <h1 className="font-lustria text-3xl font-bold tracking-tight text-graphite-ink">Sandbox Isolation Cockpit</h1>
          </div>
          <p className="text-slate text-sm leading-relaxed max-w-2xl">
            Monitor, configure, and verify multi-tenant isolation policies running in Rhea's secure microVM sandboxes.
          </p>
        </div>
        <button
          onClick={handleRunDiagnostics}
          disabled={isTesting}
          className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-sans font-semibold text-xs tracking-tight px-16 py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none disabled:opacity-50"
        >
          {isTesting ? (
            <RefreshCw className="size-[14px] animate-spin shrink-0" />
          ) : (
            <Play className="size-[14px] shrink-0" />
          )}
          <span>{isTesting ? "Checking Egress..." : "Run Egress Check"}</span>
        </button>
      </div>

      {/* Diagnostics Results Callout */}
      {errorMessage && (
        <div className="flex items-start gap-[12px] rounded border border-rose-200 bg-rose-50 p-16 text-sm text-rose-700 animate-in fade-in duration-300">
          <AlertCircle className="size-[18px] text-rose-600 shrink-0 mt-[2px]" />
          <div>
            <h4 className="font-semibold">Diagnostic Failure</h4>
            <p className="mt-[4px] text-xs leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {diagResults && (
        <div className="rounded border border-mist bg-paper-white overflow-hidden shadow-sm animate-in fade-in duration-300">
          <div className="border-b border-mist px-24 py-16 bg-soft-snow flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-graphite-ink">Self-Test Diagnostic Results</span>
            <span className={`text-[10px] font-mono uppercase tracking-wider px-[8px] py-[2px] rounded border ${
              diagResults.mode === "mocked" 
                ? "text-cobalt-info bg-powder-blue/20 border-powder-blue/30" 
                : "text-emerald-700 bg-emerald-50 border-emerald-200"
            }`}>
              {diagResults.mode === "mocked" ? "SIMULATION MODE" : "LIVE ENVIRONMENT"}
            </span>
          </div>
          
          <div className="p-24 grid grid-cols-1 md:grid-cols-3 gap-16">
            {/* DNS Check */}
            <div className="p-16 rounded border border-mist bg-paper-white hover:border-slate/30 transition-all flex flex-col justify-between space-y-16">
              <div className="flex items-center gap-8">
                {diagResults.dnsBlocked.status === "passed" ? (
                  <ShieldCheck className="size-[16px] text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="size-[16px] text-rose-600 shrink-0" />
                )}
                <span className="font-mono text-xs uppercase tracking-wider text-graphite-ink font-semibold">DNS Egress Block</span>
              </div>
              <p className="text-xs text-slate leading-relaxed">{diagResults.dnsBlocked.details}</p>
              <span className="w-fit leading-none mt-[4px] text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-[6px] py-[2px] rounded">
                PASSED
              </span>
            </div>

            {/* Private IP Check */}
            <div className="p-16 rounded border border-mist bg-paper-white hover:border-slate/30 transition-all flex flex-col justify-between space-y-16">
              <div className="flex items-center gap-8">
                {diagResults.privateIpBlocked.status === "passed" ? (
                  <ShieldCheck className="size-[16px] text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="size-[16px] text-rose-600 shrink-0" />
                )}
                <span className="font-mono text-xs uppercase tracking-wider text-graphite-ink font-semibold">RFC1918 Private Block</span>
              </div>
              <p className="text-xs text-slate leading-relaxed">{diagResults.privateIpBlocked.details}</p>
              <span className="w-fit leading-none mt-[4px] text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-[6px] py-[2px] rounded">
                PASSED
              </span>
            </div>

            {/* Allowlisted Domain Check */}
            <div className="p-16 rounded border border-mist bg-paper-white hover:border-slate/30 transition-all flex flex-col justify-between space-y-16">
              <div className="flex items-center gap-8">
                {diagResults.allowlistedDomainAllowed.status === "passed" ? (
                  <ShieldCheck className="size-[16px] text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="size-[16px] text-rose-600 shrink-0" />
                )}
                <span className="font-mono text-xs uppercase tracking-wider text-graphite-ink font-semibold">Allowlisted Domain</span>
              </div>
              <p className="text-xs text-slate leading-relaxed">{diagResults.allowlistedDomainAllowed.details}</p>
              <span className="w-fit leading-none mt-[4px] text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-[6px] py-[2px] rounded">
                PASSED
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sandbox Isolation Architecture Graphic */}
      <div className="rounded border border-mist bg-paper-white p-24 space-y-16 shadow-xs">
        <div className="space-y-[4px]">
          <h2 className="font-lustria text-lg font-bold text-graphite-ink">Sandbox Security Architecture</h2>
          <p className="text-slate text-xs leading-relaxed max-w-3xl">
            Rhea runs dynamic diagnosis scripts inside isolated, ephemeral workspaces. Egress traffic passes through our firewall boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-24 pt-8">
          {/* Step 1 */}
          <div className="flex gap-[16px] items-start p-16 rounded border border-mist bg-soft-snow/40">
            <div className="size-[32px] rounded bg-iris-violet/10 text-iris-violet flex items-center justify-center font-mono text-xs font-bold shrink-0">
              1
            </div>
            <div className="space-y-[4px]">
              <h4 className="font-semibold text-graphite-ink text-sm flex items-center gap-[6px]">
                <Network className="size-[14px] text-iris-violet" /> Network Boundary
              </h4>
              <p className="text-xs text-slate leading-relaxed">
                Zero-trust firewall drops all traffic to internal RFC1918 networks and blocks general internet egress except explicit DNS allowlist domains.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-[16px] items-start p-16 rounded border border-mist bg-soft-snow/40">
            <div className="size-[32px] rounded bg-iris-violet/10 text-iris-violet flex items-center justify-center font-mono text-xs font-bold shrink-0">
              2
            </div>
            <div className="space-y-[4px]">
              <h4 className="font-semibold text-graphite-ink text-sm flex items-center gap-[6px]">
                <KeyRound className="size-[14px] text-iris-violet" /> Credential Broker
              </h4>
              <p className="text-xs text-slate leading-relaxed">
                Credentials and access keys are securely brokered at the proxy firewall layer, keeping secret tokens isolated from VM runtime context memory.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-[16px] items-start p-16 rounded border border-mist bg-soft-snow/40">
            <div className="size-[32px] rounded bg-iris-violet/10 text-iris-violet flex items-center justify-center font-mono text-xs font-bold shrink-0">
              3
            </div>
            <div className="space-y-[4px]">
              <h4 className="font-semibold text-graphite-ink text-sm flex items-center gap-[6px]">
                <Server className="size-[14px] text-iris-violet" /> MicroVM Hypervisor
              </h4>
              <p className="text-xs text-slate leading-relaxed">
                Workloads run inside isolated node VMs running under specialized hypervisors, restricting kernel access using gVisor sandbox runtimes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Resource & Network Policies Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
        
        {/* Resource specs */}
        <div className="rounded border border-mist bg-paper-white p-24 space-y-16 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="space-y-16">
            <div className="flex items-center gap-[12px]">
              <Cpu className="size-[18px] text-iris-violet shrink-0" />
              <h3 className="font-sans font-semibold text-sm uppercase tracking-wide text-graphite-ink">MicroVM Resource Specs</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-16 pt-8">
              <div className="space-y-[4px]">
                <span className="text-[10px] font-mono text-slate uppercase tracking-wider block">Compute Limit</span>
                <p className="text-xl font-bold text-graphite-ink flex items-baseline gap-[4px]">
                  {session?.configLimits?.vcpus || 4} <span className="text-xs font-normal text-slate">vCPUs</span>
                </p>
              </div>
              <div className="space-y-[4px]">
                <span className="text-[10px] font-mono text-slate uppercase tracking-wider block">Durable RAM</span>
                <p className="text-xl font-bold text-graphite-ink flex items-baseline gap-[4px]">
                  {session?.configLimits?.memoryMiB || 2048} <span className="text-xs font-normal text-slate">MB</span>
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-mist/60 pt-16 flex justify-between items-center text-xs text-slate">
            <span className="flex items-center gap-[4px]">
              <Database className="size-[14px] text-slate/50" />
              <span>VM Session: <span className="font-mono text-[11px] font-bold text-graphite-ink">{session?.sessionId?.substring(0, 15) || "DORMANT"}...</span></span>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider px-[6px] py-[2px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {session?.status || "STANDBY"}
            </span>
          </div>
        </div>

        {/* Network Policies */}
        <div className="rounded border border-mist bg-paper-white p-24 space-y-16 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="space-y-16">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <Network className="size-[18px] text-iris-violet shrink-0" />
                <h3 className="font-sans font-semibold text-sm uppercase tracking-wide text-graphite-ink">Dynamic Egress Allowlist</h3>
              </div>
              <span className="flex items-center gap-[4px] text-[9px] uppercase font-mono tracking-wider px-[6px] py-[2px] rounded bg-amber-50 text-amber-700 border border-amber-200 select-none">
                <Lock className="size-[10px] text-amber-600" /> Private IPs Blocked
              </span>
            </div>

            <div className="flex flex-wrap gap-[6px] pt-8">
              {session?.allowedDomains && session.allowedDomains.length > 0 ? (
                session.allowedDomains.map((domain) => (
                  <Badge 
                    key={domain} 
                    variant="outline" 
                    className="flex items-center gap-[4px] text-[10px] font-mono font-normal border-mist bg-soft-snow text-graphite-ink px-[8px] py-[4px]"
                  >
                    <Globe className="size-[10px] text-slate/50" />
                    <span>{domain}</span>
                    <span title="Credential Transformation Injected" className="ml-[4px] inline-flex items-center">
                      <KeyRound className="size-[10px] text-iris-violet shrink-0" />
                    </span>
                  </Badge>
                ))
              ) : (
                <div className="text-xs text-slate italic flex items-center gap-[4px]">
                  <AlertCircle className="size-[14px]" />
                  <span>No allowed domains. General internet access is blocked.</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-mist/60 pt-16 flex items-center justify-between text-xs text-slate">
            <span className="flex items-center gap-[4px] text-[10px]">
              <ShieldCheck className="size-[14px] text-emerald-600" />
              <span>Credential brokering applied at proxy firewall</span>
            </span>
          </div>
        </div>

      </div>

      {/* Command Audit Log Panel */}
      <div className="rounded border border-mist bg-paper-white shadow-xs overflow-hidden">
        
        <div className="p-24 border-b border-mist bg-soft-snow/40 flex flex-col md:flex-row md:items-center justify-between gap-[12px]">
          <h3 className="font-sans font-semibold text-sm uppercase tracking-wider text-graphite-ink flex items-center gap-8">
            <Terminal className="size-16 text-iris-violet" />
            <span>Sandbox Command Audit Logs</span>
          </h3>
          
          {/* Search filter input */}
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-[10px] top-[10px] size-[14px] text-slate/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search commands or sessions..."
              className="pl-[32px] h-[32px] text-xs font-mono border-mist focus:border-slate/40 bg-paper-white focus:outline-hidden"
            />
          </div>
        </div>

        <div className="divide-y divide-mist overflow-x-auto">
          {filteredExecutions.length > 0 ? (
            filteredExecutions.map((exec) => {
              const isExpanded = expandedId === exec.executionId;
              const dateString = new Date(exec.createdAt).toLocaleTimeString();
              
              return (
                <div key={exec.executionId} className="transition-all hover:bg-soft-snow/20">
                  
                  {/* Row Summary */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : exec.executionId)}
                    className="flex items-center justify-between px-24 py-16 cursor-pointer select-none text-xs font-mono"
                  >
                    <div className="flex items-center gap-16 min-w-0 flex-1">
                      <ChevronRight className={`size-[14px] text-slate/60 shrink-0 transition-transform ${isExpanded ? "rotate-90 text-iris-violet" : ""}`} />
                      
                      {/* Status badge */}
                      <span className={`text-[9px] font-bold tracking-wider px-[6px] py-[2px] rounded border shrink-0 ${
                        exec.status === "SUCCESS" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {exec.status}
                      </span>

                      {/* Command string (Compact inline badge with precise vertical padding) */}
                      <span className="font-mono text-graphite-ink truncate max-w-sm md:max-w-md bg-soft-snow px-[8px] py-[3px] rounded border border-mist/30">
                        {exec.command}
                      </span>
                    </div>

                    {/* Time metrics */}
                    <div className="flex items-center gap-16 text-[10px] text-slate shrink-0 pl-16">
                      <span className="flex items-center gap-[4px]">
                        <Clock className="size-[10px] text-slate/50" />
                        <span>{exec.executionTimeMs}ms</span>
                      </span>
                      <span className="text-mist">|</span>
                      <span>{dateString}</span>
                    </div>

                  </div>

                  {/* Expandable Simulated macOS Terminal */}
                  {isExpanded && (
                    <div className="p-24 bg-soft-snow/40 border-t border-mist">
                      <div className="rounded-lg border border-[#27272a] bg-[#18181b] overflow-hidden shadow-md">
                        
                        {/* macOS style terminal title bar */}
                        <div className="bg-[#242427] border-b border-[#27272a] px-16 py-8 flex items-center relative select-none">
                          {/* Dot controls */}
                          <div className="flex items-center gap-[6px]">
                            <span className="size-[10px] rounded-full bg-[#ff5f56]" />
                            <span className="size-[10px] rounded-full bg-[#ffbd2e]" />
                            <span className="size-[10px] rounded-full bg-[#27c93f]" />
                          </div>
                          
                          {/* Title */}
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[#a1a1aa] pointer-events-none">
                            session_id: {exec.sessionId}
                          </div>
                        </div>

                        {/* Terminal content */}
                        <div className="p-16 text-[11px] font-mono text-[#f4f4f5] leading-relaxed space-y-12">
                          
                          <div className="flex items-center justify-between text-[#71717a] border-b border-[#27272a] pb-8">
                            <span>Diagnostic Sandbox Instance</span>
                            <span>Exit Code: {exec.exitCode}</span>
                          </div>

                          {/* Command Line Input */}
                          <div className="flex items-start gap-8 text-iris-violet font-semibold">
                            <span>$</span>
                            <span className="text-[#f4f4f5]">{exec.command}</span>
                          </div>

                          {/* Standard Output Stream */}
                          {exec.stdout && (
                            <div className="mt-8 text-[#e4e4e7] whitespace-pre-wrap pl-12 border-l border-[#27272a]">
                              {exec.stdout}
                            </div>
                          )}

                          {/* Standard Error Stream */}
                          {exec.stderr && (
                            <div className="mt-8 text-rose-400 whitespace-pre-wrap pl-12 border-l border-rose-900/40">
                              {exec.stderr}
                            </div>
                          )}

                          {/* Clean Process Terminate Message */}
                          {!exec.stdout && !exec.stderr && (
                            <div className="mt-8 text-[#71717a] italic pl-12 border-l border-[#27272a]">
                              Process completed cleanly with no console output.
                            </div>
                          )}

                        </div>

                      </div>
                    </div>
                  )}

                </div>
              );
            })
          ) : (
            <div className="p-40 text-center text-xs text-slate italic flex flex-col items-center justify-center gap-[12px] bg-soft-snow/20">
              <FileCode className="size-24 text-slate/40 shrink-0" />
              <span>No commands executed inside the sandbox yet. Click "Run Egress Check" or chat with Rhea to trigger.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
