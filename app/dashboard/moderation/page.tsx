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
  CheckCircle2,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { SAMPLE_MODERATION_QUEUE } from "@/lib/data";
import type { ModerationQueueItem } from "@/lib/types/hazard";

function getIcon(name: ModerationQueueItem["iconName"]) {
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
  // Empty state by default; centralized sample queue loaded on demand
  const [items, setItems] = React.useState<ModerationQueueItem[]>([]);
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

  const handleLoadDemo = () => {
    setItems(SAMPLE_MODERATION_QUEUE);
  };

  const handleClear = () => {
    setItems([]);
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
          {items.length > 0 ? (
            <Button variant="outline" size="xs" className="gap-1" onClick={handleClear}>
              <RotateCcw className="size-3" />
              <span>Clear to Empty</span>
            </Button>
          ) : (
            <Button variant="outline" size="xs" className="gap-1" onClick={handleLoadDemo}>
              <span>Load Centralized Demo Queue</span>
            </Button>
          )}

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
        </div>
      </div>

      {/* ── Cards List of Moderation Queue ─── */}
      <div className="grid grid-cols-1 gap-4">
        {items.length === 0 ? (
          /* Zatian / shadcn Empty State when queue is pristine and no data exists */
          <Card className="shadow-xs p-2">
            <Empty className="my-8 border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                </EmptyMedia>
                <EmptyTitle>Moderation queue is clean</EmptyTitle>
                <EmptyDescription>
                  There are currently no citizen hazard reports requiring duplicate consolidation,
                  geotag verification, or scope classification.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                  Load Centralized Demo Queue
                </Button>
              </EmptyContent>
            </Empty>
          </Card>
        ) : filteredItems.length === 0 ? (
          /* Empty state when active filter has all items triaged */
          <Card className="shadow-xs p-2">
            <Empty className="my-8 border-0 bg-transparent">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                </EmptyMedia>
                <EmptyTitle>All items in this category resolved</EmptyTitle>
                <EmptyDescription>
                  No pending reports remain in the &quot;{activeTab}&quot; queue. Switch filters or
                  reset the queue to inspect other entries.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("all")}>
                  View All Categories
                </Button>
                <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                  Reset Demo Queue
                </Button>
              </EmptyContent>
            </Empty>
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

                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>

                <CardTitle className="mt-2 text-base font-semibold">{item.title}</CardTitle>
                <CardDescription className="text-xs">{item.detail}</CardDescription>
              </CardHeader>

              <CardFooter className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Filed by:</span>
                  <strong className="text-foreground">{item.reporter}</strong>
                  <span>·</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:opacity-80"
                  >
                    <span>View photo evidence</span>
                    <ExternalLink className="size-2.5" />
                  </button>
                </div>

                {/* Triage Action Buttons using shadcn Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleAction(item.id, "rejected")}
                  >
                    <X className="size-3" />
                    <span>Reject Out-of-Scope</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={() => handleAction(item.id, "merged")}
                  >
                    <Copy className="size-3" />
                    <span>Merge Duplicate</span>
                  </Button>

                  <Button
                    size="xs"
                    className="gap-1 text-xs"
                    onClick={() => handleAction(item.id, "approved")}
                  >
                    <Check className="size-3" />
                    <span>Approve &amp; Route</span>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* ── Guidance Card ─── */}
      <Card className="border-dashed bg-muted/20 shadow-none">
        <CardHeader className="py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-foreground">Civic Moderation Policy:</span>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">
                JanSahayak does not censor citizen observations. Flagged items only resolve
                duplicate pings to avoid overburdening municipal engineering divisions with
                identical coordinates.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
