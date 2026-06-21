"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Incident {
  incident_id: string;
  title: string;
  description: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "INVESTIGATING" | "RESOLVED";
  created_at: string;
  resolved_at: string | null;
}

interface IncidentsListProps {
  initialIncidents: Incident[];
  userRole?: string;
}

export function IncidentsList({ initialIncidents, userRole }: IncidentsListProps) {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  const isReadOnly = userRole === "VIEWER";

  // Filter logic
  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch = incident.title.toLowerCase().includes(search.toLowerCase()) ||
      (incident.description && incident.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === "ALL" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "ALL" || incident.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          severity: newSeverity,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create incident");
      }

      const createdIncident = await res.json();
      setIncidents([createdIncident, ...incidents]);
      
      // Reset form
      setNewTitle("");
      setNewDesc("");
      setNewSeverity("MEDIUM");
      setIsModalOpen(false);
      
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error reporting incident. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MEDIUM":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "LOW":
        return "bg-slate/5 text-slate border-slate/15";
      default:
        return "bg-slate/5 text-slate border-slate/15";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <AlertTriangle className="size-[16px] text-rose-600 shrink-0 animate-pulse" />;
      case "INVESTIGATING":
        return <Clock className="size-[16px] text-iris-violet shrink-0" />;
      case "RESOLVED":
        return <CheckCircle2 className="size-[16px] text-emerald-600 shrink-0" />;
      default:
        return null;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "INVESTIGATING":
        return "bg-iris-violet/5 text-iris-violet border-iris-violet/15";
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate/5 text-slate border-slate/15";
    }
  };

  return (
    <div className="space-y-16">
      {/* Toolbar */}
      <div className="flex flex-col gap-[12px] md:flex-row md:items-center md:justify-between bg-soft-snow p-16 rounded border border-mist shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-[12px] top-[10px] size-[16px] text-slate" />
          <Input
            placeholder="Search incidents by title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-[36px] bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 focus:outline-hidden"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-[12px]">
          {/* Status filter */}
          <div className="flex items-center gap-[6px] bg-paper-white border border-mist rounded px-[12px] py-[6px]">
            <span className="text-xs text-slate">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-graphite-ink text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-paper-white text-graphite-ink">All</option>
              <option value="ACTIVE" className="bg-paper-white text-rose-600 font-semibold">Active</option>
              <option value="INVESTIGATING" className="bg-paper-white text-iris-violet font-semibold">Investigating</option>
              <option value="RESOLVED" className="bg-paper-white text-emerald-600 font-semibold">Resolved</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-[6px] bg-paper-white border border-mist rounded px-[12px] py-[6px]">
            <span className="text-xs text-slate">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent border-none text-graphite-ink text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-paper-white text-graphite-ink">All</option>
              <option value="CRITICAL" className="bg-paper-white text-rose-600 font-semibold">Critical</option>
              <option value="HIGH" className="bg-paper-white text-orange-600 font-semibold">High</option>
              <option value="MEDIUM" className="bg-paper-white text-amber-600 font-semibold">Medium</option>
              <option value="LOW" className="bg-paper-white text-slate font-semibold">Low</option>
            </select>
          </div>

          {/* Create Button (Requires operator permissions) */}
          {!isReadOnly && (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <button className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer select-none">
                  <Plus className="size-[14px]" />
                  Report Incident
                </button>
              </DialogTrigger>
              <DialogContent className="bg-paper-white border border-mist text-graphite-ink rounded-lg shadow-lg max-w-md w-full">
                <form onSubmit={handleReportIncident}>
                  <DialogHeader>
                    <DialogTitle className="font-lustria text-xl text-graphite-ink">Report System Incident</DialogTitle>
                    <DialogDescription className="text-slate text-sm">
                      Create an incident ticket. Rhea will automatically begin investigations if configured.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-16 py-16">
                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Incident Title</label>
                      <Input
                        required
                        placeholder="e.g. Memory leak on API Gateway"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="bg-paper-white border border-mist text-graphite-ink focus:border-slate/40 rounded px-[12px] py-[8px] focus:outline-hidden"
                      />
                    </div>

                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Severity</label>
                      <div className="flex gap-[8px]">
                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((sev) => (
                          <button
                            type="button"
                            key={sev}
                            onClick={() => setNewSeverity(sev as any)}
                            className={`flex-1 py-8 px-[12px] rounded border text-xs font-semibold transition-all cursor-pointer ${
                              newSeverity === sev
                                ? "bg-iris-violet/5 border-iris-violet text-iris-violet ring-1 ring-iris-violet"
                                : "bg-paper-white border-mist text-slate hover:bg-soft-snow"
                            }`}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-[4px]">
                      <label className="text-[10px] font-mono font-medium text-slate uppercase tracking-wider">Description & context</label>
                      <textarea
                        rows={4}
                        placeholder="Describe the anomalies, stacktraces, log records, or alerts..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full rounded border border-mist bg-paper-white p-12 text-sm text-graphite-ink focus:border-slate/40 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="border border-mist bg-paper-white hover:bg-soft-snow text-slate rounded px-[16px] py-[10px] font-mono text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm select-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-iris-violet hover:bg-iris-violet/90 text-paper-white border border-transparent shadow-sm rounded font-mono text-[11px] uppercase tracking-wider px-[16px] py-[10px] flex items-center gap-[8px] transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-[14px] animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Incident"
                      )}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Incident List Table */}
      <div className="border border-mist rounded overflow-hidden bg-paper-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-mist bg-soft-snow text-[10px] font-mono font-medium text-slate uppercase tracking-wider">
                <th className="py-16 px-24">Incident Details</th>
                <th className="py-16 px-24 text-center">Severity</th>
                <th className="py-16 px-24 text-center">Status</th>
                <th className="py-16 px-24">Created At</th>
                <th className="py-16 px-24">Resolved At</th>
                <th className="py-16 px-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-48 text-center text-slate text-sm">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.incident_id}
                    className="hover:bg-soft-snow/50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/incidents/${incident.incident_id}`)}
                  >
                    <td className="py-16 px-24">
                      <div className="flex flex-col gap-[2px]">
                        <span className="font-semibold text-sm text-graphite-ink group-hover:text-iris-violet transition-colors">
                          {incident.title}
                        </span>
                        {incident.description && (
                          <span className="text-xs text-slate line-clamp-1 max-w-xl">
                            {incident.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-16 px-24 text-center">
                      <span className={`px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold ${getSeverityStyles(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="py-16 px-24 text-center">
                      <div className={`inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-[100px] text-[9px] font-mono uppercase tracking-wider border leading-none font-semibold status-badge ${getStatusStyles(incident.status)}`}>
                        {getStatusIcon(incident.status)}
                        <span>
                          {incident.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-16 px-24 text-slate text-xs font-mono">
                      {new Date(incident.created_at).toLocaleString()}
                    </td>
                    <td className="py-16 px-24 text-slate text-xs font-mono">
                      {incident.resolved_at 
                        ? new Date(incident.resolved_at).toLocaleString() 
                        : <span className="text-slate/40">—</span>
                      }
                    </td>
                    <td className="py-16 px-24 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/incidents/${incident.incident_id}`}>
                        <button
                          className="border border-mist hover:border-slate/40 bg-paper-white hover:bg-soft-snow text-slate hover:text-graphite-ink text-xs px-[12px] py-[6px] gap-[4px] rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center shadow-sm select-none cursor-pointer"
                        >
                          Investigate
                          <ChevronRight className="size-[12px]" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
