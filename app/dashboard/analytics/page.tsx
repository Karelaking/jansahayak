"use client";

import * as React from "react";
import {
  Download,
  Clock,
  CheckCircle2,
  Users,
  Activity,
  BarChart3,
  PieChart,
  RotateCcw,
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
import { Progress } from "@/components/ui/progress";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { RoleGuard } from "@/components/auth/role-guard";

interface LiveMetrics {
  totalIncidents: number;
  publishedIncidents: number;
  underReviewIncidents: number;
  approvedIncidents: number;
  rejectedIncidents: number;
  totalReports: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryCounts: Record<string, number>;
  outboxCounts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = React.useState<LiveMetrics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchAnalytics = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.warn("Failed to fetch live analytics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const categories = React.useMemo(() => {
    if (!metrics || !metrics.categoryCounts) return [];
    const total = metrics.totalIncidents || 1;
    return Object.entries(metrics.categoryCounts).map(([cat, count]) => ({
      label: cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [metrics]);

  const handleExportAuditReport = () => {
    if (!metrics) return;
    const auditPayload = {
      auditDossierId: `AUDIT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`,
      platform: "JanSahayak SafeStreets",
      jurisdiction: "Greater Noida Industrial Development Authority (GNIDA)",
      exportedAt: new Date().toISOString(),
      summary: {
        totalIncidentsRecorded: metrics.totalIncidents,
        publishedOnPublicMap: metrics.publishedIncidents,
        criticalSeverityHazards: metrics.severityCounts.critical,
        moderationQueuePending: metrics.underReviewIncidents,
        approvedIncidents: metrics.approvedIncidents,
        rejectedIncidents: metrics.rejectedIncidents,
        totalRawReports: metrics.totalReports,
      },
      categoryDistribution: metrics.categoryCounts,
      severityBreakdown: metrics.severityCounts,
      outboxPipelineTelemetry: metrics.outboxCounts,
    };

    const blob = new Blob([JSON.stringify(auditPayload, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `jansahayak_civic_safety_audit_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <RoleGuard requiredPermission="canViewCivicAnalytics">
      <div className="flex flex-col gap-6">
        {/* ── Page Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#cbd5cb]/60 pb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-xl font-bold tracking-tight text-[#17382f] sm:text-2xl md:text-3xl">
                Civic Safety Analytics
              </h1>
              <Badge
                variant="outline"
                className="text-xs bg-[#eef1e9] text-[#17382f] border-[#d2d9d0]"
              >
                Live Database Telemetry
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#5c6f66]">
              Quantifiable road hazard metrics, pipeline processing status, and verified incident
              telemetry across Greater Noida.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 sm:h-8 flex-1 sm:flex-none justify-center border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9]"
              onClick={fetchAnalytics}
              disabled={isLoading}
            >
              <RotateCcw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 sm:h-8 flex-1 sm:flex-none justify-center border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9]"
              onClick={handleExportAuditReport}
              disabled={!metrics || isLoading}
            >
              <Download className="size-3.5" />
              <span>Export Audit</span>
            </Button>
          </div>
        </div>

        {/* ── KPI Metric Cards ─── */}
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs p-4 sm:p-5">
            <CardHeader className="p-0 pb-1.5">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Total Hazards
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#f3d9cf] flex items-center justify-center shrink-0">
                  <Activity className="size-4 text-[#8c2e1b]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {metrics ? metrics.totalIncidents : "0"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <p className="text-xs text-[#5c6f66] truncate">
                {metrics && metrics.totalIncidents > 0
                  ? `${metrics.publishedIncidents} published to live map`
                  : "No incidents registered"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs p-4 sm:p-5">
            <CardHeader className="p-0 pb-1.5">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Citizen Reports
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#0e2b24]/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-4 text-[#0e2b24]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {metrics ? metrics.totalReports : "0"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <p className="text-xs text-[#5c6f66] truncate">
                {metrics && metrics.totalReports > 0
                  ? "Stored in intake database"
                  : "Awaiting submissions"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs p-4 sm:p-5">
            <CardHeader className="p-0 pb-1.5">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Under Review
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#f4e8be] flex items-center justify-center shrink-0">
                  <Clock className="size-4 text-[#7a540b]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {metrics ? metrics.underReviewIncidents : "0"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <p className="text-xs text-[#5c6f66] truncate">
                {metrics && metrics.underReviewIncidents > 0
                  ? "In moderation audit queue"
                  : "Review queue clear"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs p-4 sm:p-5">
            <CardHeader className="p-0 pb-1.5">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-[#486057] uppercase tracking-wider truncate">
                  Outbox Pipeline
                </CardDescription>
                <div className="size-8 rounded-lg bg-[#d6e5d2] flex items-center justify-center shrink-0">
                  <Users className="size-4 text-[#234a29]" />
                </div>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0e2b24] mt-1">
                {metrics ? metrics.outboxCounts.completed : "0"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-1">
              <p className="text-xs text-[#5c6f66] truncate">
                {metrics ? `${metrics.outboxCounts.pending} pending dispatch` : "Outbox clear"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Analytics Visualizations Grid ─── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Severity Distribution (7 cols) */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
              <CardHeader className="border-b border-[#cbd5cb] p-4 sm:p-6 pb-3 sm:pb-4 bg-[#faf9f5]">
                <CardTitle className="text-base sm:text-lg font-bold text-[#17382f]">
                  Incident Severity Breakdown
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-[#5c6f66]">
                  Urgency levels assigned across verified physical road defects.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6">
                {!metrics || metrics.totalIncidents === 0 ? (
                  <Empty className="my-6 border-0 bg-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <BarChart3 className="size-6 text-[#5c6f66]" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-semibold text-[#17382f]">
                        No severity data collected yet
                      </EmptyTitle>
                      <EmptyDescription className="text-xs text-[#5c6f66]">
                        Hazard severity distribution will graph automatically as reports are
                        submitted and analyzed across Greater Noida sectors.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#8c2e1b]">Critical Emergencies</span>
                        <span className="font-mono font-bold text-[#8c2e1b]">
                          {metrics.severityCounts.critical} (
                          {Math.round(
                            (metrics.severityCounts.critical / metrics.totalIncidents) * 100,
                          )}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={(metrics.severityCounts.critical / metrics.totalIncidents) * 100}
                        className="h-2"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#7a540b]">High Urgency</span>
                        <span className="font-mono font-bold text-[#7a540b]">
                          {metrics.severityCounts.high} (
                          {Math.round((metrics.severityCounts.high / metrics.totalIncidents) * 100)}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={(metrics.severityCounts.high / metrics.totalIncidents) * 100}
                        className="h-2"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#17382f]">Medium Severity</span>
                        <span className="font-mono font-bold text-[#17382f]">
                          {metrics.severityCounts.medium} (
                          {Math.round(
                            (metrics.severityCounts.medium / metrics.totalIncidents) * 100,
                          )}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={(metrics.severityCounts.medium / metrics.totalIncidents) * 100}
                        className="h-2"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#234a29]">Low / Minor</span>
                        <span className="font-mono font-bold text-[#234a29]">
                          {metrics.severityCounts.low} (
                          {Math.round((metrics.severityCounts.low / metrics.totalIncidents) * 100)}
                          %)
                        </span>
                      </div>
                      <Progress
                        value={(metrics.severityCounts.low / metrics.totalIncidents) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-[#cbd5cb] px-6 py-3 bg-[#faf9f5] text-xs text-[#5c6f66]">
                <span>PRD §8 Vision classification and municipal urgency scoring</span>
              </CardFooter>
            </Card>
          </div>

          {/* Right: Category Breakdown (5 cols) */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <Card className="bg-[#faf9f5] border-[#cbd5cb] shadow-xs">
              <CardHeader className="border-b border-[#cbd5cb] p-4 sm:p-6 pb-3 sm:pb-4 bg-[#faf9f5]">
                <CardTitle className="text-base sm:text-lg font-bold text-[#17382f]">
                  Distribution by Category
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-[#5c6f66]">
                  Breakdown by hazard typology across Greater Noida pilot.
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 p-4 sm:p-6 pt-4 sm:pt-4">
                {!metrics || categories.length === 0 ? (
                  <Empty className="my-6 border-0 bg-transparent">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <PieChart className="size-6 text-[#5c6f66]" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base font-semibold text-[#17382f]">
                        No category telemetry
                      </EmptyTitle>
                      <EmptyDescription className="text-xs text-[#5c6f66]">
                        Typology distribution across road surface, footpaths, lighting, and
                        crossings will populate once reports are submitted.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  categories.map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#17382f]">{item.label}</span>
                        <span className="text-[#5c6f66] font-mono font-medium">
                          {item.count} ({item.pct}%)
                        </span>
                      </div>
                      <Progress value={item.pct} className="h-1.5" />
                    </div>
                  ))
                )}
              </CardContent>

              <CardFooter className="border-t border-[#cbd5cb] px-6 py-3 bg-[#faf9f5] text-xs text-[#5c6f66]">
                <span>Live PostGIS canonical grouping</span>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
