"use client";

import * as React from "react";
import Link from "next/link";
import {
  Flame,
  Clock,
  TrendingDown,
  CheckCircle2,
  FileText,
  PieChart,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  Plus,
  MapPin,
  Users,
  Search,
  Eye,
  Camera,
  ExternalLink,
  X,
  Tag,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import type { HazardReport } from "@/lib/types/hazard";
import { hasPermission } from "@/lib/auth/roles";
import { useDashboardSession } from "./dashboard-shell";

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
        <span className="status-escalated bg-[#f3d9cf] text-[#8c2e1b] border-[#fecaca]">
          <i aria-hidden="true" className="bg-[#8c2e1b]" />
          Declined
        </span>
      );
    case "suspended":
      return (
        <span className="status-progress bg-[#f4e8be] text-[#7a540b] border-[#fed7aa]">
          <i aria-hidden="true" className="bg-[#7a540b]" />
          Suspended
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

interface RawReportInput {
  _id?: string;
  reportId?: string;
  userId?: string;
  description?: string;
  category?: string;
  status?: string;
  createdAt?: string;
  photos?: { filename?: string; byteSize?: number; downloadUrl?: string }[];
  photoUrls?: string[];
  officialRouting?: string;
  authority?: string;
  submissionLocation?: {
    latitude?: number;
    longitude?: number;
    landmark?: string;
  };
  deviceMetadata?: {
    landmark?: string;
  };
}

function mapRawReportToHazardReport(r: RawReportInput): HazardReport {
  const rid = r.reportId || r._id || "gnida-report";
  const statusNorm = (r.status || "").toUpperCase();
  const mappedStatus = (() => {
    if (statusNorm === "RESOLVED") return "resolved";
    if (statusNorm === "IN_PROGRESS" || statusNorm === "IN-PROGRESS" || statusNorm === "ASSIGNED")
      return "in-progress";
    if (statusNorm === "ESCALATED" || statusNorm === "MUNICIPALLY_DISPATCHED") return "escalated";
    if (statusNorm === "REJECTED") return "rejected";
    if (statusNorm === "SUSPENDED") return "suspended";
    if (statusNorm === "PROCESSING_FAILED") return "processing-failed";
    if (
      statusNorm === "SUBMITTED" ||
      statusNorm === "PROCESSING" ||
      statusNorm === "MODERATION_PENDING" ||
      statusNorm === "UNDER_REVIEW" ||
      statusNorm === "LOCATION_VERIFICATION_FAILED" ||
      statusNorm === "AI_ANALYSIS_FAILED" ||
      statusNorm === "EVIDENCE_VALIDATION_FAILED"
    )
      return "under-review";
    return "open";
  })();

  return {
    id: rid,
    userId: r.userId,
    title: r.description
      ? r.description.length > 60
        ? r.description.slice(0, 57) + "..."
        : r.description
      : `${r.category || "Road Hazard"} Report`,
    description: r.description || "Citizen road safety report",
    category: r.category || "road-surface",
    categoryLabel: (r.category || "Road Hazard")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    severity: "medium",
    status: mappedStatus as HazardReport["status"],
    latitude: r.submissionLocation?.latitude || 28.4744,
    longitude: r.submissionLocation?.longitude || 77.504,
    coordinates: `${Number(r.submissionLocation?.latitude || 28.4744).toFixed(4)}° N, ${Number(r.submissionLocation?.longitude || 77.504).toFixed(4)}° E`,
    landmark: r.submissionLocation?.landmark || r.deviceMetadata?.landmark || "Greater Noida",
    location: r.submissionLocation?.landmark || r.deviceMetadata?.landmark || "Greater Noida",
    time: r.createdAt
      ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Recently",
    reportedAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "Recently",
    createdAt: r.createdAt,
    publicOpinionStatus: mappedStatus === "under-review" ? "under_review" : "verified_hazard",
    verificationsCount: 1,
    votes: 1,
    photos:
      r.photos || (r.photoUrls ? r.photoUrls.map((u: string) => ({ downloadUrl: u })) : undefined),
    officialRouting:
      r.officialRouting || r.authority || "Greater Noida Industrial Development Authority (GNIDA)",
    authority: r.authority || "GNIDA Public Works Dept (PWD)",
  } as HazardReport & { createdAt?: string };
}

export default function DashboardPage() {
  const session = useDashboardSession();
  const canViewModeration = hasPermission(session.role, "canViewModerationQueue");
  const canViewAnalytics = hasPermission(session.role, "canViewCivicAnalytics");
  const showStaffPanel = canViewModeration || canViewAnalytics;

  const [reports, setReports] = React.useState<HazardReport[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedReport, setSelectedReport] = React.useState<HazardReport | null>(null);

  React.useEffect(() => {
    let active = true;

    async function fetchDashboardData() {
      try {
        const localReportIds =
          typeof window !== "undefined"
            ? JSON.parse(window.localStorage.getItem("jansahayak_user_reports") || "[]")
            : [];
        const idsParam =
          localReportIds.length > 0 ? `&ids=${encodeURIComponent(localReportIds.join(","))}` : "";
        const reportsUrl = showStaffPanel
          ? `/api/reports?limit=50${idsParam}`
          : `/api/reports?limit=50&scope=mine${idsParam}`;

        const [incidentsRes, reviewRes, reportsRes] = await Promise.all([
          showStaffPanel ? fetch("/api/map/incidents").catch(() => null) : Promise.resolve(null),
          canViewModeration
            ? fetch("/api/admin/review-queue").catch(() => null)
            : Promise.resolve(null),
          fetch(reportsUrl).catch(() => null),
        ]);

        const combined: HazardReport[] = [];
        const seenIds = new Set<string>();

        // 1. Process citizen reports
        if (reportsRes?.ok) {
          const repData = await reportsRes.json();
          if (repData.success && Array.isArray(repData.reports)) {
            for (const r of repData.reports) {
              const mapped = mapRawReportToHazardReport(r);
              if (!seenIds.has(mapped.id)) {
                combined.push(mapped);
                seenIds.add(mapped.id);
              }
            }
          }
        }

        // 2. Process published canonical incidents ONLY for staff/moderator overview
        if (showStaffPanel && incidentsRes?.ok) {
          const incData = await incidentsRes.json();
          if (incData.success && Array.isArray(incData.incidents)) {
            for (const inc of incData.incidents) {
              if (!seenIds.has(inc.id)) {
                combined.push(inc);
                seenIds.add(inc.id);
              }
            }
          }
        }

        // Sort combined so newest submissions appear at the top
        combined.sort((a, b) => {
          const timeA = (a as unknown as { createdAt?: string }).createdAt
            ? new Date((a as unknown as { createdAt?: string }).createdAt!).getTime()
            : 0;
          const timeB = (b as unknown as { createdAt?: string }).createdAt
            ? new Date((b as unknown as { createdAt?: string }).createdAt!).getTime()
            : 0;
          return timeB - timeA;
        });

        if (active) {
          setReports(combined);
        }

        if (reviewRes?.ok) {
          const revData = await reviewRes.json();
          if (active && revData.success && Array.isArray(revData.items)) {
            setPendingReviewCount(revData.items.length);
          }
        }
      } catch (err) {
        console.warn("Failed to load dashboard live data:", err);
      }
    }

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, [canViewModeration, showStaffPanel]);

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchesTab = (() => {
        if (activeTab === "all") return true;
        if (activeTab === "under-review") return r.status === "under-review";
        if (activeTab === "disputed") {
          return (
            r.publicOpinionStatus === "reopened_by_community" ||
            r.isPublicDisputed ||
            r.status === "escalated"
          );
        }
        return r.status === activeTab;
      })();

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
  }, [reports, activeTab, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[#cbd5cb]/60 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#17382f]">
              {showStaffPanel
                ? "Civic Operations Command Center"
                : `Namaste, ${session.fullName || "Citizen"}`}
            </h1>
            <Badge
              variant="outline"
              className={`text-xs font-mono font-semibold px-2.5 py-0.5 ${
                showStaffPanel
                  ? "bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb]"
                  : "bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
              }`}
            >
              {showStaffPanel ? `${session.role.toUpperCase()} Hub` : "Citizen Portal"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#5c6f66] leading-relaxed max-w-2xl">
            {showStaffPanel
              ? "Greater Noida road-safety hazard command center · Live triage, multi-agency dispatch & SLA tracking"
              : "Your Greater Noida road-safety portal · Track the real-time progress and civic resolution of your reports"}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            className="w-full sm:w-auto h-9 text-xs font-medium bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] justify-center shadow-xs"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5 mr-1.5" />
            <span>Report Hazard</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Telemetry Grid ─── */}
      {showStaffPanel ? (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Active Hazards
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#f3d9cf] flex items-center justify-center shrink-0">
                  <Flame className="size-4 text-[#8c2e1b]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {reports.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">
                {reports.length > 0 ? "Published on public map" : "No active hazards"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Review Queue
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#f4e8be] flex items-center justify-center shrink-0">
                  <Clock className="size-4 text-[#7a540b]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {canViewModeration ? pendingReviewCount : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">
                {!canViewModeration
                  ? "Municipal staff access"
                  : pendingReviewCount > 0
                    ? "Pending audit queue"
                    : "Queue clean & triaged"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Community Quorum
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#0e2b24]/10 flex items-center justify-center shrink-0">
                  <Users className="size-4 text-[#0e2b24]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {
                  reports.filter(
                    (r) =>
                      r.publicOpinionStatus === "reopened_by_community" ||
                      (r.votes || r.verificationsCount || 0) > 0,
                  ).length
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">
                {reports.filter((r) => r.publicOpinionStatus === "reopened_by_community").length > 0
                  ? `${reports.filter((r) => r.publicOpinionStatus === "reopened_by_community").length} disputed by citizens`
                  : "Citizen quorum active"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Target SLA
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#d6e5d2] flex items-center justify-center shrink-0">
                  <TrendingDown className="size-4 text-[#234a29]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                7.0d
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">GNIDA civil SLA benchmark</p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Remediated
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#d6e5d2] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-4 text-[#234a29]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {reports.filter((r) => r.status === "resolved").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">
                {reports.filter((r) => r.status === "resolved").length > 0
                  ? "Field repaired & closed"
                  : "Awaiting closure"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  My Reports
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#0e2b24]/10 flex items-center justify-center shrink-0">
                  <FileText className="size-4 text-[#0e2b24]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {reports.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">
                {reports.length > 0 ? "Total hazards submitted" : "No reports filed yet"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Under Review
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#f4e8be] flex items-center justify-center shrink-0">
                  <Clock className="size-4 text-[#7a540b]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {reports.filter((r) => r.status === "under-review" || r.status === "open").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">Awaiting municipal verification</p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Action In Progress
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#e9efe8] flex items-center justify-center shrink-0">
                  <Flame className="size-4 text-[#17382f]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {
                  reports.filter((r) => r.status === "in-progress" || r.status === "escalated")
                    .length
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">Field repair or inspection underway</p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Resolved &amp; Fixed
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#d6e5d2] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-4 text-[#234a29]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {reports.filter((r) => r.status === "resolved").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="text-xs text-[#5c6f66]">Verified remediations</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Main Dashboard Workspace Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Recent Reports Table (8 cols) */}
        <div
          className={`flex flex-col gap-6 ${showStaffPanel ? "lg:col-span-8" : "lg:col-span-12"}`}
        >
          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
            <CardHeader className="border-b border-[#cbd5cb] pb-4 p-4 sm:p-6 bg-[#faf9f5]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-[#17382f]">
                      {showStaffPanel ? "Recent Hazard Submissions" : "My Hazard Submissions"}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5c6f66]">
                      {showStaffPanel
                        ? "Community reports registered in Greater Noida civic database"
                        : "Real-time status tracking for road safety issues you have reported"}
                    </CardDescription>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9] self-start sm:self-auto"
                    render={<Link href="/dashboard/reports" />}
                  >
                    <span>View all reports</span>
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="h-8 bg-[#eef1e9] border border-[#d2d9d0] p-0.5">
                        <TabsTrigger
                          value="all"
                          className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                        >
                          All
                        </TabsTrigger>
                        <TabsTrigger
                          value="under-review"
                          className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                        >
                          Under Review
                        </TabsTrigger>
                        <TabsTrigger
                          value="open"
                          className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                        >
                          Open
                        </TabsTrigger>
                        <TabsTrigger
                          value="in-progress"
                          className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                        >
                          In Progress
                        </TabsTrigger>
                        <TabsTrigger
                          value="resolved"
                          className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                        >
                          Resolved
                        </TabsTrigger>
                        {showStaffPanel && (
                          <>
                            <TabsTrigger
                              value="escalated"
                              className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                            >
                              Escalated
                            </TabsTrigger>
                            <TabsTrigger
                              value="disputed"
                              className="text-xs px-2.5 data-[state=active]:bg-white data-[state=active]:text-[#0e2b24] data-[state=active]:font-semibold"
                            >
                              Disputed
                            </TabsTrigger>
                          </>
                        )}
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5c6f66] pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search title, location, ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 pr-7 text-xs bg-white border-[#cbd5cb] text-[#17382f] placeholder:text-[#5c6f66] focus-visible:ring-1 focus-visible:ring-[#0e2b24]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5c6f66] hover:text-[#17382f]"
                        aria-label="Clear search"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {reports.length === 0 ? (
                <Empty className="my-8 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText className="size-6 text-[#5c6f66]" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base font-semibold text-[#17382f]">
                      {showStaffPanel
                        ? "No reports logged yet"
                        : "You haven't reported any hazards yet"}
                    </EmptyTitle>
                    <EmptyDescription className="text-xs text-[#5c6f66] max-w-sm">
                      {showStaffPanel
                        ? "Citizen road-safety reports for Greater Noida will populate here with live verification status."
                        : "Notice a dangerous pothole, open manhole, waterlogging, or dark street? File a report to alert municipal authorities."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] text-xs font-medium"
                      render={<Link href="/reports/new" />}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      <span>{showStaffPanel ? "File First Report" : "Report a Hazard"}</span>
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : filteredReports.length === 0 ? (
                <Empty className="my-8 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyTitle className="text-base font-semibold text-[#17382f]">
                      No matching reports found
                    </EmptyTitle>
                    <EmptyDescription className="text-xs text-[#5c6f66]">
                      {searchQuery
                        ? `No reports matched "${searchQuery}" under "${activeTab}".`
                        : `No reports found under status filter "${activeTab}".`}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-[#cbd5cb] text-[#17382f]"
                      onClick={() => {
                        setActiveTab("all");
                        setSearchQuery("");
                      }}
                    >
                      Reset Filters &amp; Search
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <>
                  {/* Mobile Touch-Friendly Card Feed (< sm) */}
                  <div className="divide-y divide-[#cbd5cb]/60 sm:hidden">
                    {filteredReports.map((report) => (
                      <div
                        key={report.id}
                        className="p-3.5 space-y-2 hover:bg-[#f5f3ed]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
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
                            <Tag className="size-2.5 text-[#486057]" />
                            {report.categoryLabel || report.category}
                          </div>
                          <p className="text-xs font-semibold text-[#17382f] line-clamp-2">
                            {report.title}
                          </p>
                          <p className="text-xs text-[#5c6f66] flex items-center gap-1 mt-1">
                            <MapPin className="size-3 shrink-0 text-[#234a29]" />
                            <span className="truncate">{report.location || report.landmark}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#5c6f66] pt-2 border-t border-[#cbd5cb]/40">
                          <span>{report.time || report.reportedAt || "Recently"}</span>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedReport(report)}
                            className="h-6 px-2 text-[11px] border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                          >
                            <Eye className="size-3 mr-1 text-[#486057]" />
                            <span>Inspect</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#f5f3ed]/60">
                        <TableRow className="border-[#cbd5cb]">
                          <TableHead className="w-28 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Case ID
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Hazard Dossier
                          </TableHead>
                          <TableHead className="w-24 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Severity
                          </TableHead>
                          <TableHead className="w-36 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Status
                          </TableHead>
                          <TableHead className="w-28 text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Reported
                          </TableHead>
                          <TableHead className="w-24 text-right text-xs font-semibold text-[#486057] uppercase tracking-wider">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report) => (
                          <TableRow
                            key={report.id}
                            className="border-[#cbd5cb]/60 hover:bg-[#f5f3ed]/50 transition-colors"
                          >
                            <TableCell className="font-mono text-xs font-bold text-[#486057]">
                              {report.id}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 py-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 rounded bg-[#eef1e9] text-[#17382f] border border-[#d2d9d0] px-1.5 py-0.5 text-[10px] font-medium">
                                    <Tag className="size-2.5 text-[#486057]" />
                                    {report.categoryLabel || report.category}
                                  </span>
                                  <span className="font-semibold text-xs sm:text-sm text-[#17382f] line-clamp-1">
                                    {report.title}
                                  </span>
                                </div>
                                <span className="text-xs text-[#5c6f66] flex items-center gap-1">
                                  <MapPin className="size-3 text-[#234a29] shrink-0" />
                                  <span className="truncate">
                                    {report.location || report.landmark}
                                  </span>
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                            <TableCell>
                              {getStatusBadge(report.status, report.publicOpinionStatus)}
                            </TableCell>
                            <TableCell className="text-xs text-[#5c6f66] font-medium">
                              {report.time || report.reportedAt || "Recently"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setSelectedReport(report)}
                                className="h-7 px-2 text-xs border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                              >
                                <Eye className="size-3 mr-1 text-[#486057]" />
                                <span>Inspect</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="border-t border-[#cbd5cb] px-4 py-3 sm:px-6 bg-[#faf9f5]">
              <div className="flex items-center justify-between w-full text-xs text-[#5c6f66]">
                <span>
                  Showing {filteredReports.length} of {reports.length} report
                  {reports.length === 1 ? "" : "s"}
                </span>
                <Link
                  href="/dashboard/reports"
                  className="text-[#0e2b24] font-medium hover:underline underline-offset-4 flex items-center gap-1"
                >
                  <span>View detailed reports</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right: Staff-only operational cards (4 cols) */}
        {showStaffPanel && (
          <div className="flex flex-col gap-6 lg:col-span-4">
            {canViewModeration && (
              <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-[#0e2b24]" />
                      <CardTitle className="text-base font-bold text-[#0e2b24]">
                        Moderation Queue
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-bold text-xs ${
                        pendingReviewCount > 0
                          ? "bg-[#f3d9cf] text-[#8c2e1b] border-[#e4876f]/50"
                          : "bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb]"
                      }`}
                    >
                      {pendingReviewCount > 0 ? `${pendingReviewCount} Needs Review` : "0 Pending"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-[#5c6f66]">
                    {pendingReviewCount > 0
                      ? "Citizen reports awaiting moderator verification and official approval."
                      : "All citizen submissions have been audited. Review queue is clean."}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs border-[#cbd5cb] text-[#0e2b24] hover:bg-[#0e2b24]/5"
                    render={<Link href="/dashboard/moderation" />}
                  >
                    <span>Open Moderation Console</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {canViewAnalytics && (
              <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-[#17382f]">
                        System Telemetry
                      </CardTitle>
                      <CardDescription className="text-xs text-[#5c6f66]">
                        Pipeline health and outbox event queue status
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Empty className="my-2 border-0 bg-transparent py-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <PieChart className="size-5 text-[#5c6f66]" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm font-semibold text-[#17382f]">
                        Live System Observability
                      </EmptyTitle>
                      <EmptyDescription className="text-xs text-[#5c6f66]">
                        Detailed metrics for pipeline stages, AI latency, and outbox delivery are
                        available in the analytics dashboard.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </CardContent>
                <CardFooter className="border-t border-[#cbd5cb] pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs h-8 text-[#0e2b24] hover:bg-[#0e2b24]/5"
                    render={<Link href="/dashboard/analytics" />}
                  >
                    <span>View Live Analytics</span>
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Report Inspection Modal ─── */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-lg bg-[#faf9f5] border-[#cbd5cb] text-[#17382f] p-5 sm:p-6 shadow-lg">
          {selectedReport && (
            <div className="space-y-4">
              <DialogHeader className="space-y-1.5 text-left">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs font-bold bg-[#eef1e9] text-[#17382f] border border-[#d2d9d0] px-2 py-0.5 rounded">
                    {selectedReport.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(selectedReport.status, selectedReport.publicOpinionStatus)}
                    {getSeverityBadge(selectedReport.severity)}
                  </div>
                </div>
                <DialogTitle className="text-base sm:text-lg font-bold text-[#17382f] leading-snug">
                  {selectedReport.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5c6f66] flex items-center gap-1 pt-0.5">
                  <MapPin className="size-3 text-[#234a29] shrink-0" />
                  <span>{selectedReport.location || selectedReport.landmark}</span>
                  {selectedReport.coordinates && (
                    <span className="font-mono text-[11px] ml-1">
                      ({selectedReport.coordinates})
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 border-y border-[#cbd5cb]/70 text-xs text-[#17382f]">
                <div>
                  <h4 className="font-semibold text-[#486057] uppercase tracking-wider text-[10px] mb-1">
                    Citizen Statement &amp; Hazard Description
                  </h4>
                  <p className="bg-white p-3 rounded-md border border-[#cbd5cb]/70 text-xs leading-relaxed text-[#17382f]">
                    {selectedReport.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#eef1e9]/60 p-2.5 rounded-md border border-[#d2d9d0]/70">
                    <p className="text-[10px] font-semibold text-[#5c6f66] uppercase tracking-wider">
                      Authority Routing
                    </p>
                    <p className="font-medium text-[#17382f] mt-0.5 truncate">
                      {selectedReport.authority ||
                        selectedReport.officialRouting ||
                        "GNIDA Municipal Dispatch"}
                    </p>
                  </div>
                  <div className="bg-[#eef1e9]/60 p-2.5 rounded-md border border-[#d2d9d0]/70">
                    <p className="text-[10px] font-semibold text-[#5c6f66] uppercase tracking-wider">
                      Submission Timestamp
                    </p>
                    <p className="font-medium text-[#17382f] mt-0.5">
                      {selectedReport.reportedAt || selectedReport.time || "Recently"}
                    </p>
                  </div>
                </div>

                {selectedReport.photos && selectedReport.photos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[#486057] uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1">
                      <Camera className="size-3 text-[#486057]" /> Photo Evidence Attached
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedReport.photos.map((p, idx) =>
                        p.downloadUrl ? (
                          <a
                            key={idx}
                            href={p.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block relative rounded-md border border-[#cbd5cb] overflow-hidden hover:opacity-90 shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.downloadUrl}
                              alt={`Evidence ${idx + 1}`}
                              className="size-20 object-cover"
                            />
                          </a>
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                  className="text-xs border-[#cbd5cb] text-[#17382f]"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
                  render={<Link href={`/reports/${selectedReport.id}`} />}
                >
                  <span>Public Incident Page</span>
                  <ExternalLink className="size-3.5 ml-1.5" />
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
