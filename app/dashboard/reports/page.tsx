"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Download, MapPin, Eye } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";

type Report = {
  id: string;
  title: string;
  category: string;
  location: string;
  status: "open" | "in-progress" | "escalated" | "resolved";
  severity: "high" | "medium" | "low";
  time: string;
  votes: number;
  coordinates: string;
  description: string;
  authority: string;
};

const INITIAL_REPORTS: Report[] = [
  {
    id: "R-2041",
    title: "Broken footpath near Alpha II roundabout",
    category: "Footpath Defect",
    location: "Alpha II, Greater Noida",
    status: "open",
    severity: "high",
    time: "2h ago",
    votes: 14,
    coordinates: "28.4744° N, 77.5040° E",
    description:
      "Deep collapse of concrete slabs on the pedestrian pathway forcing morning school walkers and seniors onto the busy vehicular carriageway.",
    authority: "GNIDA Maintenance Division III",
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
    coordinates: "28.5933° N, 77.4278° E",
    description:
      "Craters measuring roughly 1.5m diameter and 12cm depth directly after the roundabout. Two-wheelers frequently swerve into oncoming traffic.",
    authority: "GNIDA PWD Roads Wing",
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
    coordinates: "28.4619° N, 77.4952° E",
    description:
      "Complete blackout along 350 meters of student hostel walkway. Poses severe personal safety hazards after 7 PM.",
    authority: "Electrical Engineering Dept, GNIDA",
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
    coordinates: "28.4674° N, 77.5140° E",
    description:
      "Vehicles speed through the pelican light phase while commuters exit Gate 2. Lack of speed breaker or active traffic marshal.",
    authority: "Traffic Police Directorate & GNIDA",
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
    coordinates: "28.4820° N, 77.5132° E",
    description:
      "Hedge vegetation has grown over 1.8 meters high at the intersection, completely blinding drivers turning right onto the main avenue.",
    authority: "GNIDA Horticulture Wing",
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
    coordinates: "28.4901° N, 77.5305° E",
    description: "Fallen iron barricades lying across the cycling lane without reflective signage.",
    authority: "Civil Contractors Wing",
  },
  {
    id: "R-2035",
    title: "Open manhole cover near government primary school",
    category: "Road Damage",
    location: "Knowledge Park II",
    status: "open",
    severity: "high",
    time: "1d ago",
    votes: 18,
    coordinates: "28.4590° N, 77.4910° E",
    description:
      "Heavy iron chamber lid removed or stolen. Covered temporarily with loose branches by locals.",
    authority: "Municipal Drainage & Sewerage Board",
  },
  {
    id: "R-2034",
    title: "Encroached walkway forcing pedestrians into traffic",
    category: "Footpath Defect",
    location: "Sector Gamma II",
    status: "open",
    severity: "medium",
    time: "2d ago",
    votes: 6,
    coordinates: "28.4895° N, 77.5020° E",
    description:
      "Commercial building material stored permanently on the designated public sidewalk.",
    authority: "GNIDA Enforcement Cell",
  },
  {
    id: "R-2033",
    title: "Faded zebra crossing marks near bus terminal",
    category: "Crossing Safety",
    location: "Greater Noida West",
    status: "in-progress",
    severity: "medium",
    time: "2d ago",
    votes: 11,
    coordinates: "28.6012° N, 77.4410° E",
    description:
      "Thermal markings worn away over monsoon. Vehicles refuse to yield to waiting bus commuters.",
    authority: "GNIDA Traffic Dept.",
  },
  {
    id: "R-2032",
    title: "Exposed utility cabling beside school footpath",
    category: "Electrical Hazard",
    location: "Sector Alpha I",
    status: "escalated",
    severity: "high",
    time: "3d ago",
    votes: 27,
    coordinates: "28.4790° N, 77.5080° E",
    description:
      "Underground cable joint box left uncovered in rain puddle near residential apartment gate.",
    authority: "NPCL (Noida Power Company Limited)",
  },
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

export default function ReportsPage() {
  const [reports, setReports] = React.useState<Report[]>(INITIAL_REPORTS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("all");
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);

  // Filtered reports
  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      const matchesTab = activeTab === "all" || r.status === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [reports, activeTab, searchQuery]);

  // Handle status update inside the detail dialog
  const handleStatusChange = (newStatus: Report["status"]) => {
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">ID</TableHead>
                <TableHead>Hazard &amp; Location</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Upvotes</TableHead>
                <TableHead className="text-right">Filed</TableHead>
                <TableHead className="text-right w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No reports match your current search or status filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer transition-colors"
                    onClick={() => setSelectedReport(report)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                      {report.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 max-w-md">
                        <span className="font-medium text-foreground text-sm line-clamp-1">
                          {report.title}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3" />
                          {report.location}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {report.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-right font-medium text-xs">{report.votes}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {report.time}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`View dossier for ${report.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(report);
                        }}
                      >
                        <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        <CardFooter className="border-t border-border px-6 py-3 bg-muted/20">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <span>
              Showing {filteredReports.length} of {reports.length} reports
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="xs" disabled>
                Previous
              </Button>
              <Button variant="outline" size="xs" disabled>
                Next
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* ── Report Detail Dialog (shadcn Dialog) ─── */}
      <Dialog
        open={Boolean(selectedReport)}
        onOpenChange={(open) => !open && setSelectedReport(null)}
      >
        <DialogContent className="sm:max-w-md">
          {selectedReport && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {selectedReport.id}
                    </span>
                    {getStatusBadge(selectedReport.status)}
                  </div>
                  {getSeverityBadge(selectedReport.severity)}
                </div>

                <DialogTitle className="text-base font-bold mt-2">
                  {selectedReport.title}
                </DialogTitle>
                <DialogDescription className="text-xs flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-3 text-muted-foreground" />
                  {selectedReport.location} &middot; {selectedReport.coordinates}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3 py-2 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Detailed Description:</span>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {selectedReport.description}
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Responsible Authority</span>
                    <p className="font-medium text-foreground">{selectedReport.authority}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Citizen Verification Upvotes</span>
                    <p className="font-medium text-foreground">
                      {selectedReport.votes} verified commuters
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <span className="font-semibold text-foreground">Change Operational Status:</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
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
                      Escalated
                    </Button>
                    <Button
                      size="xs"
                      variant={selectedReport.status === "resolved" ? "default" : "outline"}
                      onClick={() => handleStatusChange("resolved")}
                    >
                      Resolved
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter showCloseButton />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
