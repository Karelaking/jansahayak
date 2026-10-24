"use client";

import * as React from "react";
import { Building2, Clock, ExternalLink, MessageSquare, CheckCircle2, Send } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Escalation = {
  id: string;
  title: string;
  summary: string;
  authority: string;
  officer: string;
  status: "awaiting-response" | "acknowledged" | "in-progress" | "resolved";
  statusLabel: string;
  statusVariant: "destructive" | "secondary" | "default" | "outline";
  daysOpen: number;
  linkedReports: number;
  lastUpdate: string;
  originReportId: string;
};

const INITIAL_ESCALATIONS: Escalation[] = [
  {
    id: "E-019",
    title: "Pari Chowk crossing — repeated pedestrian near-miss incidents",
    summary:
      "Multiple citizens recorded vehicles running the red phase at the Pari Chowk Metro pedestrian exit. Formal representation submitted to GNIDA Traffic Management cell.",
    authority: "GNIDA Traffic Dept.",
    officer: "Er. V. Sharma (Executive Engineer)",
    status: "awaiting-response",
    statusLabel: "Awaiting Formal Response",
    statusVariant: "destructive",
    daysOpen: 12,
    linkedReports: 8,
    lastUpdate: "Oct 19, 2026 — Grievance ID #GNIDA-2026-9041 registered",
    originReportId: "R-2038",
  },
  {
    id: "E-018",
    title: "Alpha I commercial market — long-standing pothole cluster",
    summary:
      "Cluster of 4 structural asphalt craters near Gate #2 of Alpha I market reported across 3 months without contractor remediation. Escalated to PWD.",
    authority: "GNIDA Public Works Dept (PWD)",
    officer: "Er. K. Singh (Superintendent Engineer)",
    status: "acknowledged",
    statusLabel: "Work Order Pending",
    statusVariant: "secondary",
    daysOpen: 21,
    linkedReports: 11,
    lastUpdate: "Oct 15, 2026 — PWD inspection team visited site for measurement",
    originReportId: "R-2015",
  },
  {
    id: "E-017",
    title: "Broken storm drain slab — monsoon foot-traffic collapse risk",
    summary:
      "Cracked concrete drain cover over 8-foot open stormwater culvert outside Senior Secondary School. Escalated following citizen safety hazard petition.",
    authority: "Greater Noida Municipality Drainage Cell",
    officer: "Municipal Sanitary Inspector",
    status: "in-progress",
    statusLabel: "Inspection Scheduled",
    statusVariant: "default",
    daysOpen: 8,
    linkedReports: 4,
    lastUpdate: "Oct 21, 2026 — Barricading deployed by emergency civic crew",
    originReportId: "R-2033",
  },
];

export default function EscalationsPage() {
  const [escalations, setEscalations] = React.useState<Escalation[]>(INITIAL_ESCALATIONS);
  const [activeModalId, setActiveModalId] = React.useState<string | null>(null);
  const [officialNote, setOfficialNote] = React.useState("");

  const activeEscalation = escalations.find((e) => e.id === activeModalId);

  const handleUpdateStatus = (id: string, newStatus: Escalation["status"]) => {
    setEscalations((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        let statusLabel = "In Progress";
        let statusVariant: Escalation["statusVariant"] = "default";
        if (newStatus === "acknowledged") {
          statusLabel = "Acknowledged by Dept";
          statusVariant = "secondary";
        } else if (newStatus === "resolved") {
          statusLabel = "Remediation Complete";
          statusVariant = "outline";
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
  };

  const handleSaveNote = () => {
    if (!activeModalId || !officialNote.trim()) return;
    setEscalations((prev) =>
      prev.map((e) =>
        e.id === activeModalId
          ? {
              ...e,
              lastUpdate: `Just now — Official Note: ${officialNote}`,
            }
          : e,
      ),
    );
    setOfficialNote("");
    setActiveModalId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Authority Escalation Tracker
            </h1>
            <Badge variant="outline" className="text-xs">
              {escalations.length} Active Dockets
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditable trail of hazard files escalated to responsible municipal authorities and
            elected ward reps.
          </p>
        </div>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => alert("New escalation draft created for Greater Noida North Ward.")}
        >
          <Send className="size-3.5" />
          <span>New Escalation Memo</span>
        </Button>
      </div>

      {/* ── Escalation Cards ─── */}
      <div className="grid grid-cols-1 gap-6">
        {escalations.map((e) => (
          <Card key={e.id} className="shadow-xs">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {e.id}
                  </span>
                  <Badge variant={e.statusVariant} className="text-xs">
                    {e.statusLabel}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-destructive">
                    {e.daysOpen} days open
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{e.linkedReports} citizen reports attached</span>
                  <span>&middot;</span>
                  <span className="font-mono">Origin: {e.originReportId}</span>
                </div>
              </div>

              <CardTitle className="text-lg mt-2 font-semibold">{e.title}</CardTitle>
              <CardDescription className="text-sm text-foreground/80 mt-1">
                {e.summary}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 bg-muted/10">
              <div className="flex items-start gap-3">
                <Building2 className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-medium text-foreground">Designated Authority</span>
                  <span className="text-muted-foreground">{e.authority}</span>
                  <span className="text-muted-foreground">{e.officer}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="font-medium text-foreground">Latest Recorded Action</span>
                  <span className="text-muted-foreground">{e.lastUpdate}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
              <div className="flex items-center gap-2">
                {e.status !== "resolved" ? (
                  <>
                    <Button
                      size="xs"
                      variant="default"
                      className="gap-1"
                      onClick={() => handleUpdateStatus(e.id, "acknowledged")}
                    >
                      <CheckCircle2 className="size-3" />
                      <span>Log Official Acknowledgment</span>
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      className="gap-1"
                      onClick={() => handleUpdateStatus(e.id, "resolved")}
                    >
                      <span>Mark Work Completed</span>
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className="text-xs text-emerald-600">
                    Remediation Verified by Community
                  </Badge>
                )}

                <Button
                  size="xs"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setActiveModalId(e.id)}
                >
                  <MessageSquare className="size-3" />
                  <span>Add Civic Follow-up Note</span>
                </Button>
              </div>

              <Button
                size="xs"
                variant="ghost"
                className="gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => alert(`Showing full correspondence file for ${e.id}`)}
              >
                <span>View Full Docket</span>
                <ExternalLink className="size-3" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* ── Add Note Dialog ─── */}
      <Dialog
        open={Boolean(activeModalId)}
        onOpenChange={(open) => !open && setActiveModalId(null)}
      >
        <DialogContent className="sm:max-w-md">
          {activeEscalation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  Add Official Follow-up Note ({activeEscalation.id})
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Record meeting minutes, official letters, or field-inspection updates from{" "}
                  {activeEscalation.authority}.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2">
                <Textarea
                  placeholder="e.g. Met with Junior Engineer at site. Contractor tender issued for asphalt overlay..."
                  value={officialNote}
                  onChange={(e) => setOfficialNote(e.target.value)}
                  className="min-h-[100px] text-xs"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" size="xs" onClick={() => setActiveModalId(null)}>
                  Cancel
                </Button>
                <Button size="xs" onClick={handleSaveNote} disabled={!officialNote.trim()}>
                  Save Note to Docket
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
