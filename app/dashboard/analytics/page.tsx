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
import { BarChart } from "@/components/charts/bar-chart";

export default function AnalyticsPage() {
  // Empty state by default; centralized sample data loaded on user demand
  const [analytics, setAnalytics] = React.useState<CivicAnalytics | null>(null);

  const chartData =
    analytics?.monthlyTrends.map((d) => ({
      month: d.month,
      Filed: d.filed,
      Resolved: d.resolved,
    })) || [];

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
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
              Civic Safety Analytics
            </h1>
            <Badge variant="outline" className="text-xs">
              {analytics ? "Demo Aggregation" : "Empty Telemetry"}
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Quantifiable road hazard metrics, resolution velocities, and zone hotspot telemetry
            across Greater Noida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {analytics ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 sm:h-8"
              onClick={handleClear}
            >
              <RotateCcw className="size-3.5" />
              <span>Clear</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 sm:h-8"
              onClick={handleLoadDemo}
            >
              <span>Load Demo Analytics</span>
            </Button>
          )}

          <div className="overflow-x-auto no-scrollbar">
            <Tabs defaultValue="6m">
              <TabsList className="h-9 sm:h-8">
                <TabsTrigger value="30d" className="text-xs px-2.5">
                  30D
                </TabsTrigger>
                <TabsTrigger value="3m" className="text-xs px-2.5">
                  3M
                </TabsTrigger>
                <TabsTrigger value="6m" className="text-xs px-2.5">
                  6M
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs px-2.5">
                  All
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5 h-9 sm:h-8">
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Report PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards (Compact 2x2 Grid on Mobile) ─── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Card className="shadow-xs p-3.5 sm:p-5">
          <CardHeader className="p-0 pb-1.5">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">
                Total Hazards
              </CardDescription>
              <Activity className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.totalReports : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {analytics ? "Since May 2026 pilot" : "Awaiting first report"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs p-3.5 sm:p-5">
          <CardHeader className="p-0 pb-1.5">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">
                Resolved Action
              </CardDescription>
              <CheckCircle2 className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.resolvedCount : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {analytics
                ? `${analytics.kpis.resolvedRate}% completion rate`
                : "No dockets resolved"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs p-3.5 sm:p-5">
          <CardHeader className="p-0 pb-1.5">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">
                Mean SLA Time
              </CardDescription>
              <Clock className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              {analytics ? `${analytics.kpis.meanResolutionDays}d` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {analytics ? "SLA: <7.0 days" : "Target: 7.0 days"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs p-3.5 sm:p-5">
          <CardHeader className="p-0 pb-1.5">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">
                Reporters
              </CardDescription>
              <Users className="size-3.5 sm:size-4 text-muted-foreground shrink-0" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
              {analytics ? analytics.kpis.activeReporters : "0"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {analytics ? "Active contributors" : "Volunteers ready"}
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
                <BarChart data={chartData} categories={["Filed", "Resolved"]} index="month" />
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
