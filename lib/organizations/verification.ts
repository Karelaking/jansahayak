import {
  db,
  incidents,
  organizations,
  organizationMembers,
  resolutionClaims,
  resolutionEvidence,
  problemAdoptions,
  verificationCases,
  citizenVerificationVotes,
  resolutionDecisions,
  impactAttributions,
  auditLogs,
  VerificationCase,
  CitizenVerificationVote,
  users,
} from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { isUserMemberOfOrg } from "./service";
import { calculateGeodesicDistanceMeters } from "@/lib/pipeline/geo";
import { isTestEnvironment } from "@/lib/auth/clerk-config";

export interface OpenVerificationCaseInput {
  resolutionClaimId: string;
  durationHours?: number;
  minimumParticipation?: number;
  consensusThresholdPct?: number;
}

/**
 * Ensures user row exists in Postgres.
 */
async function ensureUserRowExists(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing && isTestEnvironment()) {
    await db
      .insert(users)
      .values({
        id: userId,
        email: `${userId}@test.invalid`,
        fullName: userId,
        role: "citizen",
      })
      .onConflictDoNothing();
  }
}

/**
 * Opens a time-boxed Verification Case for citizen voting upon valid claim review.
 */
export async function openVerificationCase(
  input: OpenVerificationCaseInput,
): Promise<VerificationCase> {
  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.id, input.resolutionClaimId))
    .limit(1);

  if (!claim) {
    throw new Error("Resolution claim not found.");
  }

  // Check if case already exists
  const [existingCase] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.resolutionClaimId, input.resolutionClaimId))
    .limit(1);

  if (existingCase) {
    return existingCase;
  }

  const hours = input.durationHours || 72;
  const closesAt = new Date(Date.now() + hours * 3600 * 1000);

  const [newCase] = await db
    .insert(verificationCases)
    .values({
      resolutionClaimId: claim.id,
      incidentId: claim.incidentId,
      status: "opened",
      closesAt,
      minimumParticipation: input.minimumParticipation || 3,
      consensusThresholdPct: (input.consensusThresholdPct || 75.0).toString(),
      policyVersion: "v1.0",
    })
    .returning();

  if (!newCase) {
    throw new Error("Failed to open verification case.");
  }

  await db
    .update(resolutionClaims)
    .set({
      status: "under_verification",
      updatedAt: new Date(),
    })
    .where(eq(resolutionClaims.id, claim.id));

  await db.insert(auditLogs).values({
    actorUserId: claim.submittedByUserId,
    actorOrganizationId: claim.organizationId,
    entityType: "case",
    entityId: newCase.id,
    action: "VERIFICATION_CASE_OPENED",
    beforeSummary: null,
    afterSummary: JSON.stringify({ closesAt, minParticipation: newCase.minimumParticipation }),
    reason: "Opened citizen verification voting window",
  });

  return newCase;
}

export interface CastCitizenVoteInput {
  verificationCaseId: string;
  userId: string;
  vote: "RESOLVED" | "NOT_RESOLVED" | "CANNOT_VERIFY";
  explanation?: string;
  evidenceUrl?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Casts a citizen verification vote.
 * Invariant 1: Authenticated voter required.
 * Invariant 2: 1 vote per user ID (enforced in DB + checked here).
 * Invariant 3: Anti-conflict-of-interest - organization members cannot vote on their own claims!
 */
export async function castCitizenVote(
  input: CastCitizenVoteInput,
): Promise<CitizenVerificationVote> {
  if (!input.userId) {
    throw new Error("Authentication required: Anonymous voting is prohibited.");
  }

  await ensureUserRowExists(input.userId);

  const [vCase] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.verificationCaseId))
    .limit(1);

  if (!vCase) {
    throw new Error("Verification case not found.");
  }

  if (vCase.status !== "opened") {
    throw new Error(`Verification case is closed (status: ${vCase.status}). Voting is not permitted.`);
  }

  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.id, vCase.resolutionClaimId))
    .limit(1);

  // Anti-conflict-of-interest check: member of claiming organization cannot vote
  if (claim?.organizationId) {
    const isMember = await isUserMemberOfOrg(input.userId, claim.organizationId);
    if (isMember) {
      throw new Error(
        "Conflict of interest: Members of the claiming organization are prohibited from voting on their own claims.",
      );
    }
  }

  // 1-vote-per-user check
  const [existingVote] = await db
    .select()
    .from(citizenVerificationVotes)
    .where(
      and(
        eq(citizenVerificationVotes.verificationCaseId, input.verificationCaseId),
        eq(citizenVerificationVotes.userId, input.userId),
      ),
    )
    .limit(1);

  if (existingVote) {
    throw new Error("Duplicate vote rejected: You have already voted on this verification case.");
  }

  // Geodesic distance calculation if coordinates provided
  let distanceMeters: number | null = null;
  let isLocal = true;

  if (input.latitude !== undefined && input.longitude !== undefined) {
    const [inc] = await db
      .select({ lat: incidents.latitude, lng: incidents.longitude })
      .from(incidents)
      .where(eq(incidents.id, vCase.incidentId))
      .limit(1);

    if (inc && inc.lat && inc.lng) {
      distanceMeters = calculateGeodesicDistanceMeters(
        input.latitude,
        input.longitude,
        parseFloat(inc.lat),
        parseFloat(inc.lng),
      );
      isLocal = distanceMeters <= 5000; // Local within 5km
    }
  }

  const [voteRow] = await db
    .insert(citizenVerificationVotes)
    .values({
      verificationCaseId: input.verificationCaseId,
      userId: input.userId,
      vote: input.vote,
      explanation: input.explanation || null,
      evidenceUrl: input.evidenceUrl || null,
      isLocalResident: isLocal,
      distanceMeters: distanceMeters !== null ? distanceMeters.toFixed(2) : null,
    })
    .returning();

  if (!voteRow) {
    throw new Error("Failed to record vote.");
  }

  return voteRow;
}

/**
 * Finalizes verification case and records immutable decision.
 * Evaluates:
 * 1. Exclusion of CANNOT_VERIFY from decisive vote denominator.
 * 2. Minimum participation threshold.
 * 3. Consensus threshold (>= 75%).
 * 4. High-risk statutory municipal inspection requirement.
 */
export async function finalizeVerificationCase(input: {
  verificationCaseId: string;
  finalizedBy?: string;
  forceOutcome?: "verified_resolved" | "not_verified" | "disputed";
  overrideReason?: string;
}) {
  const [vCase] = await db
    .select()
    .from(verificationCases)
    .where(eq(verificationCases.id, input.verificationCaseId))
    .limit(1);

  if (!vCase) {
    throw new Error("Verification case not found.");
  }

  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.id, vCase.resolutionClaimId))
    .limit(1);

  if (!claim) {
    throw new Error("Associated resolution claim not found.");
  }

  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, vCase.incidentId))
    .limit(1);

  // Collect votes
  const allVotes = await db
    .select()
    .from(citizenVerificationVotes)
    .where(eq(citizenVerificationVotes.verificationCaseId, vCase.id));

  let resolvedCount = 0;
  let notResolvedCount = 0;
  let cannotVerifyCount = 0;

  for (const v of allVotes) {
    if (v.vote === "RESOLVED") resolvedCount++;
    else if (v.vote === "NOT_RESOLVED") notResolvedCount++;
    else if (v.vote === "CANNOT_VERIFY") cannotVerifyCount++;
  }

  // PRD §29.3: CANNOT_VERIFY is strictly excluded from decisive ratio
  const decisiveCount = resolvedCount + notResolvedCount;
  const consensusPct = decisiveCount > 0 ? (resolvedCount / decisiveCount) * 100 : 0;
  const threshold = parseFloat(vCase.consensusThresholdPct);

  let outcome: "verified_resolved" | "not_verified" | "inconclusive" | "disputed" = "not_verified";
  let reason = "";

  if (input.forceOutcome) {
    outcome = input.forceOutcome;
    reason = input.overrideReason || `Procedural override by ${input.finalizedBy || "moderator"}`;
  } else {
    // 1. Check minimum participation
    if (decisiveCount < vCase.minimumParticipation) {
      outcome = "inconclusive";
      reason = `Insufficient participation: received ${decisiveCount} decisive vote(s) (minimum required: ${vCase.minimumParticipation}).`;
    } else if (consensusPct >= threshold) {
      // 2. Positive consensus reached - check high-risk official inspection
      if (claim.requiresOfficialInspection && !claim.officialInspectionCompleted) {
        outcome = "not_verified";
        reason =
          "High-risk municipal infrastructure repair cannot be accepted without certified statutory inspection sign-off, despite positive citizen voting.";
      } else {
        outcome = "verified_resolved";
        reason = `Consensus achieved: ${consensusPct.toFixed(1)}% decisive approval across ${decisiveCount} votes (threshold: ${threshold}%).`;
      }
    } else {
      outcome = "not_verified";
      reason = `Consensus not reached: ${consensusPct.toFixed(1)}% decisive approval (threshold: ${threshold}%).`;
    }
  }

  const now = new Date();

  // Update verification case
  const [updatedCase] = await db
    .update(verificationCases)
    .set({
      status: outcome === "verified_resolved" ? "finalized" : outcome,
      finalOutcome: outcome,
      finalizedAt: now,
      finalizedBy: input.finalizedBy || "system_consensus",
    })
    .where(eq(verificationCases.id, vCase.id))
    .returning();

  if (!updatedCase) {
    throw new Error("Failed to update verification case.");
  }

  // Update claim status
  await db
    .update(resolutionClaims)
    .set({
      status: outcome,
      finalizedAt: now,
      updatedAt: now,
    })
    .where(eq(resolutionClaims.id, claim.id));

  // Record resolution decision
  const [decision] = await db
    .insert(resolutionDecisions)
    .values({
      resolutionClaimId: claim.id,
      verificationCaseId: vCase.id,
      outcome,
      decisionReason: reason,
      decidedBy: input.finalizedBy || "system_consensus",
      policyVersion: vCase.policyVersion,
      evidenceSummary: {
        requiresOfficialInspection: claim.requiresOfficialInspection,
        officialInspectionCompleted: claim.officialInspectionCompleted,
      },
      citizenVotesSnapshot: {
        totalVotes: allVotes.length,
        resolvedCount,
        notResolvedCount,
        cannotVerifyCount,
        decisiveCount,
        consensusPct,
      },
      decidedAt: now,
    })
    .returning();

  if (!decision) {
    throw new Error("Failed to record resolution decision.");
  }

  // If approved, update incident to resolved and record impact attribution
  if (outcome === "verified_resolved") {
    await db
      .update(incidents)
      .set({
        status: "resolved",
        resolutionVotesCount: resolvedCount,
        updatedAt: now,
      })
      .where(eq(incidents.id, vCase.incidentId));

    if (claim.organizationId) {
      // Determine attribution role
      const [adoption] = claim.problemAdoptionId
        ? await db
            .select()
            .from(problemAdoptions)
            .where(eq(problemAdoptions.id, claim.problemAdoptionId))
            .limit(1)
        : [null];

      const role = (adoption?.proposedRole?.toUpperCase() || "IMPLEMENTER") as
        | "FUNDER"
        | "IMPLEMENTER"
        | "TECHNICAL_PARTNER"
        | "GOVERNMENT_AUTHORITY";

      await db
        .insert(impactAttributions)
        .values({
          incidentId: vCase.incidentId,
          resolutionClaimId: claim.id,
          organizationId: claim.organizationId,
          role,
          classification: "PRIVATE_LED",
          contributionDescription: claim.claimDescription,
          status: "verified",
          reviewedBy: input.finalizedBy || "verification_consensus",
        })
        .returning();
    }
  }

  await db.insert(auditLogs).values({
    actorUserId: input.finalizedBy || null,
    actorOrganizationId: claim.organizationId,
    entityType: "case",
    entityId: vCase.id,
    action: `VERIFICATION_CASE_${outcome.toUpperCase()}`,
    beforeSummary: JSON.stringify({ previousStatus: vCase.status }),
    afterSummary: JSON.stringify({ outcome, reason, decisiveCount, consensusPct }),
    reason,
  });

  return {
    verificationCase: updatedCase,
    decision,
    outcome,
    decisiveCount,
    consensusPct,
    reason,
  };
}

/**
 * Appeals a rejected or inconclusive resolution claim with supplementary evidence.
 * PRD §29.7: Previous decisions and history are preserved; decision is not deleted.
 */
export async function appealResolutionClaim(input: {
  claimId: string;
  organizationId: string;
  userId: string;
  appealReason: string;
  supplementaryEvidenceUrl?: string;
}) {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of this organization.");
  }

  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(
      and(
        eq(resolutionClaims.id, input.claimId),
        eq(resolutionClaims.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!claim) {
    throw new Error("Claim not found or does not belong to this organization.");
  }

  // Update claim status to disputed/appealed
  const [updatedClaim] = await db
    .update(resolutionClaims)
    .set({
      status: "disputed",
      initialReviewNotes: `Appealed by organization: ${input.appealReason}`,
      updatedAt: new Date(),
    })
    .where(eq(resolutionClaims.id, input.claimId))
    .returning();

  if (!updatedClaim) {
    throw new Error("Failed to update claim on appeal.");
  }

  if (input.supplementaryEvidenceUrl) {
    await db.insert(resolutionEvidence).values({
      resolutionClaimId: claim.id,
      evidenceType: "inspection_report",
      mediaUrl: input.supplementaryEvidenceUrl,
      description: `Appeal supplementary evidence: ${input.appealReason}`,
      capturedAt: new Date(),
      visibility: "public",
      reviewStatus: "pending",
    });
  }

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "claim",
    entityId: input.claimId,
    action: "CLAIM_APPEALED",
    beforeSummary: JSON.stringify({ previousStatus: claim.status }),
    afterSummary: JSON.stringify({ newStatus: "disputed", reason: input.appealReason }),
    reason: input.appealReason,
  });

  return updatedClaim;
}
