"use client";

import * as React from "react";
import {
  ThumbsUp,
  CheckCircle2,
  AlertTriangle,
  Users,
  Bell,
  MessageSquare,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface VoteRecord {
  id: string;
  voterName: string;
  voterRole: string;
  voteType: string;
  comment?: string | null;
  isLocalResident: boolean;
  createdAt: string;
}

interface VotesResponse {
  success: boolean;
  incidentId: string;
  incidentStatus: string;
  publicOpinionStatus: string;
  totalVerifications: number;
  totalResolutionVotes: number;
  totalUnresolvedVotes: number;
  resolutionConsensusPercentage: number;
  isConsensusResolved: boolean;
  isPublicDisputed: boolean;
  recentVotes: VoteRecord[];
}

interface CommunityProgressVotingWidgetProps {
  incidentId: string;
  incidentNumber?: string;
  initialStatus?: string;
  initialOpinionStatus?: string;
  initialVerifications?: number;
  initialResolutions?: number;
  initialUnresolved?: number;
  onRefreshParent?: () => void;
}

export function CommunityProgressVotingWidget({
  incidentId,
  incidentNumber,
  initialStatus = "open",
  initialOpinionStatus = "verified_hazard",
  initialVerifications = 1,
  initialResolutions = 0,
  initialUnresolved = 0,
  onRefreshParent,
}: CommunityProgressVotingWidgetProps) {
  const [votesData, setVotesData] = React.useState<VotesResponse>({
    success: true,
    incidentId,
    incidentStatus: initialStatus,
    publicOpinionStatus: initialOpinionStatus,
    totalVerifications: initialVerifications,
    totalResolutionVotes: initialResolutions,
    totalUnresolvedVotes: initialUnresolved,
    resolutionConsensusPercentage:
      initialResolutions + initialUnresolved > 0
        ? Math.round((initialResolutions / (initialResolutions + initialUnresolved)) * 100)
        : 0,
    isConsensusResolved: initialOpinionStatus === "community_resolved",
    isPublicDisputed: initialOpinionStatus === "public_disputed",
    recentVotes: [],
  });

  const [_isLoadingVotes, setIsLoadingVotes] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Form state
  const [comment, setComment] = React.useState("");
  const [isLocalResident, setIsLocalResident] = React.useState(true);
  const [wantsUpdates, setWantsUpdates] = React.useState(false);
  const [voterEmail, setVoterEmail] = React.useState("");
  const [voterName, setVoterName] = React.useState("");
  const [showNotificationOptions, setShowNotificationOptions] = React.useState(false);

  // Local vote tracking to disable buttons immediately
  const [hasVerified, setHasVerified] = React.useState(false);
  const [hasVotedResolution, setHasVotedResolution] = React.useState<
    "confirm_resolved" | "still_unresolved" | null
  >(null);

  // Fetch live votes tally from backend
  const fetchVotes = React.useCallback(async () => {
    if (!incidentId) return;
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/votes`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVotesData(data);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch votes:", e);
    } finally {
      setIsLoadingVotes(false);
    }
  }, [incidentId]);

  React.useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  // Cast vote handler
  const handleVote = async (
    voteType: "verify_hazard" | "confirm_resolved" | "still_unresolved",
  ) => {
    if (isSubmitting) return;

    if (wantsUpdates && voterEmail.trim().length > 0 && !voterEmail.includes("@")) {
      setFeedback({ text: "Please enter a valid email address for notifications.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voteType,
          comment: comment.trim() || undefined,
          isLocalResident,
          wantsUpdates,
          voterEmail: wantsUpdates && voterEmail.trim() ? voterEmail.trim() : undefined,
          voterName: voterName.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record your vote.");
      }

      // Record local voting state
      if (voteType === "verify_hazard") {
        setHasVerified(true);
      } else {
        setHasVotedResolution(voteType);
      }

      setFeedback({
        text: json.message || "Your community vote has been registered and verified.",
        type: "success",
      });

      // Clear input fields
      setComment("");

      // Refresh live vote counts
      await fetchVotes();
      if (onRefreshParent) {
        onRefreshParent();
      }
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : "Vote registration failed.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel =
    votesData.publicOpinionStatus === "community_resolved"
      ? "Resolved by Community Consensus"
      : votesData.publicOpinionStatus === "public_disputed"
        ? "Public Disputed (Defect Persists)"
        : votesData.publicOpinionStatus === "under_repair"
          ? "Under Repair (Awaiting Citizen Consensus)"
          : "Active Community Hazard";

  const totalResolutionVotesAll = votesData.totalResolutionVotes + votesData.totalUnresolvedVotes;

  return (
    <Card className="border-[#cbd5cb] bg-[#faf9f5] shadow-xs overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-[#eef1e9] bg-[#f5f3ed]/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#486057]">
                PRD §14B Citizen Governance
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold border ${
                  votesData.publicOpinionStatus === "community_resolved"
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : votesData.publicOpinionStatus === "public_disputed"
                      ? "bg-rose-100 text-rose-900 border-rose-300"
                      : votesData.publicOpinionStatus === "under_repair"
                        ? "bg-blue-100 text-blue-900 border-blue-300"
                        : "bg-[#eaf1e9] text-[#1e4638] border-[#c5d8c3]"
                }`}
              >
                {statusLabel}
              </Badge>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-[#0e2b24] mt-1">
              Community Hazard Verification &amp; Resolution Voting
            </CardTitle>
          </div>
          <div className="text-xs text-[#5c6f66] sm:text-right">
            <span className="font-mono font-semibold text-[#0e2b24]">
              {incidentNumber || incidentId.slice(0, 8)}
            </span>
            <p className="text-[11px]">Consensus Gated</p>
          </div>
        </div>
        <CardDescription className="text-xs text-[#5c6f66] mt-1 leading-relaxed">
          Project progress and closure strictly depend on public opinion. An incident cannot be
          marked repaired by administrative declaration alone: it requires at least 3 local resident
          confirmations (&ge;75% agreement). If 2+ local residents report the defect persists, the
          case reopens automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-rose-50 text-rose-900 border-rose-300"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-[10px] font-bold uppercase underline opacity-70 hover:opacity-100 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Metric Scorecards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-white border border-[#cbd5cb] shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-[#5c6f66]">
              <span>Community Verifications</span>
              <Users className="size-3.5 text-[#17382f]" />
            </div>
            <p className="text-xl font-bold text-[#0e2b24] mt-1">{votesData.totalVerifications}</p>
            <p className="text-[10px] text-[#5c6f66] mt-0.5">Locals testified hazard presence</p>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#cbd5cb] shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-[#5c6f66]">
              <span>Citizen Repair Consensus</span>
              <CheckCircle2 className="size-3.5 text-emerald-700" />
            </div>
            <p className="text-xl font-bold text-[#0e2b24] mt-1">
              {totalResolutionVotesAll > 0
                ? `${votesData.resolutionConsensusPercentage}%`
                : "Pending"}
            </p>
            <p className="text-[10px] text-[#5c6f66] mt-0.5">
              {votesData.totalResolutionVotes} fixed vs {votesData.totalUnresolvedVotes} unresolved
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#cbd5cb] shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-[#5c6f66]">
              <span>Resolution Quorum</span>
              <Sparkles className="size-3.5 text-amber-700" />
            </div>
            <p className="text-xl font-bold text-[#0e2b24] mt-1">
              {votesData.totalResolutionVotes} / 3
            </p>
            <p className="text-[10px] text-[#5c6f66] mt-0.5">
              {votesData.isConsensusResolved
                ? "Threshold Met (Verified Resolved)"
                : `${Math.max(0, 3 - votesData.totalResolutionVotes)} more confirmations required`}
            </p>
          </div>
        </div>

        {/* ── Consensus Ratio Visual Bar ── */}
        {totalResolutionVotesAll > 0 && (
          <div className="space-y-1.5 bg-white p-3 rounded-lg border border-[#cbd5cb]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-800 flex items-center gap-1">
                <Check className="size-3" />
                {votesData.totalResolutionVotes} Confirmed Safe (
                {votesData.resolutionConsensusPercentage}%)
              </span>
              <span className="font-semibold text-rose-800 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {votesData.totalUnresolvedVotes} Danger Still Present (
                {100 - votesData.resolutionConsensusPercentage}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-600 transition-all duration-500"
                style={{ width: `${votesData.resolutionConsensusPercentage}%` }}
              />
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${100 - votesData.resolutionConsensusPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Citizen Voting Action Buttons ── */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-[#0e2b24] uppercase tracking-wider text-[11px]">
            Cast Your Citizen Voice
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Action 1: Verify Hazard */}
            <Button
              type="button"
              disabled={isSubmitting || hasVerified}
              onClick={() => handleVote("verify_hazard")}
              className={`h-10 text-xs font-semibold justify-center transition-all ${
                hasVerified
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-[#0e2b24] hover:bg-[#1c4b3e] text-white shadow-xs"
              }`}
            >
              {hasVerified ? (
                <>
                  <Check className="size-3.5 mr-1.5" />
                  <span>You Verified (+1)</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="size-3.5 mr-1.5" />
                  <span>I See This Hazard (+1)</span>
                </>
              )}
            </Button>

            {/* Action 2: Confirm Repaired */}
            <Button
              type="button"
              disabled={isSubmitting || hasVotedResolution === "confirm_resolved"}
              onClick={() => handleVote("confirm_resolved")}
              variant="outline"
              className={`h-10 text-xs font-semibold justify-center border transition-all ${
                hasVotedResolution === "confirm_resolved"
                  ? "bg-emerald-100 text-emerald-900 border-emerald-400"
                  : "bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              {hasVotedResolution === "confirm_resolved" ? (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-700" />
                  <span>You Voted Fixed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-700" />
                  <span>Confirm Fixed &amp; Safe</span>
                </>
              )}
            </Button>

            {/* Action 3: Still Unresolved */}
            <Button
              type="button"
              disabled={isSubmitting || hasVotedResolution === "still_unresolved"}
              onClick={() => handleVote("still_unresolved")}
              variant="outline"
              className={`h-10 text-xs font-semibold justify-center border transition-all ${
                hasVotedResolution === "still_unresolved"
                  ? "bg-rose-100 text-rose-900 border-rose-400"
                  : "bg-white text-rose-900 border-rose-300 hover:bg-rose-50"
              }`}
            >
              {hasVotedResolution === "still_unresolved" ? (
                <>
                  <AlertTriangle className="size-3.5 mr-1.5 text-rose-700" />
                  <span>You Voted Defect Persists</span>
                </>
              ) : (
                <>
                  <RotateCcw className="size-3.5 mr-1.5 text-rose-700" />
                  <span>Hazard Still Present</span>
                </>
              )}
            </Button>
          </div>

          {/* Context Options: Resident Status & Comments */}
          <div className="bg-white p-3.5 rounded-xl border border-[#cbd5cb] space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eef1e9] pb-2.5">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#17382f]">
                <input
                  type="checkbox"
                  checked={isLocalResident}
                  onChange={(e) => setIsLocalResident(e.target.checked)}
                  className="rounded border-[#cbd5cb] text-[#0e2b24] focus:ring-[#0e2b24]"
                />
                <span>
                  I live, work, or regularly commute in this sector (Required for consensus weight)
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowNotificationOptions(!showNotificationOptions)}
                className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <Bell className="size-3" />
                <span>
                  {showNotificationOptions ? "Hide Alert Settings" : "Receive Progress Updates"}
                </span>
              </button>
            </div>

            {/* Optional field testimony text */}
            <div className="space-y-1">
              <label
                htmlFor="vote-testimony"
                className="text-[11px] font-semibold text-[#486057] uppercase tracking-wider flex items-center gap-1"
              >
                <MessageSquare className="size-3" />
                <span>On-The-Ground Observations (Optional Testimony)</span>
              </label>
              <input
                id="vote-testimony"
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g., Waterlogging still blocking the crosswalk after rain..."
                className="w-full px-3 py-2 text-xs rounded-md border border-[#cbd5cb] bg-[#faf9f5] focus:outline-none focus:ring-1 focus:ring-[#0e2b24]"
              />
            </div>

            {/* Notification / Subscriber Email Form */}
            {showNotificationOptions && (
              <div className="pt-2 border-t border-[#eef1e9] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="voter-name" className="text-[11px] font-medium text-[#486057]">
                    Your Name (Optional)
                  </label>
                  <input
                    id="voter-name"
                    type="text"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    placeholder="e.g., Sector 15 Resident"
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-[#cbd5cb] bg-[#faf9f5]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="voter-email" className="text-[11px] font-medium text-[#486057]">
                    Email for Repair Milestones
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="voter-email"
                      type="email"
                      value={voterEmail}
                      onChange={(e) => {
                        setVoterEmail(e.target.value);
                        setWantsUpdates(true);
                      }}
                      placeholder="citizen@domain.com"
                      className="flex-1 px-3 py-1.5 text-xs rounded-md border border-[#cbd5cb] bg-[#faf9f5]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Community Testimonies ── */}
        {votesData.recentVotes && votesData.recentVotes.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <span className="text-[11px] font-semibold text-[#486057] uppercase tracking-wider">
              Recent Verified Local Testimonies ({votesData.recentVotes.length})
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {votesData.recentVotes.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 rounded-lg border border-[#eef1e9] bg-white text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#0e2b24]">
                        {v.voterName || "Sector Resident"}
                      </span>
                      {v.isLocalResident && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Local Resident
                        </span>
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                          v.voteType === "confirm_resolved"
                            ? "bg-emerald-100 text-emerald-900"
                            : v.voteType === "still_unresolved"
                              ? "bg-rose-100 text-rose-900"
                              : "bg-[#eaf1e9] text-[#1e4638]"
                        }`}
                      >
                        {v.voteType === "confirm_resolved"
                          ? "Confirmed Fixed"
                          : v.voteType === "still_unresolved"
                            ? "Reported Unresolved"
                            : "Verified Hazard"}
                      </span>
                    </div>
                    {v.comment && (
                      <p className="text-[11px] text-[#486057] italic">&ldquo;{v.comment}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#5c6f66] shrink-0 font-mono">
                    {new Date(v.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
