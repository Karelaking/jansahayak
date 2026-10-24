import type { Metadata } from "next";
import { Activity, Users, CheckCircle2, Clock, MapPin, Download } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Civic Analytics — JanSahayak SafeStreets",
  description:
    "Aggregated road hazard statistics, civic response times, and geographic distribution.",
};

const KPI_METRICS = [
  {
    label: "Total Hazard Reports",
    value: "178",
    detail: "Since pilot launch in May 2026",
    icon: Activity,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Citizen Action Resolved",
    value: "89",
    detail: "50.0% completion rate across wards",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Mean Resolution Time",
    value: "4.2 days",
    detail: "Target SLA: under 7.0 calendar days",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    label: "Verified Reporters",
    value: "312",
    detail: "Active community contributors",
    icon: Users,
    color: "text-teal-600 dark:text-teal-400",
  },
];

const MONTHLY_TREND = [
  { month: "May", filed: 18, resolved: 12 },
  { month: "Jun", filed: 24, resolved: 17 },
  { month: "Jul", filed: 31, resolved: 19 },
  { month: "Aug", filed: 28, resolved: 22 },
  { month: "Sep", filed: 35, resolved: 26 },
  { month: "Oct", filed: 42, resolved: 29 },
];

const MAX_FILED = Math.max(...MONTHLY_TREND.map((d) => d.filed));

const CATEGORY_DISTRIBUTION = [
  { label: "Road Damage & Potholes", count: 47, pct: 33 },
  { label: "Broken Footpaths & Pavements", count: 31, pct: 22 },
  { label: "Street Lighting & Darkness Hazards", count: 27, pct: 19 },
  { label: "Pedestrian Crossings & Signals", count: 22, pct: 15 },
  { label: "Drainage, Barricades & Other", count: 15, pct: 11 },
];

const SECTOR_DISTRIBUTION = [
  { sector: "Alpha I & II Sectors", count: 34, pct: 19 },
  { sector: "Knowledge Park (I, II, III)", count: 28, pct: 16 },
  { sector: "Greater Noida West Corridor", count: 24, pct: 13 },
  { sector: "Sector Beta (I & II)", count: 19, pct: 11 },
  { sector: "Sector Gamma", count: 14, pct: 8 },
  { sector: "Pari Chowk Junction Zone", count: 11, pct: 6 },
  { sector: "Delta & Surajpur Industrial", count: 8, pct: 5 },
];

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Civic Safety Analytics
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Aggregation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quantifiable road hazard metrics, resolution velocities, and zone hotspot telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs defaultValue="6m">
            <TabsList className="h-8">
              <TabsTrigger value="30d">30 Days</TabsTrigger>
              <TabsTrigger value="3m">3 Months</TabsTrigger>
              <TabsTrigger value="6m">6 Months</TabsTrigger>
              <TabsTrigger value="all">Pilot All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" />
            <span>Report PDF</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_METRICS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium text-muted-foreground">
                    {kpi.label}
                  </CardDescription>
                  <Icon className={`size-4 ${kpi.color}`} />
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight">{kpi.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{kpi.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Analytics Visualizations Grid ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Monthly Trend Chart Card (7 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Monthly Incident Velocity</CardTitle>
                  <CardDescription>
                    Citizen hazard reports filed versus verified repairs resolved.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-xs bg-primary" />
                    <span>Filed</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-xs bg-muted-foreground/30" />
                    <span>Resolved</span>
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="flex h-56 items-end gap-4 px-2">
                {MONTHLY_TREND.map((item) => (
                  <div
                    key={item.month}
                    className="flex flex-1 flex-col items-center gap-2 h-full justify-end"
                  >
                    <div className="flex w-full items-end justify-center gap-1.5 h-full">
                      {/* Filed Bar */}
                      <div
                        className="w-full max-w-6 rounded-t-sm bg-primary transition-all hover:opacity-85"
                        style={{ height: `${(item.filed / MAX_FILED) * 100}%` }}
                        title={`${item.filed} filed in ${item.month}`}
                      />
                      {/* Resolved Bar */}
                      <div
                        className="w-full max-w-6 rounded-t-sm bg-muted-foreground/30 transition-all hover:opacity-85"
                        style={{ height: `${(item.resolved / MAX_FILED) * 100}%` }}
                        title={`${item.resolved} resolved in ${item.month}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{item.month}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="border-t border-border px-6 py-3 bg-muted/20 text-xs text-muted-foreground">
              <span>
                Incidents have risen 133% as civic adoption increased across university campuses.
              </span>
            </CardFooter>
          </Card>

          {/* Regional Sector Breakdown Card */}
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg">Hotspot Distribution by Sector</CardTitle>
              <CardDescription>
                Concentration of pedestrian hazards and infrastructure deficit density.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 pt-4">
              {SECTOR_DISTRIBUTION.map((item) => (
                <div key={item.sector} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium flex items-center gap-1 text-foreground">
                      <MapPin className="size-3 text-muted-foreground" />
                      {item.sector}
                    </span>
                    <span className="font-semibold text-muted-foreground">
                      {item.count} reports ({item.pct}%)
                    </span>
                  </div>
                  <Progress value={item.pct} className="w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Category Distribution & Performance (5 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg">Incident Typology</CardTitle>
              <CardDescription>
                Severity and frequency by root civic infrastructure category.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 pt-4">
              {CATEGORY_DISTRIBUTION.map((cat) => (
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

            <CardFooter className="border-t border-border px-6 py-3 bg-muted/20 text-xs text-muted-foreground">
              <span>Potholes and broken walkways account for 55% of all active complaints.</span>
            </CardFooter>
          </Card>

          {/* Resolution SLA Card */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">SLA Response Performance</CardTitle>
              <CardDescription className="text-xs">
                Time elapsed from initial citizen post to official agency repair.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-xs">
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Verification &amp; Triage</span>
                <span className="font-semibold text-foreground">Under 4.5 hours</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Department Forwarding</span>
                <span className="font-semibold text-foreground">Within 24 hours</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Physical Remediation</span>
                <span className="font-semibold text-foreground">4.2 days average</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
