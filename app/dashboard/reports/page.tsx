"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Download,
  MapPin,
  Eye,
  FileText,
  RotateCcw,
  Users,
  ThumbsUp,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Camera,
} from "lucide-react";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { HazardReport } from "@/lib/types/hazard";
import { useDashboardSession } from "../dashboard-shell";

/** Status vs severity are separate vocabularies (Severity/Status Split). */
function getStatusBadge(status: string, publicOpinionStatus?: string) {
  if (publicOpinionStatus === "reopened_by_community") {
    return (
      <span className="status-escalated bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50">
        <i aria-hidden="true" className="bg-[#8c2e1b]" />
        Citizen Disputed
      </span>
    );
  }
  if (publicOpinionStatus === "verified_by_community") {
    return (
      <span className="status-progress bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/40">
        <i aria-hidden="true" className="bg-[#78a37d]" />
        Community Verified
      </span>
    );
  }
  if (publicOpinionStatus === "under_repair") {
    return (
      <span className="status-progress bg-[#e9efe8] text-[#17382f] border-[#cbd5cb]">
        <i aria-hidden="true" className="bg-[#e7b64f]" />
        Under Repair
      </span>
    );
  }
  if (publicOpinionStatus === "under_review") {
    return (
      <span className="status-open bg-[#f4e8be] text-[#7a540b] border-[#e7b64f]/40">
        <i aria-hidden="true" className="bg-[#e7b64f]" />
        Quorum Pending
      </span>
    );
  }

  switch (status) {
    case "open":
      return (
        <span className="status-open bg-[#f4e8be] text-[#7a540b] border-[#e7b64f]/40">
          <i aria-hidden="true" className="bg-[#e7b64f]" />
          Open
        </span>
      );
    case "under-review":
      return (
        <span className="status-progress bg-[#f4e8be] text-[#7a540b] border-[#e7b64f]/40">
          <i aria-hidden="true" className="bg-[#e7b64f]" />
          Under Review
        </span>
      );
    case "in-progress":
      return (
        <span className="status-progress bg-[#e9efe8] text-[#17382f] border-[#cbd5cb]">
          <i aria-hidden="true" className="bg-[#e7b64f]" />
          In Progress
        </span>
      );
    case "escalated":
      return (
        <span className="status-escalated bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50">
          <i aria-hidden="true" className="bg-[#8c2e1b]" />
          Escalated
        </span>
      );
    case "resolved":
      return (
        <span className="status-resolved bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/40">
          <i aria-hidden="true" className="bg-[#78a37d]" />
          Resolved
        </span>
      );
    case "rejected":
      return (
        <span className="status-rejected inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f3d9cf] text-[#8c2e1b] border border-[#e4876f]/50">
          <i aria-hidden="true" className="size-1.5 rounded-full bg-[#8c2e1b]" />
          Rejected
        </span>
      );
    case "suspended":
      return (
        <span className="status-suspended inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f4e8be] text-[#7a540b] border border-[#e7b64f]/40">
          <i aria-hidden="true" className="size-1.5 rounded-full bg-[#7a540b]" />
          Suspended
        </span>
      );
    case "processing-failed":
      return (
        <span className="status-failed inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f3d9cf] text-[#8c2e1b] border border-[#e4876f]/50">
          <i aria-hidden="true" className="size-1.5 rounded-full bg-[#e4876f]" />
          Processing Interrupted
        </span>
      );
    default:
      return (
        <span className="status-open bg-[#faf9f5] text-[#17382f] border-[#cbd5cb]">
          <i aria-hidden="true" className="bg-[#cbd5cb]" />
          {status}
        </span>
      );
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "high":
    case "critical":
      return (
        <span className="sev-high bg-[#f3d9cf] text-[#8c2e1b] border border-[#e4876f]/40 font-semibold">
          <i aria-hidden="true" className="bg-[#e4876f]" />
          High
        </span>
      );
    case "medium":
    case "moderate":
      return (
        <span className="sev-medium bg-[#f4e8be] text-[#7a540b] border border-[#e7b64f]/40 font-semibold">
          <i aria-hidden="true" className="bg-[#e7b64f]" />
          Medium
        </span>
      );
    default:
      return (
        <span className="sev-low bg-[#d6e5d2] text-[#234a29] border border-[#78a37d]/40 font-semibold">
          <i aria-hidden="true" className="bg-[#78a37d]" />
          Low
        </span>
      );
  }
}

export default function ReportsPage() {
  const session = useDashboardSession();
  const isStaff = session.role === "moderator" || session.role === "admin";
  const sessionUserId = session.userId || "";
  const userRole = session.role || "citizen";

  const [reports, setReports] = React.useState<HazardReport[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("all");
  const [selectedReport, setSelectedReport] = React.useState<HazardReport | null>(null);
  const [scopeFilter, setScopeFilter] = React.useState<"mine" | "all">(isStaff ? "all" : "mine");

  // Edit Report State
  const [editingReport, setEditingReport] = React.useState<HazardReport | null>(null);
  const [editForm, setEditForm] = React.useState({
    description: "",
    category: "road-surface",
    landmark: "",
  });
  const [isUpdatingReport, setIsUpdatingReport] = React.useState(false);

  // Delete Report State
  const [deletingReport, setDeletingReport] = React.useState<HazardReport | null>(null);
  const [isDeletingReport, setIsDeletingReport] = React.useState(false);

  // Feedback banner
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch database reports
  const loadReports = React.useCallback(async () => {
    try {
      const localReportIds: string[] =
        typeof window !== "undefined"
          ? JSON.parse(window.localStorage.getItem("jansahayak_user_reports") || "[]")
          : [];
      const idsParam =
        localReportIds.length > 0 ? `&ids=${encodeURIComponent(localReportIds.join(","))}` : "";

      const effectiveScope = isStaff ? scopeFilter : "mine";
      const reportsUrl =
        effectiveScope === "mine"
          ? `/api/reports?limit=100&scope=mine${idsParam}`
          : `/api/reports?limit=100${idsParam}`;

      const [mapRes, reportsRes] = await Promise.all([
        isStaff && effectiveScope === "all"
          ? fetch("/api/map/incidents").catch(() => null)
          : Promise.resolve(null),
        fetch(reportsUrl).catch(() => null),
      ]);

      const mapData = mapRes && mapRes.ok ? await mapRes.json() : null;
      const reportsData = reportsRes && reportsRes.ok ? await reportsRes.json() : null;

      const combined: HazardReport[] = [];
      const seenIds = new Set<string>();

      // 1. Prioritize raw citizen submissions from MongoDB
      if (reportsData && Array.isArray(reportsData.reports)) {
        for (const r of reportsData.reports) {
          const rid = r.reportId || r._id;
          if (rid && !seenIds.has(rid)) {
            combined.push({
              id: rid,
              userId: r.userId,
              title: r.description ? r.description.slice(0, 60) : `${r.category} Report`,
              description: r.description || "Citizen road safety report",
              category: r.category || "road-surface",
              categoryLabel: (r.category || "Road Hazard")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c: string) => c.toUpperCase()),
              severity: "medium",
              status: (() => {
                const norm = (r.status || "").toUpperCase();
                if (norm === "RESOLVED") return "resolved";
                if (norm === "IN_PROGRESS" || norm === "IN-PROGRESS" || norm === "ASSIGNED")
                  return "in-progress";
                if (norm === "ESCALATED" || norm === "MUNICIPALLY_DISPATCHED") return "escalated";
                if (norm === "REJECTED") return "rejected";
                if (norm === "SUSPENDED") return "suspended";
                if (norm === "PROCESSING_FAILED") return "processing-failed";
                if (
                  norm === "SUBMITTED" ||
                  norm === "PROCESSING" ||
                  norm === "MODERATION_PENDING" ||
                  norm === "UNDER_REVIEW" ||
                  norm === "LOCATION_VERIFICATION_FAILED" ||
                  norm === "AI_ANALYSIS_FAILED" ||
                  norm === "EVIDENCE_VALIDATION_FAILED"
                )
                  return "under-review";
                return "open";
              })(),
              latitude: r.submissionLocation?.latitude || r.location?.latitude || 28.4744,
              longitude: r.submissionLocation?.longitude || r.location?.longitude || 77.504,
              landmark:
                r.submissionLocation?.landmark ||
                r.location?.landmark ||
                r.submissionLocation?.address ||
                r.location?.address ||
                "Greater Noida",
              location:
                r.submissionLocation?.landmark ||
                r.location?.landmark ||
                r.submissionLocation?.address ||
                r.location?.address ||
                "Greater Noida",
              time: r.createdAt
                ? new Date(r.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recently",
              reportedAt: r.createdAt
                ? new Date(r.createdAt).toLocaleDateString("en-IN")
                : "Recently",
              createdAt: r.createdAt,
              photos: r.photos || [],
            } as HazardReport & { createdAt?: string });
            seenIds.add(rid);
            if (r.associatedIncidentId) {
              seenIds.add(r.associatedIncidentId);
            }
          }
        }
      }

      // 2. Canonical incidents from PostgreSQL (staff overview ONLY when viewing all community reports)
      if (isStaff && effectiveScope === "all" && mapData && Array.isArray(mapData.incidents)) {
        for (const inc of mapData.incidents) {
          if (!seenIds.has(inc.id)) {
            combined.push(inc);
            seenIds.add(inc.id);
          }
        }
      }

      // Sort combined by creation date descending so newly submitted reports appear first
      combined.sort((a, b) => {
        const timeA = (a as unknown as { createdAt?: string }).createdAt
          ? new Date((a as unknown as { createdAt?: string }).createdAt!).getTime()
          : 0;
        const timeB = (b as unknown as { createdAt?: string }).createdAt
          ? new Date((b as unknown as { createdAt?: string }).createdAt!).getTime()
          : 0;
        return timeB - timeA;
      });

      setReports(combined);
    } catch (e) {
      console.warn("Could not load database reports for registry:", e);
    }
  }, [isStaff, scopeFilter]);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Filtered reports
  const filteredReports = React.useMemo(() => {
    const localReportIds: string[] =
      typeof window !== "undefined"
        ? JSON.parse(window.localStorage.getItem("jansahayak_user_reports") || "[]")
        : [];

    return reports.filter((r) => {
      // Regular citizens can strictly ONLY view their own submissions
      if (!isStaff || scopeFilter === "mine") {
        const isMine =
          (sessionUserId && r.userId === sessionUserId) || localReportIds.includes(r.id);
        if (!isMine) return false;
      }

      const matchesTab =
        activeTab === "all"
          ? true
          : activeTab === "under-review"
            ? r.status === "under-review"
            : r.status === activeTab;

      const q = searchQuery.toLowerCase().trim();
      const loc = r.location || r.landmark || "";
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q));

      return matchesTab && matchesSearch;
    });
  }, [reports, activeTab, searchQuery, scopeFilter, sessionUserId, isStaff]);

  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  // Status update by staff
  const handleStatusChange = async (newStatus: HazardReport["status"]) => {
    if (!selectedReport) return;
    setIsUpdatingStatus(true);
    try {
      const apiStatus =
        newStatus === "in-progress" ? "in_progress" : newStatus === "open" ? "approved" : newStatus;

      await fetch("/api/admin/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: selectedReport.id,
          status: apiStatus,
          officialNote: `Status updated to ${newStatus} via Reports Registry dashboard`,
        }),
      }).catch((err) => console.warn("Failed to persist status to backend:", err));

      setReports((prev) =>
        prev.map((r) => (r.id === selectedReport.id ? { ...r, status: newStatus } : r)),
      );
      setSelectedReport((prev) => (prev ? { ...prev, status: newStatus } : null));
      setFeedback({ type: "success", text: `Status updated to ${newStatus}.` });
    } catch (err) {
      console.error("Error updating status:", err);
      setFeedback({ type: "error", text: "Failed to update lifecycle status." });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (report: HazardReport) => {
    setEditingReport(report);
    setEditForm({
      description: report.description || report.title || "",
      category: report.category || "road-surface",
      landmark: report.landmark || report.location || "",
    });
  };

  // Submit Edit Report Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;

    setIsUpdatingReport(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/reports/${editingReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description,
          category: editForm.category,
          landmark: editForm.landmark,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update report.");
      }

      setReports((prev) =>
        prev.map((r) =>
          r.id === editingReport.id
            ? {
                ...r,
                description: editForm.description,
                title: editForm.description.slice(0, 60),
                category: editForm.category,
                landmark: editForm.landmark,
                location: editForm.landmark,
              }
            : r,
        ),
      );

      if (selectedReport?.id === editingReport.id) {
        setSelectedReport((prev) =>
          prev
            ? {
                ...prev,
                description: editForm.description,
                title: editForm.description.slice(0, 60),
                category: editForm.category,
                landmark: editForm.landmark,
                location: editForm.landmark,
              }
            : null,
        );
      }

      setEditingReport(null);
      setFeedback({ type: "success", text: "Report details updated successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsUpdatingReport(false);
    }
  };

  // Submit Delete Report
  const handleConfirmDelete = async () => {
    if (!deletingReport) return;

    setIsDeletingReport(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/reports/${deletingReport.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete report.");
      }

      setReports((prev) => prev.filter((r) => r.id !== deletingReport.id));
      if (selectedReport?.id === deletingReport.id) {
        setSelectedReport(null);
      }

      setFeedback({
        type: "success",
        text: `Report ${deletingReport.id} retracted and deleted from civic registry.`,
      });
      setDeletingReport(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setIsDeletingReport(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredReports.length === 0) return;
    const headers = [
      "Report ID",
      "Title",
      "Category",
      "Severity",
      "Status",
      "Latitude",
      "Longitude",
      "Location / Landmark",
      "Assigned Authority",
      "Reported Time",
      "Description",
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = filteredReports.map((r) => [
      escapeCsv(r.id),
      escapeCsv(r.title),
      escapeCsv(r.category),
      escapeCsv(r.severity),
      escapeCsv(r.status),
      r.latitude ?? "",
      r.longitude ?? "",
      escapeCsv(r.location || r.landmark || ""),
      escapeCsv(r.authority || r.officialRouting || "GNIDA Civil Maintenance"),
      escapeCsv(r.reportedAt || r.time || ""),
      escapeCsv(r.description || ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `jansahayak_hazard_reports_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#cbd5cb]/60 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-xl font-bold tracking-tight text-[#17382f] sm:text-2xl md:text-3xl">
              {isStaff
                ? scopeFilter === "mine"
                  ? "My Submissions"
                  : "Hazard Reports Registry"
                : "My Submitted Reports"}
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
            >
              {filteredReports.length} of {reports.length}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase font-mono font-semibold border ${
                userRole === "admin"
                  ? "bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50"
                  : userRole === "moderator"
                    ? "bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb]"
                    : "bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
              }`}
            >
              {isStaff ? `${userRole} Access` : "Citizen"}
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#5c6f66]">
            {isStaff
              ? "Browse, inspect, update lifecycle status, and manage all Greater Noida hazard dockets."
              : "Review your submitted civic reports, update descriptions, or retract submissions."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isStaff && (
            <div className="flex items-center gap-1 bg-[#eef1e9] p-0.5 rounded-lg border border-[#d2d9d0] text-xs w-full sm:w-auto">
              <Button
                type="button"
                variant={scopeFilter === "mine" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setScopeFilter("mine")}
                className={`h-8 sm:h-7 text-xs font-medium flex-1 sm:flex-none ${
                  scopeFilter === "mine" ? "bg-white text-[#0e2b24] shadow-xs" : "text-[#486057]"
                }`}
              >
                My Submissions
              </Button>
              <Button
                type="button"
                variant={scopeFilter === "all" ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setScopeFilter("all")}
                className={`h-8 sm:h-7 text-xs font-medium flex-1 sm:flex-none ${
                  scopeFilter === "all" ? "bg-white text-[#0e2b24] shadow-xs" : "text-[#486057]"
                }`}
              >
                All Community Reports
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 sm:h-8 flex-1 sm:flex-none text-xs border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9]"
            onClick={() => loadReports()}
          >
            <RotateCcw className="size-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 sm:h-8 flex-1 sm:flex-none text-xs border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9]"
            onClick={handleExportCsv}
            disabled={filteredReports.length === 0}
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>

          <Button
            size="sm"
            className="h-9 sm:h-8 bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] w-full sm:w-auto text-xs font-medium justify-center shadow-xs"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5 mr-1" />
            <span>New Report</span>
          </Button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg p-3 text-xs border ${
            feedback.type === "success"
              ? "bg-[#d6e5d2] text-[#234a29] border-[#78a37d]/50"
              : "bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-[#234a29]" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-[#8c2e1b]" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setFeedback(null)}
            className="h-6 px-2 text-inherit hover:bg-black/5"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Table & Mobile Card View ─── */}
      <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-[#cbd5cb] pb-4 p-4 sm:p-6 bg-[#faf9f5]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative w-full md:max-w-xs">
              <Input
                placeholder="Search title, location, category..."
                className="pl-8 text-xs h-9 bg-white border-[#cbd5cb] text-[#17382f] placeholder:text-[#5c6f66] focus-visible:ring-1 focus-visible:ring-[#0e2b24]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-3 size-3.5 text-[#5c6f66] pointer-events-none" />
            </div>

            {/* Status Filter Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-5 md:w-auto h-9 bg-[#eef1e9] border border-[#d2d9d0] p-0.5">
                <TabsTrigger
                  value="all"
                  className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="under-review"
                  className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                >
                  Under Review
                </TabsTrigger>
                <TabsTrigger
                  value="open"
                  className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                >
                  Open
                </TabsTrigger>
                <TabsTrigger
                  value="in-progress"
                  className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                >
                  In Progress
                </TabsTrigger>
                <TabsTrigger
                  value="resolved"
                  className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                >
                  Resolved
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText className="size-6 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-semibold">
                    {isStaff
                      ? "No reports in civic registry"
                      : "You haven't submitted any hazard reports yet"}
                  </EmptyTitle>
                  <EmptyDescription className="text-xs max-w-sm mx-auto">
                    {isStaff
                      ? "Citizen hazard reports logged for Greater Noida will populate here."
                      : "Notice a pothole, open manhole, waterlogging, or dark street? File a report with photo evidence to alert municipal authorities."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
                    render={<Link href="/reports/new" />}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    <span>Report a Hazard</span>
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText className="size-6 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm font-semibold">
                    No reports match your filters
                  </EmptyTitle>
                  <EmptyDescription className="text-xs">
                    No records found under &quot;{activeTab}&quot;
                    {searchQuery ? ` matching "${searchQuery}"` : ""}. Try adjusting your criteria.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <div className="divide-y divide-[#cbd5cb]/60 md:hidden">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 space-y-3 hover:bg-[#f5f3ed]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#486057]">
                        {report.id}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {getStatusBadge(report.status, report.publicOpinionStatus)}
                        {getSeverityBadge(report.severity)}
                      </div>
                    </div>

                    <div>
                      <div className="inline-flex items-center gap-1 rounded bg-[#eef1e9] text-[#17382f] border border-[#d2d9d0] px-1.5 py-0.5 text-[10px] font-medium mb-1">
                        {report.categoryLabel || report.category}
                      </div>
                      <h4 className="text-sm font-semibold text-[#17382f] leading-snug">
                        {report.title}
                      </h4>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#5c6f66]">
                        <MapPin className="size-3 shrink-0 text-[#234a29]" />
                        <span className="truncate max-w-[240px]">
                          {report.location || report.landmark}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-xs text-[#5c6f66] border-t border-[#cbd5cb]/40">
                      <span>{report.time || report.reportedAt || "Recently"}</span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedReport(report)}
                          className="h-7 px-2 text-xs border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                        >
                          <Eye className="size-3 mr-1 text-[#486057]" />
                          <span>Inspect</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenEdit(report)}
                          className="h-7 px-2 text-xs border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                        >
                          <Pencil className="size-3 mr-1 text-[#486057]" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setDeletingReport(report)}
                          className="h-7 px-2 text-xs border-[#e4876f]/50 text-[#8c2e1b] hover:text-[#8c2e1b] hover:bg-[#f3d9cf]/50"
                        >
                          <Trash2 className="size-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#f5f3ed]/60">
                    <TableRow className="border-[#cbd5cb]">
                      <TableHead className="w-[120px] text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Case ID
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Hazard Details
                      </TableHead>
                      <TableHead className="w-32 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Category
                      </TableHead>
                      <TableHead className="w-40 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Location
                      </TableHead>
                      <TableHead className="w-36 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Status
                      </TableHead>
                      <TableHead className="w-24 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Severity
                      </TableHead>
                      <TableHead className="w-48 text-right text-xs font-semibold text-[#486057] uppercase tracking-wider">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer border-[#cbd5cb]/60 hover:bg-[#f5f3ed]/60 transition-colors"
                        onClick={() => setSelectedReport(report)}
                      >
                        <TableCell className="font-mono text-xs font-bold text-[#17382f]">
                          {report.id}
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-xs sm:text-sm text-[#17382f] line-clamp-1">
                            {report.title}
                          </div>
                          <div className="text-xs text-[#5c6f66] mt-0.5">
                            Reported {report.time || report.reportedAt || "Recently"} ·{" "}
                            {report.votes || report.verificationsCount || 0} verifications
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded bg-[#eef1e9] text-[#17382f] border border-[#d2d9d0] px-1.5 py-0.5 text-[10px] font-medium">
                            {report.categoryLabel || report.category}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="flex items-center gap-1 text-xs text-[#5c6f66]">
                            <MapPin className="size-3 shrink-0 text-[#234a29]" />
                            <span className="truncate max-w-[150px]">
                              {report.location || report.landmark}
                            </span>
                          </span>
                        </TableCell>

                        <TableCell>
                          {getStatusBadge(report.status, report.publicOpinionStatus)}
                        </TableCell>

                        <TableCell>{getSeverityBadge(report.severity)}</TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="xs"
                              className="gap-1 text-xs h-7 px-2 border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="size-3 text-[#486057]" />
                              <span>Inspect</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              className="gap-1 text-xs h-7 px-2 border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                              onClick={() => handleOpenEdit(report)}
                            >
                              <Pencil className="size-3 text-[#486057]" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              className="gap-1 text-xs h-7 px-2 border-[#e4876f]/50 text-[#8c2e1b] hover:text-[#8c2e1b] hover:bg-[#f3d9cf]/50"
                              onClick={() => setDeletingReport(report)}
                            >
                              <Trash2 className="size-3" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Showing <strong className="font-medium">{filteredReports.length}</strong> reports
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" disabled>
              Previous
            </Button>
            <Button variant="outline" size="xs" disabled={filteredReports.length < 10}>
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* ── Edit Report Modal Dialog ─── */}
      <Dialog open={!!editingReport} onOpenChange={(open) => !open && setEditingReport(null)}>
        {editingReport && (
          <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {editingReport.id}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Edit Report Details
                </Badge>
              </div>
              <DialogTitle className="mt-1 text-base font-bold text-[#0e2b24]">
                Update Road Hazard Submission
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Revise hazard description, category, or location notes to help road maintenance
                crews.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-report-category"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Hazard Category
                </label>
                <select
                  id="edit-report-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#17382f]"
                >
                  <option value="road-surface">Road Surface / Pothole</option>
                  <option value="pothole">Deep Pothole / Crater</option>
                  <option value="drainage">Open Drain / Waterlogging</option>
                  <option value="lighting">Broken Streetlight / Dark Spot</option>
                  <option value="signal-failure">Traffic Signal Failure</option>
                  <option value="obstruction">Road Obstruction / Debris</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="edit-report-description"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Hazard Description &amp; Details
                </label>
                <Textarea
                  id="edit-report-description"
                  rows={4}
                  required
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the severity, lane obstruction, or road conditions..."
                  className="text-xs bg-white border-[#cbd5cb] text-[#17382f]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="edit-report-landmark"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Landmark / Location Clarification
                </label>
                <Input
                  id="edit-report-landmark"
                  type="text"
                  value={editForm.landmark}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, landmark: e.target.value }))}
                  placeholder="e.g. Near Pari Chowk Roundabout, Opposite Metro Pillar 140"
                  className="text-xs bg-white border-[#cbd5cb] text-[#17382f] h-9"
                />
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingReport(null)}
                  disabled={isUpdatingReport}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdatingReport}
                  className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-white"
                >
                  {isUpdatingReport ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner className="size-3.5" />
                      <span>Saving Changes...</span>
                    </span>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Delete Report Confirmation Dialog ─── */}
      <Dialog open={!!deletingReport} onOpenChange={(open) => !open && setDeletingReport(null)}>
        {deletingReport && (
          <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-800">
                <Trash2 className="size-5" />
              </div>
              <DialogTitle className="text-center text-base font-bold text-[#0e2b24]">
                Retract &amp; Delete Hazard Report?
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-[#5c6f66]">
                Are you sure you want to retract docket <strong>{deletingReport.id}</strong>? This
                will delete your report from the public civic registry and remove it from active
                municipal dockets.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 space-y-1">
              <p className="font-semibold">Important Consideration:</p>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Retracting a report removes it from civic progress tracking. If this hazard has
                already been dispatched to municipal contractors, field teams will be notified of
                case retraction.
              </p>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingReport(null)}
                disabled={isDeletingReport}
              >
                Keep Report
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeletingReport}
              >
                {isDeletingReport ? (
                  <span className="flex items-center gap-1.5">
                    <Spinner className="size-3.5" />
                    <span>Retracting...</span>
                  </span>
                ) : (
                  <span>Yes, Delete Report</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Report Detail Dialog using shadcn Dialog ─── */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        {selectedReport && (
          <DialogContent className="max-w-xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {selectedReport.id}
                </span>
                {getStatusBadge(selectedReport.status)}
                {getSeverityBadge(selectedReport.severity)}
                {selectedReport.publicOpinionStatus && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold border ${
                      selectedReport.publicOpinionStatus === "community_resolved"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : selectedReport.publicOpinionStatus === "public_disputed" ||
                            selectedReport.publicOpinionStatus === "reopened_by_community"
                          ? "bg-rose-100 text-rose-900 border-rose-300"
                          : selectedReport.publicOpinionStatus === "under_repair"
                            ? "bg-blue-100 text-blue-900 border-blue-300"
                            : "bg-[#eaf1e9] text-[#1e4638] border-[#c5d8c3]"
                    }`}
                  >
                    {selectedReport.publicOpinionStatus === "community_resolved"
                      ? "Resolved by Community Consensus"
                      : selectedReport.publicOpinionStatus === "public_disputed" ||
                          selectedReport.publicOpinionStatus === "reopened_by_community"
                        ? "Community Disputed (Defect Persists)"
                        : selectedReport.publicOpinionStatus === "under_repair"
                          ? "Under Repair (Awaiting Citizen Consensus)"
                          : "Active Community Hazard"}
                  </Badge>
                )}
              </div>
              <DialogTitle className="mt-2 text-lg font-bold">{selectedReport.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Reported {selectedReport.time || selectedReport.reportedAt || "Recently"} · Sector:{" "}
                {selectedReport.location || selectedReport.landmark}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2 text-xs">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="font-medium text-muted-foreground">Incident Description</p>
                <p className="mt-1 leading-relaxed text-foreground">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border p-2.5">
                  <span className="text-muted-foreground">Assigned Authority</span>
                  <p className="font-medium mt-0.5 text-foreground">
                    {selectedReport.authority ||
                      selectedReport.officialRouting ||
                      "GNIDA Civil Maintenance"}
                  </p>
                </div>
                <div className="rounded-md border border-border p-2.5">
                  <span className="text-muted-foreground">GPS Geotag</span>
                  <p className="font-mono font-medium mt-0.5 text-foreground">
                    {selectedReport.coordinates ||
                      `${selectedReport.latitude}, ${selectedReport.longitude}`}
                  </p>
                </div>
              </div>

              {/* Attached Evidence Photographs */}
              {selectedReport.photos && selectedReport.photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      Attached Evidence Photographs
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {selectedReport.photos.length} captures recorded
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {selectedReport.photos.map((p, idx) => (
                      <div
                        key={idx}
                        className="group relative rounded-lg border border-border overflow-hidden bg-muted aspect-video flex items-center justify-center"
                      >
                        {p.downloadUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.downloadUrl}
                            alt={p.filename || `Evidence photo ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <Camera className="size-5 text-muted-foreground opacity-50" />
                        )}
                        {p.downloadUrl && (
                          <a
                            href={p.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity"
                          >
                            View Original
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status transition controls (Role Gated) */}
              {isStaff ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-medium text-foreground">
                      Update Lifecycle Status (Staff Action)
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      PRD §14B Consensus Gated
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      disabled={isUpdatingStatus}
                      variant={selectedReport.status === "open" ? "default" : "outline"}
                      onClick={() => handleStatusChange("open")}
                    >
                      Open
                    </Button>
                    <Button
                      size="xs"
                      disabled={isUpdatingStatus}
                      variant={selectedReport.status === "in-progress" ? "default" : "outline"}
                      onClick={() => handleStatusChange("in-progress")}
                    >
                      In Progress
                    </Button>
                    <Button
                      size="xs"
                      disabled={isUpdatingStatus}
                      variant={selectedReport.status === "escalated" ? "default" : "outline"}
                      onClick={() => handleStatusChange("escalated")}
                    >
                      Escalate to Authority
                    </Button>
                    <Button
                      size="xs"
                      disabled={isUpdatingStatus}
                      variant={selectedReport.status === "resolved" ? "default" : "outline"}
                      onClick={() => handleStatusChange("resolved")}
                    >
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-lg bg-[#faf9f5] border border-[#cbd5cb] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#0e2b24] flex items-center gap-1.5">
                      <Users className="size-3.5 text-[#17382f]" />
                      <span>Citizen Governance &amp; Public Voice</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#5c6f66]">PRD §14B Quorum</span>
                  </div>
                  <p className="text-[11px] text-[#486057] leading-relaxed">
                    Under PRD §14B, repair progress strictly requires local resident verification.
                    You can cast your verification vote or inspect the live public safety map.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link href={`/reports/${selectedReport.id}`}>
                      <Button
                        size="xs"
                        className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-white gap-1 text-[11px]"
                      >
                        <ThumbsUp className="size-3" />
                        <span>Cast Verification Vote</span>
                      </Button>
                    </Link>
                    <Link href={`/map?highlight=${selectedReport.id}`}>
                      <Button
                        size="xs"
                        variant="outline"
                        className="border-[#cbd5cb] text-[#0e2b24] gap-1 text-[11px]"
                      >
                        <MapPin className="size-3 text-emerald-800" />
                        <span>View on Safety Map</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1">
                {(isStaff || (sessionUserId && selectedReport.userId === sessionUserId)) && (
                  <>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleOpenEdit(selectedReport)}
                      className="gap-1 text-xs text-[#0e2b24]"
                    >
                      <Pencil className="size-3" />
                      <span>Edit Details</span>
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeletingReport(selectedReport)}
                      className="gap-1 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200"
                    >
                      <Trash2 className="size-3" />
                      <span>Retract</span>
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/reports/${selectedReport.id}`}>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-[#0e2b24] hover:bg-[#1c4b3e] text-white"
                  >
                    <FileText className="size-3.5" />
                    <span>Track Dossier</span>
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
