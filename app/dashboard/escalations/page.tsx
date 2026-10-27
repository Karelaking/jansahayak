"use client";

import * as React from "react";
import {
  Building2,
  Clock,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { RoleGuard } from "@/components/auth/role-guard";
import type { EscalationDocket } from "@/lib/types/hazard";

export default function EscalationsPage() {
  const [escalations, setEscalations] = React.useState<EscalationDocket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeModalId, setActiveModalId] = React.useState<string | null>(null);
  const [officialNote, setOfficialNote] = React.useState("");
  const [isUpdatingId, setIsUpdatingId] = React.useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = React.useState(false);

  const fetchEscalations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/escalations");
      if (!res.ok) throw new Error("Failed to fetch escalations");
      const data = await res.json();
      if (Array.isArray(data.escalations)) {
        setEscalations(data.escalations);
      }
    } catch (err) {
      console.error("Error loading escalations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const activeEscalation = escalations.find((e) => e.id === activeModalId);

  const handleUpdateStatus = async (
    id: string,
    newStatus: EscalationDocket["status"],
    isEmergencyOverride?: boolean,
    overrideReason?: string,
  ) => {
    setIsUpdatingId(id);
    try {
      // 1. Optimistic UI update
      setEscalations((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          let statusLabel = "In Progress";
          let statusVariant: EscalationDocket["statusVariant"] = "default";
          if (newStatus === "acknowledged") {
            statusLabel = "Acknowledged by Dept";
            statusVariant = "secondary";
          } else if (newStatus === "resolved") {
            statusLabel = isEmergencyOverride
              ? "Remediation Complete (Override)"
              : "Under Repair (Awaiting Citizen Consensus)";
            statusVariant = isEmergencyOverride ? "default" : "secondary";
          } else if (newStatus === "awaiting-response") {
            statusLabel = "Awaiting Response";
            statusVariant = "destructive";
          }

          return {
            ...e,
            status: newStatus,
            statusLabel,
            statusVariant,
            lastUpdate: `Just now — Status shifted to ${statusLabel}`,
          };
        }),
      );

      // 2. Persist to PostgreSQL backend & moderation audit trail
      const res = await fetch("/api/admin/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: id,
          status: newStatus,
          isEmergencyOverride,
          overrideReason,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Failed to persist status change to PostgreSQL.");
      }

      await fetchEscalations();
    } catch (err) {
      console.error("Error updating escalation status:", err);
      await fetchEscalations();
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleSaveNote = async () => {
    if (!activeModalId || !officialNote.trim()) return;
    setIsSavingNote(true);

    try {
      const noteContent = officialNote.trim();

      // 1. Optimistic UI update
      setEscalations((prev) =>
        prev.map((e) =>
          e.id === activeModalId
            ? {
                ...e,
                lastUpdate: `Just now — Official Note: ${noteContent}`,
              }
            : e,
        ),
      );

      // 2. Persist to PostgreSQL backend & moderation audit trail
      await fetch("/api/admin/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: activeModalId,
          officialNote: noteContent,
        }),
      });

      setOfficialNote("");
      setActiveModalId(null);
    } catch (err) {
      console.error("Error saving official note:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["moderator", "admin", "field_official"]}>
      <div className="flex flex-col gap-6">
        {/* ── Page Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#0e2b24]">
                Authority Escalation Tracker
              </h1>
              <Badge
                variant="outline"
                className="bg-[#f4e8be] text-[#7a540b] border-[#cbd5cb] text-xs font-medium"
              >
                {escalations.length} Active Dockets
              </Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#5c6f66]">
              Auditable trail of hazard files escalated to responsible municipal authorities and
              elected ward reps.
            </p>
          </div>
        </div>

        {/* ── Escalation Dockets List ─── */}
        <div className="grid grid-cols-1 gap-5">
          {loading ? (
            <Card className="shadow-xs p-8 flex items-center justify-center border-[#cbd5cb] bg-[#faf9f5]">
              <div className="flex items-center gap-2 text-xs text-[#5c6f66]">
                <Loader2 className="size-4 animate-spin text-[#0e2b24]" />
                <span>Loading municipal escalation dockets...</span>
              </div>
            </Card>
          ) : escalations.length === 0 ? (
            /* Zatian / shadcn Empty State when no dockets exist */
            <Card className="shadow-xs p-2 border-[#cbd5cb] bg-[#faf9f5]">
              <Empty className="my-8 border-0 bg-transparent">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2 className="size-6 text-[#486057]" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-semibold text-[#0e2b24]">
                    No active authority escalations
                  </EmptyTitle>
                  <EmptyDescription className="text-xs text-[#5c6f66]">
                    There are currently no formal grievance dockets open with GNIDA, PWD, or
                    Municipal Drainage cells. Unresolved community hazards will trigger automated
                    docket creation after SLA expiry.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          ) : (
            escalations.map((item) => (
              <Card key={item.id} className="shadow-xs border-[#cbd5cb] bg-[#faf9f5]">
                <CardHeader className="border-b border-[#cbd5cb] pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#17382f]">
                          {item.id}
                        </span>
                        <Badge variant={item.statusVariant} className="text-xs font-medium">
                          {item.statusLabel}
                        </Badge>
                        <span className="text-xs text-[#5c6f66]">
                          Linked:{" "}
                          <strong className="text-[#17382f] font-semibold">
                            {item.originReportId}
                          </strong>{" "}
                          (+{item.linkedReports} reports)
                        </span>
                      </div>

                      <CardTitle className="text-base font-semibold text-[#0e2b24]">
                        {item.title}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#5c6f66]">
                      <Clock className="size-3.5 text-[#5c6f66]" />
                      <span>Open for {item.daysOpen} days</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {(item.publicOpinionStatus === "reopened_by_community" ||
                    item.publicOpinionStatus === "public_disputed" ||
                    item.statusVariant === "destructive") &&
                    item.unresolvedVotesCount !== undefined &&
                    item.unresolvedVotesCount > 0 && (
                      <div className="rounded-md border border-[#e4876f] bg-[#f3d9cf]/40 p-3 text-xs text-[#8c2e1b] flex items-start gap-2.5 shadow-2xs">
                        <AlertTriangle className="size-4 text-[#8c2e1b] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="font-semibold block text-[#8c2e1b]">
                            Active Citizen Dispute: Contractor Repair Rejected
                          </strong>
                          <span className="text-[#8c2e1b]">
                            {item.unresolvedVotesCount} local residents verified that this defect
                            persists. Remediation has been automatically reopened in municipal
                            queues per PRD §14B.
                          </span>
                        </div>
                      </div>
                    )}

                  <p className="text-xs text-[#17382f] leading-relaxed">{item.summary}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 rounded-md bg-[#f5f3ed] border border-[#cbd5cb] p-2.5">
                      <Building2 className="size-4 text-[#486057] shrink-0" />
                      <div>
                        <span className="text-[#5c6f66] block text-[11px]">Forwarded To</span>
                        <strong className="text-[#0e2b24] font-semibold">{item.authority}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-md bg-[#f5f3ed] border border-[#cbd5cb] p-2.5">
                      <MessageSquare className="size-4 text-[#486057] shrink-0" />
                      <div>
                        <span className="text-[#5c6f66] block text-[11px]">Assigned Officer</span>
                        <strong className="text-[#0e2b24] font-semibold">{item.officer}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#cbd5cb] p-3 text-xs bg-[#f5f3ed]/60">
                    <span className="font-medium text-[#0e2b24] block mb-0.5">
                      Latest Timeline Milestone
                    </span>
                    <span className="text-[#486057]">{item.lastUpdate}</span>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t border-[#cbd5cb] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <a
                    href={`/api/admin/incidents/${encodeURIComponent(item.id)}/dossier`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#0e2b24] hover:underline py-1 self-start font-medium"
                  >
                    <span>View Official Printable Docket</span>
                    <ExternalLink className="size-3" />
                  </a>

                  {/* Action Buttons - Responsive thumb-friendly grid on mobile */}
                  <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 sm:h-7 text-xs justify-center border-[#cbd5cb] bg-white text-[#17382f] hover:bg-[#e9efe8]"
                      onClick={() => setActiveModalId(item.id)}
                    >
                      <MessageSquare className="size-3.5 mr-1 text-[#5c6f66]" />
                      <span>Log Officer Reply</span>
                    </Button>

                    {item.status !== "resolved" ? (
                      <Button
                        size="sm"
                        disabled={isUpdatingId === item.id}
                        className="h-10 sm:h-7 text-xs justify-center bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] font-medium"
                        onClick={() => handleUpdateStatus(item.id, "resolved")}
                      >
                        {isUpdatingId === item.id ? (
                          <Loader2 className="size-3.5 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5 mr-1" />
                        )}
                        <span>
                          {item.consensusPercentage !== undefined &&
                          item.consensusPercentage >= 75 &&
                          (item.resolutionVotesCount || 0) >= 3
                            ? "Close (Consensus Met)"
                            : "Mark Repaired (Citizen Verification)"}
                        </span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdatingId === item.id}
                        className="h-10 sm:h-7 text-xs justify-center border-[#cbd5cb] bg-white text-[#17382f] hover:bg-[#e9efe8]"
                        onClick={() => handleUpdateStatus(item.id, "in-progress")}
                      >
                        {isUpdatingId === item.id ? (
                          <Loader2 className="size-3.5 mr-1 animate-spin" />
                        ) : null}
                        <span>Re-open Docket</span>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </div>

        {/* ── Log Officer Reply Dialog ─── */}
        <Dialog open={!!activeModalId} onOpenChange={(open) => !open && setActiveModalId(null)}>
          {activeEscalation && (
            <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 bg-[#faf9f5] border-[#cbd5cb] text-[#0e2b24]">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-[#0e2b24]">
                  Log Official Authority Reply
                </DialogTitle>
                <DialogDescription className="text-xs text-[#5c6f66]">
                  Record correspondence, reference dispatch number, or field inspection notes for
                  docket {activeEscalation.id}.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 space-y-3">
                <label
                  htmlFor="official-response"
                  className="text-xs font-semibold text-[#17382f] block"
                >
                  Official Response / Minutes:
                </label>
                <Textarea
                  id="official-response"
                  placeholder="e.g. Work order #GN-WO-401 issued to contractor. Inspection scheduled for Oct 28..."
                  className="text-xs bg-white border-[#cbd5cb]"
                  rows={4}
                  value={officialNote}
                  onChange={(e) => setOfficialNote(e.target.value)}
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-[#5c6f66]">Quick Status:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[#cbd5cb]"
                    disabled={isUpdatingId === activeEscalation.id}
                    onClick={() => handleUpdateStatus(activeEscalation.id, "acknowledged")}
                  >
                    Mark Acknowledged
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[#cbd5cb]"
                    disabled={isUpdatingId === activeEscalation.id}
                    onClick={() => handleUpdateStatus(activeEscalation.id, "in-progress")}
                  >
                    Mark In-Progress
                  </Button>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-end pt-2 border-t border-[#eef1e9]">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs border-[#cbd5cb]"
                  disabled={isSavingNote}
                  onClick={() => setActiveModalId(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-9 sm:h-8 text-xs gap-1.5 bg-[#0e2b24] hover:bg-[#1c4b3e] text-white"
                  disabled={isSavingNote || !officialNote.trim()}
                  onClick={handleSaveNote}
                >
                  {isSavingNote ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                  <span>Save to Audit Trail</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </RoleGuard>
  );
}
