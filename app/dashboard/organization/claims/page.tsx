"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  Upload,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ClaimsVerificationPage() {
  const searchParams = useSearchParams();
  const prefillIncidentId = searchParams.get("incidentId") || "";
  const prefillAdoptionId = searchParams.get("adoptionId") || "";

  const [loading, setLoading] = React.useState(true);
  const [claims, setClaims] = React.useState<any[]>([]);
  const [myOrg, setMyOrg] = React.useState<any>(null);

  // New claim modal
  const [showSubmitModal, setShowSubmitModal] = React.useState(Boolean(prefillIncidentId));
  const [incidentId, setIncidentId] = React.useState(prefillIncidentId);
  const [adoptionId, setAdoptionId] = React.useState(prefillAdoptionId);
  const [claimDesc, setClaimDesc] = React.useState("");
  const [photoBeforeUrl, setPhotoBeforeUrl] = React.useState("");
  const [photoAfterUrl, setPhotoAfterUrl] = React.useState("");
  const [certificateUrl, setCertificateUrl] = React.useState("");
  const [submittingClaim, setSubmittingClaim] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Appeal modal
  const [appealClaimId, setAppealClaimId] = React.useState<string | null>(null);
  const [appealReason, setAppealReason] = React.useState("");
  const [appealDocUrl, setAppealDocUrl] = React.useState("");
  const [submittingAppeal, setSubmittingAppeal] = React.useState(false);

  const fetchClaims = React.useCallback(async (orgId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/resolution-claims?organizationId=${orgId}`);
      if (res.ok) {
        const json = await res.json();
        setClaims(json.claims || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    async function loadOrgAndClaims() {
      try {
        const res = await fetch("/api/organizations/me");
        if (res.ok) {
          const json = await res.json();
          setMyOrg(json.organization);
          if (json.organization?.id) {
            await fetchClaims(json.organization.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadOrgAndClaims();
  }, [fetchClaims]);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClaim(true);
    setSubmitError(null);

    const evidenceItems: any[] = [];
    if (photoBeforeUrl) {
      evidenceItems.push({
        evidenceType: "photo_before",
        mediaUrl: photoBeforeUrl,
        description: "Initial hazard condition prior to intervention",
        visibility: "public",
      });
    }
    if (photoAfterUrl) {
      evidenceItems.push({
        evidenceType: "photo_after",
        mediaUrl: photoAfterUrl,
        description: "Post-remediation completed work",
        visibility: "public",
      });
    }
    if (certificateUrl) {
      evidenceItems.push({
        evidenceType: "completion_certificate",
        mediaUrl: certificateUrl,
        description: "Engineer work completion certificate",
        visibility: "public",
      });
    }

    try {
      const res = await fetch("/api/resolution-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          problemAdoptionId: adoptionId || undefined,
          claimDescription: claimDesc,
          evidenceItems,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit resolution claim.");
      }

      setShowSubmitModal(false);
      setClaimDesc("");
      setPhotoBeforeUrl("");
      setPhotoAfterUrl("");
      setCertificateUrl("");
      if (myOrg?.id) fetchClaims(myOrg.id);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit resolution claim.");
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealClaimId) return;

    setSubmittingAppeal(true);
    try {
      const res = await fetch(`/api/resolution-claims/${appealClaimId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealReason,
          supplementaryEvidenceUrl: appealDocUrl || undefined,
        }),
      });

      if (res.ok) {
        setAppealClaimId(null);
        setAppealReason("");
        setAppealDocUrl("");
        if (myOrg?.id) fetchClaims(myOrg.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAppeal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0e2b24]">Resolution Claims & Evidence Verification</h2>
          <p className="text-xs text-[#5c6f66]">
            File completion claims, track citizen consensus, and municipal engineering inspection
          </p>
        </div>

        <Button
          onClick={() => setShowSubmitModal(true)}
          className="bg-[#0e2b24] hover:bg-[#1a4439] text-[#f5f3ed] text-xs font-semibold"
        >
          <Plus className="size-3.5 mr-1" />
          <span>File Resolution Claim</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-[#cbd5cb] bg-[#faf9f5]">
          <div className="flex flex-col items-center gap-2">
            <div className="size-6 animate-spin rounded-full border-2 border-[#0e2b24] border-t-transparent" />
            <p className="text-xs text-[#5c6f66]">Loading claims...</p>
          </div>
        </div>
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#cbd5cb] bg-[#faf9f5] p-10 text-center">
          <CheckCircle2 className="size-8 text-[#5c6f66] mb-2" />
          <h3 className="text-xs font-semibold text-[#0e2b24]">No resolution claims filed yet</h3>
          <p className="mt-1 text-[11px] text-[#5c6f66]">
            When field repair is completed for an adopted incident, submit a claim with before & after photographs.
          </p>
          <Button
            onClick={() => setShowSubmitModal(true)}
            className="mt-4 bg-[#0e2b24] text-[#f5f3ed] text-xs font-semibold"
          >
            File First Claim
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map(({ claim, incident }) => {
            const isVerified = claim.status === "verified_resolved";
            const isUnderReview = ["submitted", "initial_review", "under_verification"].includes(claim.status);
            const isContested = ["not_verified", "disputed", "inconclusive"].includes(claim.status);

            return (
              <div
                key={claim.id}
                className="rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-5 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold uppercase ${
                          isVerified
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : isContested
                              ? "bg-rose-100 text-rose-900 border-rose-300"
                              : "bg-blue-100 text-blue-900 border-blue-300"
                        }`}
                      >
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs font-mono text-[#5c6f66]">{incident.incidentNumber}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-[#0e2b24]">{incident.title}</h3>
                    <p className="text-xs text-[#5c6f66] mt-0.5">{claim.claimDescription}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/resolutions/${incident.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs font-medium text-[#0e2b24] hover:bg-[#eae8de]"
                    >
                      <span>Public Dossier</span>
                      <ExternalLink className="size-3 text-[#5c6f66]" />
                    </Link>

                    {isContested && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAppealClaimId(claim.id)}
                        className="text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
                      >
                        Appeal Decision
                      </Button>
                    )}
                  </div>
                </div>

                {/* Risk and Municipal Inspection Badge */}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#cbd5cb]/60 pt-3 text-xs">
                  {claim.requiresOfficialInspection ? (
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        claim.officialInspectionCompleted
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {claim.officialInspectionCompleted ? (
                        <>
                          <ShieldCheck className="size-3.5 text-emerald-700" />
                          <span>Municipal Inspection Certified</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="size-3.5 text-amber-700" />
                          <span>Requires Qualified Municipal Sign-off</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#5c6f66]">Standard citizen verification procedure</span>
                  )}

                  <span className="text-[11px] text-[#5c6f66]">
                    Submitted: {new Date(claim.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Claim Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#cbd5cb] pb-3">
              <h3 className="text-sm font-bold text-[#0e2b24]">File Civic Problem Resolution Claim</h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-[#5c6f66] hover:text-[#0e2b24] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="mt-3 rounded-md bg-rose-100 p-2 text-xs font-semibold text-rose-900">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Incident UUID / ID <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste incident UUID or select from adopted projects"
                  value={incidentId}
                  onChange={(e) => setIncidentId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Claim Narrative / Completion Summary <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe physical remediation completed, contractor details, materials used..."
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Before Photograph URL (Original Condition)
                </label>
                <input
                  type="url"
                  placeholder="https://.../before-hazard.jpg"
                  value={photoBeforeUrl}
                  onChange={(e) => setPhotoBeforeUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  After Photograph URL (Completed Work) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://.../after-repair.jpg"
                  value={photoAfterUrl}
                  onChange={(e) => setPhotoAfterUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">
                  Work Completion Certificate / Engineer Sign-Off URL
                </label>
                <input
                  type="url"
                  placeholder="https://.../completion-noc.pdf"
                  value={certificateUrl}
                  onChange={(e) => setCertificateUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900">
                <strong>PRD Verification Rule:</strong> Submitting a claim does NOT mark the incident resolved.
                A citizen verification case will open for 72 hours. High-risk road repairs require certified municipal inspection.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingClaim}
                  className="bg-[#0e2b24] hover:bg-[#1a4439] text-[#f5f3ed] text-xs font-semibold"
                >
                  {submittingClaim ? "Submitting..." : "Submit Claim for Verification"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appeal Modal */}
      {appealClaimId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#cbd5cb] bg-[#faf9f5] p-6 shadow-xl">
            <h3 className="text-sm font-bold text-[#0e2b24]">Appeal Resolution Decision</h3>
            <p className="mt-1 text-xs text-[#5c6f66]">
              Submit clarifying notes or municipal inspection documents without deleting prior decision history.
            </p>
            <form onSubmit={handleAppeal} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Reason for Appeal</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why the decision should be reviewed..."
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0e2b24]">Supplementary Evidence URL</label>
                <input
                  type="url"
                  placeholder="https://.../supplementary-report.pdf"
                  value={appealDocUrl}
                  onChange={(e) => setAppealDocUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#cbd5cb] bg-white px-3 py-1.5 text-xs text-[#0e2b24] focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAppealClaimId(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAppeal}
                  className="bg-[#0e2b24] text-[#f5f3ed] text-xs font-semibold"
                >
                  {submittingAppeal ? "Submitting..." : "Submit Appeal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
