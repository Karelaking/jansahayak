"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdoptedProjectsPage() {
  const [loading, setLoading] = React.useState(true);
  const [adoptions, setAdoptions] = React.useState<any[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Milestone creation modal
  const [activeAdoptionForMilestone, setActiveAdoptionForMilestone] = React.useState<any | null>(null);
  const [milestoneTitle, setMilestoneTitle] = React.useState("");
  const [milestoneDesc, setMilestoneDesc] = React.useState("");
  const [milestoneDue, setMilestoneDue] = React.useState("");
  const [addingMilestone, setAddingMilestone] = React.useState(false);

  // Withdraw modal
  const [withdrawAdoptionId, setWithdrawAdoptionId] = React.useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = React.useState("");
  const [withdrawing, setWithdrawing] = React.useState(false);

  const fetchAdoptions = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/organizations/me/adoptions");
      if (res.ok) {
        const json = await res.json();
        setAdoptions(json.adoptions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAdoptions();
  }, [fetchAdoptions]);

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdoptionForMilestone) return;

    setAddingMilestone(true);
    try {
      const res = await fetch(`/api/adoptions/${activeAdoptionForMilestone.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: milestoneTitle,
          description: milestoneDesc,
          dueAt: milestoneDue ? new Date(milestoneDue).toISOString() : undefined,
        }),
      });

      if (res.ok) {
        setActiveAdoptionForMilestone(null);
        setMilestoneTitle("");
        setMilestoneDesc("");
        setMilestoneDue("");
        await fetchAdoptions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAdoptionId) return;

    setWithdrawing(true);
    try {
      const res = await fetch(`/api/adoptions/${withdrawAdoptionId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawReason }),
      });

      if (res.ok) {
        setWithdrawAdoptionId(null);
        setWithdrawReason("");
        await fetchAdoptions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleMilestoneComplete = async (milestoneId: string) => {
    try {
      await fetch(`/api/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", completedAt: new Date().toISOString() }),
      });
      await fetchAdoptions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0e2b24]">My Adopted Civic Projects</h2>
          <p className="text-xs text-[#5c6f66]">
            Track delivery progress, statutory permissions, and project milestones
          </p>
        </div>

        <Link
          href="/dashboard/organization/discover"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0e2b24] px-3 py-1.5 text-xs font-semibold text-[#f5f3ed] hover:bg-[#1a4439] transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Adopt New Problem</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-[#cbd5cb] bg-[#faf9f5]">
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-[#0e2b24] border-t-transparent" />
            <p className="text-xs text-[#5c6f66]">Loading adopted projects...</p>
          </div>
        </div>
      ) : adoptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd5cb] bg-[#faf9f5] p-10 text-center">
          <Briefcase className="size-8 text-[#5c6f66] mb-2" />
          <h3 className="text-xs font-semibold text-[#0e2b24]">No active civic adoptions yet</h3>
          <p className="mt-1 text-[11px] text-[#5c6f66]">
            Discover verified public hazards to propose civic intervention.
          </p>
          <Link
            href="/dashboard/organization/discover"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#0e2b24] px-3.5 py-2 text-xs font-semibold text-[#f5f3ed]"
          >
            <span>Browse Problem Catalog</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {adoptions.map(({ adoption, incident }) => {
            const isExpanded = expandedId === adoption.id;
            return (
              <div
                key={adoption.id}
                className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-[#cbd5cb] text-[#0e2b24] font-semibold text-[10px] uppercase"
                      >
                        {adoption.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs font-mono text-[#5c6f66]">{incident.incidentNumber}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-[#0e2b24]">{incident.title}</h3>
                    <p className="text-xs text-[#5c6f66] mt-0.5">
                      Role: <strong className="text-[#0e2b24]">{adoption.proposedRole.toUpperCase()}</strong> • Scope:{" "}
                      {adoption.scope}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedId(isExpanded ? null : adoption.id)}
                      className="text-xs border-[#cbd5cb]"
                    >
                      {isExpanded ? (
                        <>
                          <span>Collapse</span>
                          <ChevronUp className="size-3 ml-1" />
                        </>
                      ) : (
                        <>
                          <span>Milestones & Details</span>
                          <ChevronDown className="size-3 ml-1" />
                        </>
                      )}
                    </Button>

                    <Link
                      href={`/dashboard/organization/claims?incidentId=${incident.id}&adoptionId=${adoption.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-[#0e2b24] px-3 py-1.5 text-xs font-semibold text-[#f5f3ed] hover:bg-[#1a4439]"
                    >
                      <span>Submit Claim</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-[#cbd5cb] pt-4 space-y-4">
                    <div className="rounded-md border border-[#e2dec9] bg-[#f2eee1] p-3 text-xs">
                      <h4 className="font-semibold text-[#0e2b24]">Adoption Scope & Commitment</h4>
                      <p className="mt-1 text-[#4b5952]">{adoption.proposalDescription}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#5c6f66]">
                        {adoption.estimatedCost && (
                          <span>
                            Budget: <strong>₹{parseFloat(adoption.estimatedCost).toLocaleString("en-IN")}</strong>
                          </span>
                        )}
                        {adoption.proposedDeadline && (
                          <span>
                            Target: <strong>{new Date(adoption.proposedDeadline).toLocaleDateString()}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveAdoptionForMilestone(adoption)}
                        className="text-xs border-[#cbd5cb]"
                      >
                        <Plus className="size-3 mr-1" />
                        <span>Add Deliverable Milestone</span>
                      </Button>

                      {adoption.status !== "withdrawn" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setWithdrawAdoptionId(adoption.id)}
                          className="text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-900"
                        >
                          Withdraw Adoption
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Milestone Modal */}
      {activeAdoptionForMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xl">
            <h3 className="text-sm font-bold text-[#0e2b24]">Add Project Milestone</h3>
            <form onSubmit={handleAddMilestone} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Milestone Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PWD NOC Received & Material Procured"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Details of progress or compliance documents..."
                  value={milestoneDesc}
                  onChange={(e) => setMilestoneDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Due Date</label>
                <input
                  type="date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveAdoptionForMilestone(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addingMilestone}
                  className="bg-[#0e2b24] text-[#f5f3ed] text-xs font-semibold"
                >
                  {addingMilestone ? "Saving..." : "Save Milestone"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawAdoptionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xl">
            <h3 className="text-sm font-bold text-rose-900">Withdraw Adoption</h3>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Withdrawing will return the civic problem to open status so other organizations or the municipality
              can complete it.
            </p>
            <form onSubmit={handleWithdraw} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Reason for Withdrawal</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify operational constraints, permission hurdles, or budget reallocation..."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWithdrawAdoptionId(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={withdrawing}
                  className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
                >
                  {withdrawing ? "Withdrawing..." : "Confirm Withdrawal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
