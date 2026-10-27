"use client";

import * as React from "react";
import Link from "next/link";
import {
  Compass,
  Search,
  Filter,
  ShieldAlert,
  AlertTriangle,
  Building2,
  FileCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DiscoverProblemsPage() {
  const [loading, setLoading] = React.useState(true);
  const [problems, setProblems] = React.useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [myOrg, setMyOrg] = React.useState<any>(null);

  // Proposal modal state
  const [selectedProblem, setSelectedProblem] = React.useState<any | null>(null);
  const [proposedRole, setProposedRole] = React.useState<string>("implementer");
  const [scope, setScope] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [estimatedCost, setEstimatedCost] = React.useState("");
  const [proposedDeadline, setProposedDeadline] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [proposalMsg, setProposalMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProblems = React.useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedCategory
        ? `/api/civic-problems/discover?category=${encodeURIComponent(selectedCategory)}`
        : `/api/civic-problems/discover`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setProblems(json.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  React.useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  React.useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch("/api/organizations/me");
        if (res.ok) {
          const json = await res.json();
          setMyOrg(json.organization);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchOrg();
  }, []);

  const handleProposeAdoption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProblem) return;

    setSubmitting(true);
    setProposalMsg(null);

    try {
      const res = await fetch(`/api/civic-problems/${selectedProblem.id}/adoption-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedRole,
          scope,
          proposalDescription: description,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
          proposedDeadline: proposedDeadline ? new Date(proposedDeadline).toISOString() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit adoption proposal.");
      }

      setProposalMsg({
        type: "success",
        text: "Adoption proposal submitted successfully for municipal coordination.",
      });

      setTimeout(() => {
        setSelectedProblem(null);
        setProposalMsg(null);
        setScope("");
        setDescription("");
        setEstimatedCost("");
        fetchProblems();
      }, 1500);
    } catch (err: any) {
      setProposalMsg({ type: "error", text: err.message || "Failed to submit proposal." });
    } finally {
      setSubmitting(false);
    }
  };

  const isVerifiedOrg = myOrg?.verificationStatus === "verified";

  return (
    <div className="space-y-6">
      {/* Header and filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0e2b24]">Verified Civic Problem Catalog</h2>
          <p className="text-xs text-[#5c6f66]">
            Approved community hazards published for private, CSR, or NGO intervention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-[#cbd5cb] bg-[#faf9f5] px-3 py-1.5 text-xs text-[#0e2b24] focus:border-[#0e2b24] focus:outline-hidden"
          >
            <option value="">All Categories</option>
            <option value="Road Surface / Pothole">Road Surface / Pothole</option>
            <option value="Drainage & Waterlogging">Drainage & Waterlogging</option>
            <option value="Street Lighting & Electrical">Street Lighting & Electrical</option>
            <option value="Solid Waste & Cleanliness">Solid Waste & Cleanliness</option>
          </select>
        </div>
      </div>

      {!isVerifiedOrg && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="size-4 shrink-0 text-amber-700" />
          <span>
            <strong>Note:</strong> Your organization is pending identity verification. You may browse problems,
            but official adoption proposals require a verified organization profile.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-[#cbd5cb] bg-[#faf9f5]">
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-[#0e2b24] border-t-transparent" />
            <p className="text-xs text-[#5c6f66]">Fetching eligible civic problems...</p>
          </div>
        </div>
      ) : problems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd5cb] bg-[#faf9f5] p-10 text-center">
          <Compass className="size-8 text-[#5c6f66] mb-2" />
          <h3 className="text-xs font-semibold text-[#0e2b24]">No open civic problems found</h3>
          <p className="mt-1 text-[11px] text-[#5c6f66]">
            All published problems matching this filter are either in active resolution or resolved.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-4 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <Badge variant="outline" className="border-[#cbd5cb] text-[#0e2b24] font-semibold text-[10px]">
                    {p.category}
                  </Badge>
                  <span className="font-mono text-[10px] text-[#5c6f66]">{p.incidentNumber}</span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-[#0e2b24] line-clamp-1">{p.title}</h3>
                <p className="mt-1 text-xs text-[#5c6f66] line-clamp-2">{p.summary}</p>

                {/* Permissions & Risk Notice */}
                <div className="mt-3 rounded-md border border-[#e2dec9] bg-[#f2eee1] p-2 text-[10px] text-[#4b5952]">
                  <div className="flex items-center justify-between font-semibold text-[#0e2b24]">
                    <span>Authority:</span>
                    <span className="truncate max-w-[140px]">{p.permissions?.statutoryAuthority}</span>
                  </div>
                  {p.isHighRisk && (
                    <div className="mt-1 flex items-center gap-1 text-rose-800 font-semibold">
                      <ShieldAlert className="size-3" />
                      <span>Requires statutory engineering NOC</span>
                    </div>
                  )}
                </div>

                {p.activeAdoptionCount > 0 && (
                  <p className="mt-2 text-[10px] font-medium text-blue-800">
                    {p.activeAdoptionCount} organization(s) have expressed interest
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#cbd5cb]/70 flex items-center justify-between">
                <span className="text-[10px] text-[#5c6f66]">
                  {p.reportCount} report{p.reportCount > 1 ? "s" : ""}
                </span>
                <Button
                  size="sm"
                  disabled={!isVerifiedOrg}
                  onClick={() => setSelectedProblem(p)}
                  className="bg-[#0e2b24] hover:bg-[#1a4439] text-[#f5f3ed] text-xs font-semibold py-1 px-3"
                >
                  Propose Adoption
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adoption Proposal Modal */}
      {selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#cbd5cb] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0e2b24]">Propose Civic Problem Adoption</h3>
                <p className="text-[11px] text-[#5c6f66]">{selectedProblem.title} ({selectedProblem.incidentNumber})</p>
              </div>
              <button
                onClick={() => setSelectedProblem(null)}
                className="text-[#5c6f66] hover:text-[#0e2b24] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {proposalMsg && (
              <div
                className={`mt-3 rounded-md p-2 text-xs font-semibold ${
                  proposalMsg.type === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
                }`}
              >
                {proposalMsg.text}
              </div>
            )}

            <form onSubmit={handleProposeAdoption} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Proposed Role <span className="text-rose-600">*</span>
                </label>
                <select
                  value={proposedRole}
                  onChange={(e) => setProposedRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                >
                  <option value="implementer">Implementer (Physical Field Execution)</option>
                  <option value="funder">Funder (CSR / Capital Sponsorship)</option>
                  <option value="joint_partner">Joint Partner (Public-Private Collaboration)</option>
                  <option value="technical_partner">Technical Partner (Materials / Diagnostic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Intervention Scope <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Resurface 150m damaged asphalt and rebuild drainage curb"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Proposal Details & Methodology <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain execution methodology, contractor credentials, and coordination plan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0e2b24]">Estimated Cost (INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 75000"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0e2b24]">Target Completion Date</label>
                  <input
                    type="date"
                    value={proposedDeadline}
                    onChange={(e) => setProposedDeadline(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900">
                <strong>PRD Rule:</strong> Problem adoption does NOT close the problem or grant an exclusive monopoly.
                The underlying report remains open until physical repair is completed and verified by citizen consensus.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedProblem(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0e2b24] hover:bg-[#1a4439] text-[#f5f3ed] text-xs font-semibold"
                >
                  {submitting ? "Submitting Proposal..." : "Submit Proposal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
