"use client";

import * as React from "react";
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResolutionVotingWidget({ incidentId }: { incidentId: string }) {
  const [caseData, setCaseData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [submittingVote, setSubmittingVote] = React.useState(false);
  const [voteMessage, setVoteMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCase = React.useCallback(async () => {
    try {
      setLoading(true);
      // Fetch claims to find active verification case
      const res = await fetch(`/api/resolution-claims?incidentId=${incidentId}`);
      if (res.ok) {
        const json = await res.json();
        const claims = json.claims || [];
        if (claims.length > 0) {
          const firstClaim = claims[0].claim;
          // Look for verification case
          const vRes = await fetch(`/api/resolution-claims/${firstClaim.id}/open-verification`, {
            method: "POST",
          });
          if (vRes.ok) {
            const vJson = await vRes.json();
            if (vJson.verificationCase?.id) {
              const detailsRes = await fetch(`/api/verification-cases/${vJson.verificationCase.id}`);
              if (detailsRes.ok) {
                setCaseData(await detailsRes.json());
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  React.useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleVote = async (voteType: "RESOLVED" | "NOT_RESOLVED" | "CANNOT_VERIFY") => {
    if (!caseData?.verificationCase?.id) return;
    setSubmittingVote(true);
    setVoteMessage(null);

    try {
      const res = await fetch(`/api/verification-cases/${caseData.verificationCase.id}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: voteType }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to record vote.");
      }

      setVoteMessage({
        type: "success",
        text: `Your vote '${voteType}' was recorded in the immutable audit ledger.`,
      });
      await fetchCase();
    } catch (err: any) {
      setVoteMessage({
        type: "error",
        text: err.message || "Failed to record vote.",
      });
    } finally {
      setSubmittingVote(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-[#5c6f66]">Loading verification case details...</div>;
  }

  if (!caseData) {
    return (
      <div className="text-xs text-[#5c6f66]">
        This incident does not have an active verification voting case at this moment.
      </div>
    );
  }

  const { stats, verificationCase } = caseData;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-[#cbd5cb] bg-white p-3 text-center">
          <span className="text-[10px] uppercase font-bold text-[#5c6f66]">Resolved Votes</span>
          <p className="mt-1 text-lg font-bold text-emerald-800">{stats.resolvedCount}</p>
        </div>
        <div className="rounded-lg border border-[#cbd5cb] bg-white p-3 text-center">
          <span className="text-[10px] uppercase font-bold text-[#5c6f66]">Defective / Not Resolved</span>
          <p className="mt-1 text-lg font-bold text-rose-800">{stats.notResolvedCount}</p>
        </div>
        <div className="rounded-lg border border-[#cbd5cb] bg-white p-3 text-center">
          <span className="text-[10px] uppercase font-bold text-[#5c6f66]">Cannot Verify (Neutral)</span>
          <p className="mt-1 text-lg font-bold text-gray-700">{stats.cannotVerifyCount}</p>
          <span className="text-[9px] text-[#5c6f66]">Excluded from consensus ratio</span>
        </div>
      </div>

      {voteMessage && (
        <div
          className={`rounded-md p-2.5 text-xs font-semibold ${
            voteMessage.type === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
          }`}
        >
          {voteMessage.text}
        </div>
      )}

      {verificationCase.status === "opened" && (
        <div className="rounded-lg border border-[#cbd5cb] bg-[#f2eee1] p-4">
          <h4 className="text-xs font-bold text-[#0e2b24]">Cast Your Citizen Verification Vote:</h4>
          <p className="mt-0.5 text-[11px] text-[#5c6f66]">
            Have you personally inspected this location? Confirm whether the hazard has been satisfactorily remedied.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={submittingVote}
              onClick={() => handleVote("RESOLVED")}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="size-3.5 mr-1" />
              <span>Confirm Resolved</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={submittingVote}
              onClick={() => handleVote("NOT_RESOLVED")}
              className="border-rose-300 text-rose-900 hover:bg-rose-50 text-xs font-semibold"
            >
              <XCircle className="size-3.5 mr-1 text-rose-700" />
              <span>Still Defective</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              disabled={submittingVote}
              onClick={() => handleVote("CANNOT_VERIFY")}
              className="text-[#5c6f66] hover:bg-[#e7e5dc] text-xs font-medium"
            >
              <HelpCircle className="size-3.5 mr-1" />
              <span>Cannot Verify</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
