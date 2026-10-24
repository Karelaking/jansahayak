import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Dashboard Overview — JanSahayak SafeStreets",
  description: "Manage hazard reports, moderation queue, escalations, and civic analytics.",
};

// ── Illustrative data layer ──────────────────────────────────────────────────

const KPI_STATS = [
  {
    title: "Active Hazards",
    value: "142",
    description: "+8 reported in the last 24h",
    trend: "up",
    icon: Flame,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Pending Verification",
    value: "24",
    description: "6 flagged for duplicate checks",
    trend: "neutral",
    icon: Clock,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Avg. Resolution Time",
    value: "4.2d",
    description: "0.6d faster than last sprint",
    trend: "down-good",
    icon: TrendingDown,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Resolved This Month",
    value: "89",
    description: "71% civic action success rate",
    trend: "up",
    icon: CheckCircle2,
    color: "text-teal-600 dark:text-teal-400",
  },
];

const RECENT_REPORTS = [
  {
    id: "R-2041",
    title: "Broken footpath near Alpha II roundabout",
    category: "Footpath Defect",
    location: "Alpha II, Greater Noida",
    status: "open",
    severity: "high",
    time: "2h ago",
    votes: 14,
  },
  {
    id: "R-2040",
    title: "Pothole on Gaur City road causing near-misses",
    category: "Road Damage",
    location: "Gaur City 1, Noida Ext.",
    status: "in-progress",
    severity: "high",
    time: "3h ago",
    votes: 22,
  },
  {
    id: "R-2039",
    title: "Street light out — 6 consecutive poles",
    category: "Dark Spot",
    location: "Knowledge Park III",
    status: "open",
    severity: "medium",
    time: "5h ago",
    votes: 9,
  },
  {
    id: "R-2038",
    title: "Unsafe pedestrian crossing at metro exit",
    category: "Crossing Safety",
    location: "Pari Chowk Metro",
    status: "escalated",
    severity: "high",
    time: "7h ago",
    votes: 31,
  },
  {
    id: "R-2037",
    title: "Overgrown median obstructing right-turn visibility",
    category: "Blind Corner",
    location: "Sector Beta I",
    status: "open",
    severity: "low",
    time: "12h ago",
    votes: 4,
  },
  {
    id: "R-2036",
    title: "Loose barricades left after road construction",
    category: "Road Obstruction",
    location: "Delta II, Block C",
    status: "resolved",
    severity: "medium",
    time: "1d ago",
    votes: 7,
  },
];

const ESCALATIONS = [
  {
    id: "E-019",
    title: "Pari Chowk crossing — pedestrian incident risk",
    authority: "GNIDA Traffic Dept.",
    daysOpen: 12,
  },
  {
    id: "E-018",
    title: "Alpha I pothole cluster — repeated reports",
    authority: "GNIDA PWD",
    daysOpen: 21,
  },
  {
    id: "E-017",
    title: "Damaged drainage cover — monsoon hazard",
    authority: "Greater Noida Municipality",
    daysOpen: 8,
  },
];

const CATEGORY_BREAKDOWN = [
  { label: "Road Damage & Potholes", count: 47, pct: 33 },
  { label: "Broken Footpaths", count: 31, pct: 22 },
  { label: "Street Lighting Outages", count: 27, pct: 19 },
  { label: "Unsafe Crossings", count: 22, pct: 15 },
  { label: "Traffic Signal Failures", count: 15, pct: 11 },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "open":
      return <Badge variant="destructive">Open</Badge>;
    case "in-progress":
      return <Badge variant="secondary">In Progress</Badge>;
    case "escalated":
      return <Badge variant="default">Escalated</Badge>;
    case "resolved":
      return <Badge variant="outline">Resolved</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "high":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
          <span className="size-1.5 rounded-full bg-destructive" />
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          Low
        </span>
      );
  }
}

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Civic Operations Overview
            </h1>
            <Badge variant="outline" className="text-xs">
              Pilot
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Greater Noida Municipal Division &middot; Live status, verification queue, and citizen
            tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" render={<Link href="/dashboard/map" />}>
            <MapPin className="size-3.5" />
            <span>Interactive Map</span>
          </Button>
          <Button size="sm" render={<Link href="/reports/new" />}>
            <Plus className="size-3.5" />
            <span>File New Report</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Stat Strip via shadcn Card ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium text-muted-foreground">
                    {stat.title}
                  </CardDescription>
                  <Icon className={`size-4 ${stat.color}`} />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Main Two-Column Content Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Reports Table Card (8 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Road Safety Reports</CardTitle>
                  <CardDescription>
                    Incoming citizen hazards filtered by triage priority and status.
                  </CardDescription>
                </div>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    render={<Link href="/dashboard/reports" />}
                  >
                    <span>View all</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </CardAction>
              </div>

              {/* Filtering with shadcn Tabs */}
              <div className="pt-2">
                <Tabs defaultValue="all">
                  <TabsList className="h-8">
                    <TabsTrigger value="all">All (24)</TabsTrigger>
                    <TabsTrigger value="open">Open (14)</TabsTrigger>
                    <TabsTrigger value="in-progress">In Progress (6)</TabsTrigger>
                    <TabsTrigger value="escalated">Escalated (4)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-25">ID</TableHead>
                    <TableHead>Hazard & Location</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Upvotes</TableHead>
                    <TableHead className="text-right">Filed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RECENT_REPORTS.map((report) => (
                    <TableRow key={report.id}>
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
                            {report.location}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {report.votes}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {report.time}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>

            <CardFooter className="border-t border-border px-6 py-3 bg-muted/20">
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                <span>Showing 6 of 24 active reports</span>
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
                  6 Needs Review
                </Badge>
              </div>
              <CardDescription className="text-xs">
                3 potential duplicates, 2 missing GPS tags, and 1 out-of-scope report awaiting
                curator review.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs"
                render={<Link href="/dashboard/moderation" />}
              >
                <span>Review Pending Items</span>
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
                <Badge variant="secondary">3 Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border pt-0">
              {ESCALATIONS.map((escl) => (
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
              ))}
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
              {CATEGORY_BREAKDOWN.map((cat) => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{cat.label}</span>
                    <span className="font-semibold text-muted-foreground">
                      {cat.count} ({cat.pct}%)
                    </span>
                  </div>
                  <Progress value={cat.pct} className="w-full" />
                </div>
              ))}
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
