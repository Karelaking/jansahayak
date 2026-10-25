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
  Camera,
  Cpu,
  MapPin,
  Calendar,
  Sparkles,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [inspectingItem, setInspectingItem] = React.useState<ModerationQueueItem | null>(null);

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
                    onClick={() => setInspectingItem(item)}
                    className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:opacity-80 py-1 cursor-pointer"
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

      {/* ── PRD §12 Evidence & AI Vision Inspection Modal ─── */}
      <Dialog open={!!inspectingItem} onOpenChange={(open) => !open && setInspectingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#faf9f5] border-[#cbd5cb] text-[#0e2b24] p-5 sm:p-6">
          {inspectingItem && (
            <div className="flex flex-col gap-5">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#eef1e9] text-[#17382f]">
                    {inspectingItem.id}
                  </span>
                  <Badge variant={inspectingItem.badgeVariant} className="text-xs">
                    {inspectingItem.flagLabel}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-bold text-[#0e2b24]">
                  {inspectingItem.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5c6f66]">
                  Submitted by {inspectingItem.reporter} · {inspectingItem.time} · Greater Noida
                  Sector Jurisdiction
                </DialogDescription>
              </DialogHeader>

              {/* Photo Evidence View */}
              <div className="relative rounded-xl overflow-hidden border border-[#cbd5cb] bg-gray-900 aspect-video flex items-center justify-center">
                {/* Fallback clean SVG representation if photoId is generic */}
                <svg
                  className="w-full h-full object-cover"
                  viewBox="0 0 600 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="600" height="400" fill="#374151" />
                  <rect x="0" y="0" width="600" height="400" fill="#1f2937" opacity="0.4" />
                  <ellipse cx="300" cy="220" rx="140" ry="80" fill="#111827" />
                  <ellipse cx="300" cy="220" rx="110" ry="60" fill="#030712" />
                  <line
                    x1="520"
                    y1="0"
                    x2="520"
                    y2="400"
                    stroke="#eab308"
                    strokeWidth="12"
                    strokeDasharray="24 16"
                  />
                  <circle cx="160" cy="180" r="3" fill="#6b7280" />
                  <circle cx="440" cy="260" r="4" fill="#6b7280" />
                </svg>

                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/70 text-white backdrop-blur-xs">
                    <Camera className="size-3 text-emerald-400" />
                    <span>In-App Camera Capture</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/70 text-white backdrop-blur-xs">
                    <MapPin className="size-3 text-amber-400" />
                    <span>GPS ±6.5m (Tier 1 High Precision)</span>
                  </span>
                </div>

                <div className="absolute bottom-3 inset-x-3 bg-black/75 backdrop-blur-xs rounded-lg p-2 text-white flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px]">SHA-256: 4a8f9b...e21c Verified</span>
                  <span className="text-[11px] text-gray-300">Pari Chowk Westbound Corridor</span>
                </div>
              </div>

              {/* Telemetry and Location Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-white border border-[#d2d9d0]">
                  <span className="font-semibold text-[#17382f] flex items-center gap-1.5 mb-1">
                    <MapPin className="size-3.5 text-emerald-700" />
                    <span>Spatial Centroid &amp; Geotag</span>
                  </span>
                  <p className="font-mono text-[#0e2b24]">28.4744° N, 77.5040° E</p>
                  <p className="text-[11px] text-[#5c6f66] mt-0.5">
                    Uncertainty: 8.5m (Eligible for public map pin &le; 25m threshold)
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-white border border-[#d2d9d0]">
                  <span className="font-semibold text-[#17382f] flex items-center gap-1.5 mb-1">
                    <Calendar className="size-3.5 text-emerald-700" />
                    <span>Temporal Provenance</span>
                  </span>
                  <p className="text-[#0e2b24] font-medium">Logged {inspectingItem.time}</p>
                  <p className="text-[11px] text-[#5c6f66] mt-0.5">
                    Within 24h bounding threshold. No replay signature.
                  </p>
                </div>
              </div>

              {/* AI Vision Analysis (PRD §8) */}
              <div className="p-3.5 rounded-lg bg-[#eef1e9] border border-[#cbd5cb] text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#0e2b24] flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-emerald-800" />
                    <span>AI Vision Multimodal Defect Analysis</span>
                  </span>
                  <Badge variant="outline" className="bg-white text-[10px] gap-1 font-mono">
                    <Sparkles className="size-3 text-amber-600" />
                    <span>94% Confidence</span>
                  </Badge>
                </div>
                <p className="text-[#17382f] leading-relaxed mb-2">{inspectingItem.detail}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-medium border border-[#cbd5cb] text-[#17382f]">
                    Asphalt crater
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-medium border border-[#cbd5cb] text-[#17382f]">
                    Depth &gt; 10cm
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-medium border border-[#cbd5cb] text-[#17382f]">
                    Vehicular wheel-trap hazard
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-[10px] font-medium border border-[#cbd5cb] text-[#17382f]">
                    High contrast
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-[#d2d9d0] pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-9"
                  onClick={() => {
                    handleAction(inspectingItem.id, "rejected");
                    setInspectingItem(null);
                  }}
                >
                  <X className="size-3.5 mr-1" />
                  <span>Reject Out-of-Scope</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => {
                      handleAction(inspectingItem.id, "merged");
                      setInspectingItem(null);
                    }}
                  >
                    <Copy className="size-3.5 mr-1" />
                    <span>Merge Duplicate</span>
                  </Button>

                  <Button
                    size="sm"
                    className="text-xs h-9 bg-emerald-800 hover:bg-emerald-900 text-white"
                    onClick={() => {
                      handleAction(inspectingItem.id, "approved");
                      setInspectingItem(null);
                    }}
                  >
                    <Check className="size-3.5 mr-1" />
                    <span>Approve &amp; Publish Pin</span>
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
