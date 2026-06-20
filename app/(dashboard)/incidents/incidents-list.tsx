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
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "HIGH":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "MEDIUM":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "LOW":
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <AlertTriangle className="size-4 text-red-500 shrink-0 animate-pulse" />;
      case "INVESTIGATING":
        return <Clock className="size-4 text-purple-500 shrink-0" />;
      case "RESOLVED":
        return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
      default:
        return null;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "INVESTIGATING":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "RESOLVED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-zinc-900/30 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-zinc-500" />
          <Input
            placeholder="Search incidents by title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-zinc-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-zinc-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-950">All</option>
              <option value="ACTIVE" className="bg-zinc-950 text-red-400">Active</option>
              <option value="INVESTIGATING" className="bg-zinc-950 text-purple-400">Investigating</option>
              <option value="RESOLVED" className="bg-zinc-950 text-emerald-400">Resolved</option>
            </select>
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5">
            <span className="text-xs text-zinc-500">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent border-none text-zinc-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-950">All</option>
              <option value="CRITICAL" className="bg-zinc-950 text-red-400">Critical</option>
              <option value="HIGH" className="bg-zinc-950 text-orange-400">High</option>
              <option value="MEDIUM" className="bg-zinc-950 text-yellow-400">Medium</option>
              <option value="LOW" className="bg-zinc-950 text-zinc-400">Low</option>
            </select>
          </div>

          {/* Create Button (Requires operator permissions) */}
          {!isReadOnly && (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-1">
                  <Plus className="size-4" />
                  Report Incident
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <form onSubmit={handleReportIncident}>
                  <DialogHeader>
                    <DialogTitle className="text-white text-xl">Report System Incident</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Create an incident ticket. Rhea will automatically begin investigations if configured.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Incident Title</label>
                      <Input
                        required
                        placeholder="e.g. Memory leak on API Gateway"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-zinc-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Severity</label>
                      <div className="flex gap-2">
                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((sev) => (
                          <button
                            type="button"
                            key={sev}
                            onClick={() => setNewSeverity(sev as any)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                              newSeverity === sev
                                ? `${getSeverityStyles(sev)} border-purple-500 ring-1 ring-purple-500`
                                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"
                            }`}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 uppercase">Description & context</label>
                      <textarea
                        rows={4}
                        placeholder="Describe the anomalies, stacktraces, log records, or alerts..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-zinc-700 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Incident"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Incident List Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/10 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-4 px-6">Incident Details</th>
                <th className="py-4 px-6 text-center">Severity</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Created At</th>
                <th className="py-4 px-6">Resolved At</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 text-sm">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.incident_id}
                    className="hover:bg-zinc-800/10 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/incidents/${incident.incident_id}`)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">
                          {incident.title}
                        </span>
                        {incident.description && (
                          <span className="text-xs text-zinc-500 line-clamp-1 max-w-xl">
                            {incident.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSeverityStyles(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border status-badge">
                        {getStatusIcon(incident.status)}
                        <span className={getStatusStyles(incident.status).split(" ")[1]}>
                          {incident.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-zinc-400 text-xs">
                      {new Date(incident.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-zinc-400 text-xs">
                      {incident.resolved_at 
                        ? new Date(incident.resolved_at).toLocaleString() 
                        : <span className="text-zinc-600">—</span>
                      }
                    </td>
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/incidents/${incident.incident_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-zinc-800 hover:border-zinc-700 bg-zinc-950 hover:bg-zinc-800 hover:text-white text-zinc-300 text-xs px-3 py-1 gap-1"
                        >
                          Investigate
                          <ChevronRight className="size-3" />
                        </Button>
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
