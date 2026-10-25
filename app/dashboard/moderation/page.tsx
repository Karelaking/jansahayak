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
  // Empty state by default; centralized sample queue loaded on demand or fetched from API
  const [items, setItems] = React.useState<ModerationQueueItem[]>([]);
  const [activeTab, setActiveTab] = React.useState("all");
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);

  // Fetch live review queue on mount
  React.useEffect(() => {
    let active = true;
    async function loadReviewQueue() {
      try {
        const res = await fetch("/api/admin/review-queue");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success && Array.isArray(data.items) && data.items.length > 0) {
          // If items are raw database incidents, map them to ModerationQueueItem format
          const mapped: ModerationQueueItem[] = data.items.map((rawRow: unknown) => {
            const row = rawRow as Record<string, unknown>;
            if (row.flagLabel) return row as unknown as ModerationQueueItem; // already mapped/seed
            const meta = (row.metadata as Record<string, unknown>) || {};
            return {
              id: String(row.id || ""),
              title: String(row.title || "Hazard Incident"),
              type:
                row.category === "lighting" || row.category === "crossing"
                  ? "location"
                  : "duplicate",
              flagLabel: row.status === "under_review" ? "Awaiting Review" : "Unverified Incident",
              detail: String(
                row.summary || "Citizen submitted hazard awaiting municipal verification.",
              ),
              reporter: String(meta.reporter || "Verified Citizen"),
              time: row.createdAt
                ? new Date(String(row.createdAt)).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Recently",
              badgeVariant: "secondary",
              iconName: "alert",
              status: "pending",
            };
          });
          setItems(mapped);
        }
      } catch (err) {
        console.warn("Could not fetch live review queue, offline mode active:", err);
      }
    }
    loadReviewQueue();
    return () => {
      active = false;
    };
  }, []);

  const pendingItems = items.filter((i) => i.status === "pending");

  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (item.status !== "pending") return false;
      if (activeTab === "all") return true;
      return item.type === activeTab;
    });
  }, [items, activeTab]);

  const handleAction = async (id: string, action: "approved" | "merged" | "rejected") => {
    setIsSubmitting(id);
    // Optimistic update
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: action } : item)));

    try {
      const decision =
        action === "approved" ? "approve" : action === "rejected" ? "reject" : "approve";
      await fetch("/api/pipeline/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: id,
          decision,
          reason: `Audited and marked ${action} by civic staff`,
        }),
      });
    } catch (e) {
      console.warn("Failed to submit moderation decision to backend:", e);
    } finally {
      setIsSubmitting(null);
    }
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
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
              Moderation &amp; Verification
            </h1>
            <Badge variant="destructive" className="text-xs">
              {pendingItems.length} Pending
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Audit citizen submissions for accuracy, deduplication, and appropriate civic
            jurisdiction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 ? (
            <Button variant="outline" size="sm" className="gap-1 h-9 sm:h-8" onClick={handleClear}>
              <RotateCcw className="size-3" />
              <span>Clear</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-9 sm:h-8"
              onClick={handleLoadDemo}
            >
              <span>Load Demo Queue</span>
            </Button>
          )}

          <div className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 sm:w-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-9 sm:h-8 w-max min-w-full justify-start sm:w-auto">
                <TabsTrigger value="all" className="text-xs px-2.5">
                  All ({pendingItems.length})
                </TabsTrigger>
                <TabsTrigger value="duplicate" className="text-xs px-2.5">
                  Duplicates ({pendingItems.filter((i) => i.type === "duplicate").length})
                </TabsTrigger>
                <TabsTrigger value="location" className="text-xs px-2.5">
                  Location ({pendingItems.filter((i) => i.type === "location").length})
                </TabsTrigger>
                <TabsTrigger value="scope" className="text-xs px-2.5">
                  Scope ({pendingItems.filter((i) => i.type === "scope").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
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
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Filed by:</span>
                  <strong className="text-foreground">{item.reporter}</strong>
                  <span>·</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:opacity-80 py-1"
                  >
                    <span>View photo evidence</span>
                    <ExternalLink className="size-2.5" />
                  </button>
                </div>

                {/* Triage Action Buttons - Responsive thumb-friendly grid on mobile */}
                <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting === item.id}
                    className="h-10 sm:h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive justify-center"
                    onClick={() => handleAction(item.id, "rejected")}
                  >
                    <X className="size-3.5 mr-1" />
                    <span>Reject Out-of-Scope</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting === item.id}
                    className="h-10 sm:h-7 text-xs justify-center"
                    onClick={() => handleAction(item.id, "merged")}
                  >
                    <Copy className="size-3.5 mr-1" />
                    <span>Merge Duplicate</span>
                  </Button>

                  <Button
                    size="sm"
                    disabled={isSubmitting === item.id}
                    className="h-10 sm:h-7 text-xs justify-center bg-emerald-800 hover:bg-emerald-900 text-white"
                    onClick={() => handleAction(item.id, "approved")}
                  >
                    <Check className="size-3.5 mr-1" />
                    <span>{isSubmitting === item.id ? "Publishing..." : "Approve & Route"}</span>
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
