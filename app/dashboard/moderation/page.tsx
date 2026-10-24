"use client";

import * as React from "react";
import {
  ShieldAlert,
  Copy,
  MapPinOff,
  AlertOctagon,
  Check,
  X,
  FileQuestion,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type QueueItem = {
  id: string;
  title: string;
  type: "duplicate" | "location" | "scope";
  flagLabel: string;
  detail: string;
  reporter: string;
  time: string;
  badgeVariant: "secondary" | "destructive" | "outline";
  iconName: "copy" | "map-off" | "alert" | "question";
  status: "pending" | "approved" | "merged" | "rejected";
};

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: "R-2041",
    title: "Broken footpath near Alpha II roundabout",
    type: "duplicate",
    flagLabel: "Potential Duplicate",
    detail:
      "Matches report R-2029 filed 3 weeks ago with 92% GPS proximity and similar photo vector.",
    reporter: "Citizen (Commuter)",
    time: "2 hours ago",
    badgeVariant: "secondary",
    iconName: "copy",
    status: "pending",
  },
  {
    id: "R-2039",
    title: "Street light out — 6 consecutive poles",
    type: "location",
    flagLabel: "Unclear Location",
    detail:
      "GPS coordinates place the pin within a private commercial tech-park boundary rather than public roadway.",
    reporter: "Student (Hostel Resident)",
    time: "5 hours ago",
    badgeVariant: "destructive",
    iconName: "map-off",
    status: "pending",
  },
  {
    id: "R-2037",
    title: "Overgrown median obstructing right-turn visibility",
    type: "duplicate",
    flagLabel: "Potential Duplicate",
    detail:
      "Report R-2031 is currently marked In-Progress with GNIDA Horticulture Division for this sector.",
    reporter: "Delivery Partner",
    time: "12 hours ago",
    badgeVariant: "secondary",
    iconName: "copy",
    status: "pending",
  },
  {
    id: "R-2035",
    title: "Open manhole cover near government primary school",
    type: "duplicate",
    flagLabel: "High Urgency & Duplicate Check",
    detail:
      "Critical severity report matching existing open ticket R-2020. Needs immediate escalation consolidation.",
    reporter: "School Teacher",
    time: "1 day ago",
    badgeVariant: "destructive",
    iconName: "alert",
    status: "pending",
  },
  {
    id: "R-2034",
    title: "Encroached walkway forcing pedestrians into traffic",
    type: "location",
    flagLabel: "Missing Geotag",
    detail:
      "Manual address submitted without precise GPS coordinates. Curator verification needed on satellite layer.",
    reporter: "Local Resident",
    time: "2 days ago",
    badgeVariant: "destructive",
    iconName: "map-off",
    status: "pending",
  },
  {
    id: "R-2028",
    title: "Stray animal feeding point causing pedestrian bottleneck",
    type: "scope",
    flagLabel: "Out of Scope",
    detail:
      "Incident pertains to municipal animal control guidelines rather than physical roadway/pedestrian infrastructure.",
    reporter: "Resident Welfare Rep",
    time: "4 days ago",
    badgeVariant: "outline",
    iconName: "question",
    status: "pending",
  },
];

function getIcon(name: QueueItem["iconName"]) {
  switch (name) {
    case "copy":
      return <Copy className="size-3" />;
    case "map-off":
      return <MapPinOff className="size-3" />;
    case "alert":
      return <AlertOctagon className="size-3" />;
    case "question":
      return <FileQuestion className="size-3" />;
  }
}

export default function ModerationPage() {
  const [items, setItems] = React.useState<QueueItem[]>(INITIAL_QUEUE);
  const [activeTab, setActiveTab] = React.useState("all");

  const pendingItems = items.filter((i) => i.status === "pending");

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (item.status !== "pending") return false;
      if (activeTab === "all") return true;
      return item.type === activeTab;
    });
  }, [items, activeTab]);

  const handleAction = (id: string, action: "approved" | "merged" | "rejected") => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: action } : item)));
  };

  const handleReset = () => {
    setItems(INITIAL_QUEUE);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Moderation &amp; Verification
            </h1>
            <Badge variant="destructive" className="text-xs">
              {pendingItems.length} Pending
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit citizen submissions for accuracy, deduplication, and appropriate civic
            jurisdiction.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="all">All ({pendingItems.length})</TabsTrigger>
              <TabsTrigger value="duplicate">
                Duplicates ({pendingItems.filter((i) => i.type === "duplicate").length})
              </TabsTrigger>
              <TabsTrigger value="location">
                Location ({pendingItems.filter((i) => i.type === "location").length})
              </TabsTrigger>
              <TabsTrigger value="scope">
                Scope ({pendingItems.filter((i) => i.type === "scope").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {pendingItems.length < INITIAL_QUEUE.length && (
            <Button variant="outline" size="xs" className="gap-1" onClick={handleReset}>
              <RotateCcw className="size-3" />
              <span>Reset Demo Queue</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Cards List of Moderation Queue ─── */}
      <div className="grid grid-cols-1 gap-4">
        {filteredItems.length === 0 ? (
          <Card className="p-12 text-center shadow-xs">
            <ShieldAlert className="size-8 mx-auto text-emerald-600 mb-2" />
            <h3 className="font-heading font-semibold text-base">All Caught Up!</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              There are no pending reports requiring moderation in this category. All submitted
              hazards have been triaged.
            </p>
            {pendingItems.length < INITIAL_QUEUE.length && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={handleReset}>
                <RotateCcw className="size-3.5" />
                <span>Reload Demo Items</span>
              </Button>
            )}
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="shadow-xs transition-colors hover:border-foreground/20">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {item.id}
                    </span>
                    <Badge variant={item.badgeVariant} className="gap-1 text-xs">
                      {getIcon(item.iconName)}
                      <span>{item.flagLabel}</span>
                    </Badge>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    Filed {item.time} by {item.reporter}
                  </span>
                </div>

                <CardTitle className="text-base mt-1">{item.title}</CardTitle>
                <CardDescription className="text-sm text-foreground/80">
                  {item.detail}
                </CardDescription>
              </CardHeader>

              <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="default"
                    className="gap-1"
                    onClick={() => handleAction(item.id, "approved")}
                  >
                    <Check className="size-3" />
                    <span>Approve &amp; Publish</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => handleAction(item.id, "merged")}
                  >
                    <Copy className="size-3" />
                    <span>Merge as Duplicate</span>
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleAction(item.id, "rejected")}
                  >
                    <X className="size-3" />
                    <span>Reject</span>
                  </Button>
                </div>

                <Button
                  size="xs"
                  variant="ghost"
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <span>Inspect Evidence</span>
                  <ExternalLink className="size-3" />
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
