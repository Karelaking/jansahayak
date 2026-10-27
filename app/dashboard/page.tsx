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
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <span className="status-escalated bg-[#f3d9cf] text-[#8c2e1b] border-[#fecaca]">
        <i aria-hidden="true" className="bg-[#e4876f]" />
        Citizen Disputed
      </span>
    );
  }
  if (publicOpinionStatus === "verified_by_community") {
    return (
      <span className="status-progress bg-[#f4e8be] text-[#7a540b] border-[#fed7aa]">
        <i aria-hidden="true" className="bg-[#e7b64f]" />
        Community Verified
      </span>
    );
  }
  if (publicOpinionStatus === "under_repair") {
    return (
      <span className="status-progress bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb]">
        <i aria-hidden="true" className="bg-[#78a37d]" />
        Under Repair
      </span>
    );
  }
  if (publicOpinionStatus === "under_review") {
    return (
      <span className="status-open bg-[#f4e8be] text-[#7a540b] border-[#fed7aa]">
        <i aria-hidden="true" className="bg-[#e7b64f]" />
        Quorum Pending
      </span>
    );
  }

  switch (status) {
    case "open":
      return (
        <span className="status-open">
          <i aria-hidden="true" />
          Open
        </span>
      );
    case "in-progress":
      return (
        <span className="status-progress">
          <i aria-hidden="true" />
          In Progress
        </span>
      );
    case "escalated":
      return (
        <span className="status-escalated">
          <i aria-hidden="true" />
          Escalated
        </span>
      );
    case "resolved":
      return (
        <span className="status-resolved">
          <i aria-hidden="true" />
          Resolved
        </span>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "high":
    case "critical":
      return (
        <span className="sev-high">
          <i aria-hidden="true" />
          High
        </span>
      );
    case "medium":
    case "moderate":
      return (
        <span className="sev-medium">
          <i aria-hidden="true" />
          Medium
        </span>
      );
    default:
      return (
        <span className="sev-low">
          <i aria-hidden="true" />
          Low
        </span>
      );
  }
}

function mapRawReportToHazardReport(r: any): HazardReport {
  const rid = r.reportId || r._id;
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
    status: mappedStatus as any,
    latitude: r.submissionLocation?.latitude || 28.4744,
    longitude: r.submissionLocation?.longitude || 77.504,
    coordinates: `${Number(r.submissionLocation?.latitude || 28.4744).toFixed(4)}° N, ${Number(r.submissionLocation?.longitude || 77.504).toFixed(4)}° E`,
    landmark: r.submissionLocation?.landmark || r.deviceMetadata?.landmark || "Greater Noida",
    location: r.submissionLocation?.landmark || r.deviceMetadata?.landmark || "Greater Noida",
    time: r.createdAt
      ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Recently",
    reportedAt: r.createdAt
      ? new Date(r.createdAt).toLocaleDateString("en-IN")
      : "Recently",
    createdAt: r.createdAt,
    publicOpinionStatus: mappedStatus === "under-review" ? "under_review" : "verified_hazard",
    verificationsCount: 1,
    votes: 1,
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
    if (activeTab === "all") return reports;
    if (activeTab === "under-review") {
      return reports.filter((r) => r.status === "under-review");
    }
    if (activeTab === "disputed") {
      return reports.filter(
        (r) =>
          r.publicOpinionStatus === "reopened_by_community" ||
          r.isPublicDisputed ||
          r.status === "escalated",
      );
    }
    return reports.filter((r) => r.status === activeTab);
  }, [reports, activeTab]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {showStaffPanel
                ? "Civic Operations Command Center"
                : `Namaste, ${session.fullName || "Citizen"}`}
            </h1>
            <Badge
              variant="outline"
              className={`text-[11px] font-mono ${
                showStaffPanel
                  ? "bg-[#d6e5d2] text-[#234a29] border-[#cbd5cb]"
                  : "bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
              }`}
            >
              {showStaffPanel ? `${session.role.toUpperCase()} Hub` : "Citizen Portal"}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {showStaffPanel
              ? "Greater Noida road-safety hazard command center · Monitoring, triage & SLA tracking"
              : "Your Greater Noida road-safety portal · Track the live progress and resolution of your submitted reports"}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            className="w-full sm:w-auto h-9 sm:h-8 text-xs font-medium bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] justify-center shadow-xs"
            render={<Link href="/reports/new" />}
          >
            <Plus className="size-3.5 mr-1" />
            <span>Report Hazard</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Telemetry Grid ─── */}
      {showStaffPanel ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Active Hazards
                </CardDescription>
                <Flame className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reports.length > 0 ? "Published on public map" : "No active hazards"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Pending Verification
                </CardDescription>
                <Clock className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {canViewModeration ? pendingReviewCount : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {!canViewModeration
                  ? "Visible to municipal staff"
                  : pendingReviewCount > 0
                    ? "Awaiting moderator review"
                    : "Review queue clean"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Community Quorum
                </CardDescription>
                <Users className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {
                  reports.filter(
                    (r) =>
                      r.publicOpinionStatus === "reopened_by_community" ||
                      (r.votes || r.verificationsCount || 0) > 0,
                  ).length
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reports.filter((r) => r.publicOpinionStatus === "reopened_by_community").length > 0
                  ? `${reports.filter((r) => r.publicOpinionStatus === "reopened_by_community").length} disputed by citizens`
                  : "Active citizen consensus"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Target Resolution SLA
                </CardDescription>
                <TrendingDown className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                7.0d
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Standard GNIDA civil SLA</p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Resolved Incidents
                </CardDescription>
                <CheckCircle2 className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.filter((r) => r.status === "resolved").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reports.filter((r) => r.status === "resolved").length > 0
                  ? "Verified remediations"
                  : "Awaiting closure"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  My Reports
                </CardDescription>
                <FileText className="size-4 text-muted-foreground/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {reports.length > 0 ? "Total hazards submitted" : "No reports filed yet"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Under Review
                </CardDescription>
                <Clock className="size-4 text-amber-600/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.filter((r) => r.status === "under-review" || r.status === "open").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Awaiting municipal triage
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Action In Progress
                </CardDescription>
                <Flame className="size-4 text-orange-600/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.filter((r) => r.status === "in-progress" || r.status === "escalated").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Field work / repair underway
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Resolved &amp; Fixed
                </CardDescription>
                <CheckCircle2 className="size-4 text-emerald-600/70 shrink-0" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
                {reports.filter((r) => r.status === "resolved").length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Verified remediations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Main Dashboard Workspace Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Recent Reports Table (8 cols) */}
        <div className={`flex flex-col gap-6 ${showStaffPanel ? "lg:col-span-8" : "lg:col-span-12"}`}>
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-3.5 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {showStaffPanel ? "Recent Hazard Submissions" : "My Hazard Submissions"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {showStaffPanel
                      ? "Community reports registered in database"
                      : "Real-time status tracking for issues you have reported"}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 sm:w-auto">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="h-8 w-max min-w-full justify-start sm:w-auto">
                        <TabsTrigger value="all" className="text-xs px-2.5">All</TabsTrigger>
                        <TabsTrigger value="under-review" className="text-xs px-2.5">Under Review</TabsTrigger>
                        <TabsTrigger value="open" className="text-xs px-2.5">Open</TabsTrigger>
                        <TabsTrigger value="in-progress" className="text-xs px-2.5">In Progress</TabsTrigger>
                        <TabsTrigger value="resolved" className="text-xs px-2.5">Resolved</TabsTrigger>
                        {showStaffPanel && (
                          <>
                            <TabsTrigger value="escalated" className="text-xs px-2.5">Escalated</TabsTrigger>
                            <TabsTrigger value="disputed" className="text-xs px-2.5">Disputed</TabsTrigger>
                          </>
                        )}
                      </TabsList>
                    </Tabs>
                  </div>

                  <CardAction>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs ml-auto"
                      render={<Link href="/dashboard/reports" />}
                    >
                      <span>View all</span>
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </CardAction>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {reports.length === 0 ? (
                <Empty className="my-8 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {showStaffPanel ? "No reports logged yet" : "You haven't reported any hazards yet"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {showStaffPanel
                        ? "Citizen road-safety reports for Greater Noida will populate here with live verification status."
                        : "Notice a dangerous pothole, open manhole, waterlogging, or dark street? File a report to alert municipal authorities."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      size="sm"
                      className="bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed]"
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
                    <EmptyTitle>No reports match this status</EmptyTitle>
                    <EmptyDescription>
                      No records found under &quot;{activeTab}&quot;.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("all")}>
                      Show All Reports
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <>
                  {/* Mobile Touch-Friendly Card Feed (< sm) */}
                  <div className="divide-y divide-border/60 sm:hidden">
                    {filteredReports.map((report) => (
                      <Link
                        key={report.id}
                        href="/dashboard/reports"
                        className="block p-3.5 space-y-2 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground">
                            {report.id}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {getStatusBadge(report.status, report.publicOpinionStatus)}
                            {getSeverityBadge(report.severity)}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            {report.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3 shrink-0 text-emerald-700" />
                            <span className="truncate">{report.location || report.landmark}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>{report.time || report.reportedAt || "Recently"}</span>
                          <span className="font-medium">
                            {report.votes || report.verificationsCount || 0} verifications
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop Table (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">ID</TableHead>
                          <TableHead>Hazard Dossier</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Votes</TableHead>
                          <TableHead className="text-right">Reported</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report) => (
                          <TableRow key={report.id} className="hover:bg-muted/40">
                            <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                              {report.id}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground text-sm line-clamp-1">
                                  {report.title}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="size-3" />
                                  {report.location || report.landmark}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                            <TableCell>
                              {getStatusBadge(report.status, report.publicOpinionStatus)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs">
                              {report.votes || report.verificationsCount || 0}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {report.time || report.reportedAt || "Recently"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>

            <CardFooter className="border-t border-border px-4 py-3 sm:px-6 bg-muted/10">
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                <span>
                  Showing {filteredReports.length} of {reports.length} reports
                </span>
                <Link
                  href="/dashboard/reports"
                  className="text-foreground hover:underline underline-offset-4"
                >
                  View full reports →
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right: Staff-only operational cards (4 cols) */}
        {showStaffPanel && (
          <div className="flex flex-col gap-6 lg:col-span-4">
            {canViewModeration && (
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-emerald-800" />
                      <CardTitle className="text-base text-[#0e2b24]">Moderation Queue</CardTitle>
                    </div>
                    <Badge
                      variant={pendingReviewCount > 0 ? "destructive" : "outline"}
                      className="font-bold text-xs"
                    >
                      {pendingReviewCount > 0 ? `${pendingReviewCount} Needs Review` : "0 Pending"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {pendingReviewCount > 0
                      ? "Citizen reports awaiting moderator verification and official approval."
                      : "All citizen submissions have been audited. Review queue is clean."}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs"
                    render={<Link href="/dashboard/moderation" />}
                  >
                    <span>Open Moderation Console</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {canViewAnalytics && (
              <Card className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">System Telemetry</CardTitle>
                      <CardDescription className="text-xs">
                        Pipeline health and outbox event queue status
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Empty className="my-2 border-0 bg-transparent py-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <PieChart className="size-5 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm font-medium">
                        Live System Observability
                      </EmptyTitle>
                      <EmptyDescription className="text-[11px]">
                        Detailed metrics for pipeline stages, AI latency, and outbox delivery are
                        available in the analytics dashboard.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </CardContent>
                <CardFooter className="border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs h-8"
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
    </div>
  );
}
