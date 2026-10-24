"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  TrendingDown,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  Plus,
  MapPin,
  Flame,
  FileText,
  PieChart,
  Building2,
  RotateCcw,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { SAMPLE_HAZARDS, SAMPLE_ESCALATIONS, SAMPLE_CIVIC_ANALYTICS } from "@/lib/data";
import type { HazardReport, EscalationDocket } from "@/lib/types/hazard";

const EMPTY_REPORTS: HazardReport[] = [];
const EMPTY_ESCALATIONS: EscalationDocket[] = [];

/** Status vs severity are separate vocabularies (Severity/Status Split). */
function getStatusBadge(status: string) {
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

export default function DashboardPage() {
  // Empty state by default; centralized sample data previewable via button
  const [isDemo, setIsDemo] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("all");

  const reports = isDemo ? SAMPLE_HAZARDS : EMPTY_REPORTS;
  const escalations = isDemo ? SAMPLE_ESCALATIONS : EMPTY_ESCALATIONS;
  const analytics = isDemo ? SAMPLE_CIVIC_ANALYTICS : null;

  const filteredReports = React.useMemo(() => {
    if (activeTab === "all") return reports;
    return reports.filter((r) => r.status === activeTab);
  }, [reports, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Civic Operations Overview
            </h1>
            <Badge variant="outline" className="text-xs">
              {isDemo ? "Centralized Demo Data" : "Clean Initial State"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Greater Noida road-safety hazard command center · Live monitoring &amp; SLA resolution
            tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isDemo ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsDemo(false)}
            >
              <RotateCcw className="size-3.5" />
              <span>Clear to Empty State</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsDemo(true)}>
              <span>Preview Centralized Demo Data</span>
            </Button>
          )}

          <Button size="sm" className="shrink-0" render={<Link href="/reports/new" />}>
            <Plus className="size-3.5" />
            <span>Report Hazard</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Telemetry Grid ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Active Hazards
              </CardDescription>
              <Flame className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {isDemo ? "142" : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isDemo ? "+8 reported in the last 24h" : "No active hazards logged"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Pending Verification
              </CardDescription>
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {isDemo ? "24" : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isDemo ? "6 flagged for duplicate checks" : "Moderation queue clean"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Avg. Resolution Time
              </CardDescription>
              <TrendingDown className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {isDemo ? "4.2d" : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isDemo ? "0.6d faster than last sprint" : "SLA baseline: 7.0 days"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Resolved This Month
              </CardDescription>
              <CheckCircle2 className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {isDemo ? "89" : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isDemo ? "71% civic action success rate" : "Awaiting first closure"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Dashboard Workspace Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Recent Reports Table (8 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Hazard Submissions</CardTitle>
                  <CardDescription className="text-xs">
                    Live community records awaiting triage or authority remediation.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="open">Open</TabsTrigger>
                      <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                      <TabsTrigger value="escalated">Escalated</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <CardAction>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      render={<Link href="/dashboard/reports" />}
                    >
                      <span>Directory</span>
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </CardAction>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {reports.length === 0 ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-8 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No recent reports logged</EmptyTitle>
                    <EmptyDescription>
                      Citizen road-safety reports for Greater Noida will populate here with live
                      verification status.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" render={<Link href="/reports/new" />}>
                      <Plus className="mr-1.5 size-3.5" />
                      <span>File First Report</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsDemo(true)}>
                      Preview Demo Records
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
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
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
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
              )}
            </CardContent>

            <CardFooter className="border-t border-border px-6 py-3 bg-muted/20">
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                <span>
                  Showing {filteredReports.length} of {reports.length} reports
                </span>
                <Link
                  href="/dashboard/reports"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Go to full reports directory &rarr;
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right: Escalations, Moderation, & Breakdown (4 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Moderation Queue Alert Card */}
          <Card className="border-destructive/20 bg-destructive/5 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-destructive" />
                  <CardTitle className="text-base text-destructive">Moderation Queue</CardTitle>
                </div>
                <Badge variant="destructive" className="font-bold">
                  {isDemo ? "5 Needs Review" : "0 Pending"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {isDemo
                  ? "Potential duplicates, missing GPS tags, and out-of-scope reports awaiting triage."
                  : "All citizen submissions have been audited. No pending duplicate flags."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs"
                render={<Link href="/dashboard/moderation" />}
              >
                <span>Review Moderation Queue</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </CardFooter>
          </Card>

          {/* Active Escalations Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Authority Escalations</CardTitle>
                  <CardDescription className="text-xs">
                    Cases forwarded to official municipal bodies.
                  </CardDescription>
                </div>
                <Badge variant={escalations.length > 0 ? "secondary" : "outline"}>
                  {escalations.length} Active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col divide-y divide-border pt-0">
              {escalations.length === 0 ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-4 border-0 bg-transparent py-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 className="size-5 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-medium">No active escalations</EmptyTitle>
                    <EmptyDescription className="text-[11px]">
                      No formal grievance dockets currently open with GNIDA, PWD, or municipal
                      cells.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                escalations.map((escl) => (
                  <div key={escl.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="font-mono font-semibold">{escl.id}</span>
                      <Badge variant="outline" className="text-[10px] text-destructive">
                        {escl.daysOpen}d without action
                      </Badge>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                      {escl.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Agency: {escl.authority}
                    </p>
                  </div>
                ))
              )}
            </CardContent>

            <CardFooter className="border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
                render={<Link href="/dashboard/escalations" />}
              >
                <span>View escalation log</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </CardFooter>
          </Card>

          {/* Category Breakdown Card with shadcn Progress */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hazards by Category</CardTitle>
              <CardDescription className="text-xs">
                Distribution across recorded road infrastructure incidents.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 pt-1">
              {!analytics ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-4 border-0 bg-transparent py-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PieChart className="size-5 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm font-medium">No category breakdown</EmptyTitle>
                    <EmptyDescription className="text-[11px]">
                      Road surface, footpaths, lighting, and crossings will populate once reports
                      are submitted.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                analytics.categoryDistribution.map((cat) => (
                  <div key={cat.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{cat.label}</span>
                      <span className="font-semibold text-muted-foreground">
                        {cat.count} ({cat.pct}%)
                      </span>
                    </div>
                    <Progress value={cat.pct} className="w-full" />
                  </div>
                ))
              )}
            </CardContent>

            <CardFooter className="border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
                render={<Link href="/dashboard/analytics" />}
              >
                <span>Detailed Analytics</span>
                <ArrowUpRight className="size-3.5" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
