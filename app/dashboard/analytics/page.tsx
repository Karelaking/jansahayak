"use client";

import * as React from "react";
import {
  Download,
  MapPin,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { SAMPLE_CIVIC_ANALYTICS } from "@/lib/data";
import type { CivicAnalytics } from "@/lib/types/hazard";

export default function AnalyticsPage() {
  // Empty state by default; centralized sample data loaded on user demand
  const [analytics, setAnalytics] = React.useState<CivicAnalytics | null>(null);

  const maxFiled = analytics?.monthlyTrends
    ? Math.max(...analytics.monthlyTrends.map((d) => d.filed), 1)
    : 1;

  const handleLoadDemo = () => {
    setAnalytics(SAMPLE_CIVIC_ANALYTICS);
  };

  const handleClear = () => {
    setAnalytics(null);
  };

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
              {analytics ? "Demo Aggregation" : "Empty Telemetry"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quantifiable road hazard metrics, resolution velocities, and zone hotspot telemetry
            across Greater Noida.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {analytics ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleClear}>
              <RotateCcw className="size-3.5" />
              <span>Clear to Empty</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLoadDemo}>
              <span>Load Centralized Demo Analytics</span>
            </Button>
          )}

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
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Total Hazard Reports
              </CardDescription>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.totalReports : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {analytics ? "Since pilot launch in May 2026" : "Awaiting first citizen report"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Citizen Action Resolved
              </CardDescription>
              <CheckCircle2 className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.resolvedCount : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {analytics
                ? `${analytics.kpis.resolvedRate}% completion rate across wards`
                : "No resolved dockets yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Mean Resolution Time
              </CardDescription>
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {analytics ? `${analytics.kpis.meanResolutionDays}d` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {analytics ? "Target SLA: under 7.0 calendar days" : "Target SLA: 7.0 calendar days"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium text-muted-foreground">
                Verified Reporters
              </CardDescription>
              <Users className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.activeReporters : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {analytics ? "Active community contributors" : "Community volunteers ready"}
            </p>
          </CardContent>
        </Card>
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
                {analytics && (
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
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {!analytics ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-6 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BarChart3 className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No velocity trends collected</EmptyTitle>
                    <EmptyDescription>
                      Monthly incident velocity and resolution rates will graph automatically once
                      reports accumulate across Greater Noida sectors.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                      Load Centralized Demo Analytics
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="flex h-56 items-end gap-4 px-2">
                  {analytics.monthlyTrends.map((item) => (
                    <div
                      key={item.month}
                      className="flex flex-1 flex-col items-center gap-2 h-full justify-end"
                    >
                      <div className="flex w-full items-end justify-center gap-1.5 h-full">
                        {/* Filed Bar */}
                        <div
                          className="w-full max-w-6 rounded-t-sm bg-primary transition-all hover:opacity-85"
                          style={{ height: `${(item.filed / maxFiled) * 100}%` }}
                          title={`${item.filed} filed in ${item.month}`}
                        />
                        {/* Resolved Bar */}
                        <div
                          className="w-full max-w-6 rounded-t-sm bg-muted-foreground/30 transition-all hover:opacity-85"
                          style={{ height: `${(item.resolved / maxFiled) * 100}%` }}
                          title={`${item.resolved} resolved in ${item.month}`}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.month}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="border-t border-border px-6 py-3 bg-muted/20 text-xs text-muted-foreground">
              <span>
                {analytics
                  ? "Incidents have risen 133% as civic adoption increased across university corridors."
                  : "Trend graphs compute in 30-day rolling aggregate batches."}
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
              {!analytics ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-6 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MapPin className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No sector hotspots mapped</EmptyTitle>
                    <EmptyDescription>
                      Hazard density across Alpha, Beta, Delta, Pari Chowk, and Knowledge Park will
                      appear here.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                analytics.sectorDistribution.map((item) => (
                  <div key={item.sector} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1 text-foreground">
                        <MapPin className="size-3 text-muted-foreground" />
                        {item.sector}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {item.count} reports ({item.pct}%)
                      </span>
                    </div>
                    <Progress value={item.pct} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Category Distribution & Department SLAs (5 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Category Distribution */}
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg">Distribution by Category</CardTitle>
              <CardDescription>
                Breakdown by hazard typology across Greater Noida pilot.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 pt-4">
              {!analytics ? (
                /* Zatian / shadcn Empty State */
                <Empty className="my-6 border-0 bg-transparent">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PieChart className="size-6 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No category telemetry</EmptyTitle>
                    <EmptyDescription>
                      Typology distribution across road surface, footpaths, lighting, and crossings
                      will populate once reports are submitted.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                analytics.categoryDistribution.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground font-mono">
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                    <Progress value={item.pct} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Department SLA Compliance */}
          <Card className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-lg">Departmental SLA Health</CardTitle>
              <CardDescription>Civic responsiveness by administrative wing.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 pt-4 text-xs">
              <div className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">GNIDA Civil Maintenance</span>
                  <Badge variant={analytics ? "default" : "outline"} className="text-[11px]">
                    {analytics ? "88% on-time" : "Awaiting files"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Average response: {analytics ? "3.8 days" : "—"} (SLA limit: 7.0 days)
                </p>
              </div>

              <div className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Electrical &amp; Street Lighting
                  </span>
                  <Badge variant={analytics ? "secondary" : "outline"} className="text-[11px]">
                    {analytics ? "74% on-time" : "Awaiting files"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Average response: {analytics ? "2.1 days" : "—"} (SLA limit: 3.0 days)
                </p>
              </div>

              <div className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Noida-Gr. Noida Traffic Police
                  </span>
                  <Badge variant={analytics ? "default" : "outline"} className="text-[11px]">
                    {analytics ? "92% on-time" : "Awaiting files"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Average response: {analytics ? "1.5 days" : "—"} (SLA limit: 5.0 days)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
