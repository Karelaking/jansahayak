"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Download, MapPin, Eye, FileText, RotateCcw } from "lucide-react";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { SAMPLE_HAZARDS } from "@/lib/data";
import type { HazardReport } from "@/lib/types/hazard";

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

export default function ReportsPage() {
  // Empty state by default; sample records loaded on request from centralized layer
  const [reports, setReports] = React.useState<HazardReport[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("all");
  const [selectedReport, setSelectedReport] = React.useState<HazardReport | null>(null);

  // Filtered reports
  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchesTab = activeTab === "all" || r.status === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const loc = r.location || r.landmark || "";
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [reports, activeTab, searchQuery]);

  // Handle status update inside the detail dialog
  const handleStatusChange = (newStatus: HazardReport["status"]) => {
    if (!selectedReport) return;
    setReports((prev) =>
      prev.map((r) => (r.id === selectedReport.id ? { ...r, status: newStatus } : r)),
    );
    setSelectedReport((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Hazard Reports Registry
            </h1>
            <Badge variant="secondary" className="text-xs">
              {filteredReports.length} of {reports.length}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse, search, inspect dossiers, and update civic action status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {reports.length > 0 ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReports([])}>
              <RotateCcw className="size-3.5" />
              <span>Clear to Empty</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setReports(SAMPLE_HAZARDS)}
            >
              <span>Load Centralized Demo Data</span>
            </Button>
          )}

          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button size="sm" render={<Link href="/reports/new" />}>
            <Plus className="size-3.5" />
            <span>Submit Report</span>
          </Button>
        </div>
      </div>

      {/* ── Table Card ─── */}
      <Card className="shadow-xs">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Input using shadcn Input */}
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search by title, location, category, or ID..."
                className="pl-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Filter Tabs using shadcn Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="all">All ({reports.length})</TabsTrigger>
                <TabsTrigger value="open">
                  Open ({reports.filter((r) => r.status === "open").length})
                </TabsTrigger>
                <TabsTrigger value="in-progress">
                  In Progress ({reports.filter((r) => r.status === "in-progress").length})
                </TabsTrigger>
                <TabsTrigger value="escalated">
                  Escalated ({reports.filter((r) => r.status === "escalated").length})
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved ({reports.filter((r) => r.status === "resolved").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {reports.length === 0 ? (
            /* Zatian / shadcn Empty State when no data has been submitted */
            <Empty className="my-8 border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText className="size-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>No hazard reports recorded yet</EmptyTitle>
                <EmptyDescription>
                  There are currently no active road hazard reports in the system. Citizen
                  submissions across Greater Noida corridors will populate here automatically.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" render={<Link href="/reports/new" />}>
                  <Plus className="mr-1.5 size-3.5" />
                  <span>Submit First Report</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReports(SAMPLE_HAZARDS)}>
                  Load Centralized Demo Data
                </Button>
              </EmptyContent>
            </Empty>
          ) : filteredReports.length === 0 ? (
            /* Empty state when active filter yields zero results */
            <Empty className="my-8 border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search className="size-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>No matching reports found</EmptyTitle>
                <EmptyDescription>
                  No hazard files matched your current search and status filters. Try clearing
                  keywords or changing tabs.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("all");
                  }}
                >
                  Reset Filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Docket ID</TableHead>
                  <TableHead>Hazard Details</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedReport(report)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                      {report.id}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{report.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Reported {report.time || report.reportedAt || "Recently"} ·{" "}
                        {report.votes || report.verificationsCount || 0} verifications
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {report.categoryLabel || report.category}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate max-w-[160px]">
                          {report.location || report.landmark}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell>{getStatusBadge(report.status)}</TableCell>

                    <TableCell>{getSeverityBadge(report.severity)}</TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="gap-1 text-xs"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye className="size-3" />
                        <span>Inspect</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-border px-6 py-3">
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

      {/* ── Report Detail Dialog using shadcn Dialog ─── */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        {selectedReport && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {selectedReport.id}
                </span>
                {getStatusBadge(selectedReport.status)}
                {getSeverityBadge(selectedReport.severity)}
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

              {/* Status transition controls */}
              <div className="mt-2">
                <p className="font-medium text-foreground mb-2">Update Lifecycle Status</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant={selectedReport.status === "open" ? "default" : "outline"}
                    onClick={() => handleStatusChange("open")}
                  >
                    Open
                  </Button>
                  <Button
                    size="xs"
                    variant={selectedReport.status === "in-progress" ? "default" : "outline"}
                    onClick={() => handleStatusChange("in-progress")}
                  >
                    In Progress
                  </Button>
                  <Button
                    size="xs"
                    variant={selectedReport.status === "escalated" ? "default" : "outline"}
                    onClick={() => handleStatusChange("escalated")}
                  >
                    Escalate to Authority
                  </Button>
                  <Button
                    size="xs"
                    variant={selectedReport.status === "resolved" ? "default" : "outline"}
                    onClick={() => handleStatusChange("resolved")}
                  >
                    Mark Resolved
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                Close Dossier
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
