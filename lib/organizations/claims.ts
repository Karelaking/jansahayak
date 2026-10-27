import {
  db,
  isDatabaseReachable,
  incidents,
  problemAdoptions,
  organizations,
  resolutionClaims,
  resolutionEvidence,
  auditLogs,
  ResolutionClaim,
  ResolutionEvidence,
  users,
} from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { isUserMemberOfOrg } from "./service";
import { getCategoryPermissions } from "./adoptions";
import { isTestEnvironment } from "@/lib/auth/clerk-config";

export interface SubmitResolutionClaimInput {
  incidentId: string;
  problemAdoptionId?: string;
  organizationId: string;
  submittedByUserId: string;
  claimDescription: string;
  evidenceItems?: Array<{
    evidenceType:
      | "photo_before"
      | "photo_after"
      | "video"
      | "completion_certificate"
      | "inspection_report"
      | "invoice_redacted"
      | "permit_noc";
    mediaUrl: string;
    description?: string;
    capturedAt?: Date;
    locationReference?: { latitude: number; longitude: number };
    visibility?: "public" | "internal" | "moderator_only";
  }>;
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
        role: "org_member",
      })
      .onConflictDoNothing();
  }
}

/**
 * Submits a formal Resolution Claim asserting completion of the civic problem.
 * Invariant: Organization must be verified.
 * Invariant: High-risk engineering work triggers requiresOfficialInspection = true.
 */
export async function submitResolutionClaim(
  input: SubmitResolutionClaimInput,
): Promise<{ claim: ResolutionClaim; evidence: ResolutionEvidence[] }> {
  await ensureUserRowExists(input.submittedByUserId);

  const isMember = await isUserMemberOfOrg(input.submittedByUserId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of the claiming organization.");
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  if (!org || org.verificationStatus !== "verified") {
    throw new Error("Only verified organizations can submit official resolution claims.");
  }

  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, input.incidentId))
    .limit(1);

  if (!incident) {
    throw new Error("Incident not found.");
  }

  // Determine if this is a high-risk category needing municipal engineering inspection
  const permissions = getCategoryPermissions(incident.category);
  const requiresOfficialInspection = permissions.riskLevel === "high";

  const [claim] = await db
    .insert(resolutionClaims)
    .values({
      incidentId: input.incidentId,
      problemAdoptionId: input.problemAdoptionId || null,
      organizationId: input.organizationId,
      submittedByUserId: input.submittedByUserId,
      claimDescription: input.claimDescription,
      status: "submitted",
      requiresOfficialInspection,
      officialInspectionCompleted: false,
    })
    .returning();

  if (!claim) {
    throw new Error("Failed to create resolution claim.");
  }

  const evidenceRecords: ResolutionEvidence[] = [];

  if (input.evidenceItems && input.evidenceItems.length > 0) {
    for (const item of input.evidenceItems) {
      if (!item.mediaUrl) continue;
      const [ev] = await db
        .insert(resolutionEvidence)
        .values({
          resolutionClaimId: claim.id,
          evidenceType: item.evidenceType,
          mediaUrl: item.mediaUrl,
          description: item.description || null,
          capturedAt: item.capturedAt || new Date(),
          locationReference: item.locationReference || null,
          visibility: item.visibility || "public",
          reviewStatus: "pending",
        })
        .returning();
      if (ev) evidenceRecords.push(ev);
    }
  }

  await db.insert(auditLogs).values({
    actorUserId: input.submittedByUserId,
    actorOrganizationId: input.organizationId,
    entityType: "claim",
    entityId: claim.id,
    action: "RESOLUTION_CLAIM_SUBMITTED",
    beforeSummary: null,
    afterSummary: JSON.stringify({
      claimId: claim.id,
      incidentId: input.incidentId,
      requiresOfficialInspection,
      evidenceCount: evidenceRecords.length,
    }),
    reason: "Submitted resolution claim with evidence",
  });

  return { claim, evidence: evidenceRecords };
}

/**
 * Retrieves a resolution claim and its evidence.
 * PRD §34 / Test Scenario 16: Tenant isolation - non-public evidence (internal/moderator_only)
 * is hidden from callers not belonging to the claiming organization or staff.
 */
export async function getResolutionClaimById(
  claimId: string,
  callerContext?: { userId?: string; userRole?: string; organizationId?: string },
) {
  if (!(await isDatabaseReachable())) return null;
  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.id, claimId))
    .limit(1);

  if (!claim) return null;

  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, claim.incidentId))
    .limit(1);

  const org = claim.organizationId
    ? (await db.select().from(organizations).where(eq(organizations.id, claim.organizationId)).limit(1))[0]
    : null;

  const allEvidence = await db
    .select()
    .from(resolutionEvidence)
    .where(eq(resolutionEvidence.resolutionClaimId, claimId))
    .orderBy(resolutionEvidence.createdAt);

  const isStaff = callerContext?.userRole === "admin" || callerContext?.userRole === "moderator";
  const isOwnerOrg =
    callerContext?.organizationId && claim.organizationId && callerContext.organizationId === claim.organizationId;

  // Filter evidence based on permissions
  const safeEvidence = allEvidence.filter((ev) => {
    if (ev.visibility === "public") return true;
    if (isStaff) return true;
    if (isOwnerOrg) return true;
    return false; // Deny access to other organizations
  });

  return {
    claim,
    incident,
    organization: org,
    evidence: safeEvidence,
  };
}

/**
 * Attaches additional evidence to an existing claim.
 */
export async function addResolutionEvidence(input: {
  resolutionClaimId: string;
  organizationId: string;
  userId: string;
  evidenceType:
    | "photo_before"
    | "photo_after"
    | "video"
    | "completion_certificate"
    | "inspection_report"
    | "invoice_redacted"
    | "permit_noc";
  mediaUrl: string;
  description?: string;
  capturedAt?: Date;
  locationReference?: { latitude: number; longitude: number };
  visibility?: "public" | "internal" | "moderator_only";
}): Promise<ResolutionEvidence> {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of this organization.");
  }

  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(
      and(
        eq(resolutionClaims.id, input.resolutionClaimId),
        eq(resolutionClaims.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!claim) {
    throw new Error("Resolution claim not found or does not belong to this organization.");
  }

  const [ev] = await db
    .insert(resolutionEvidence)
    .values({
      resolutionClaimId: input.resolutionClaimId,
      evidenceType: input.evidenceType,
      mediaUrl: input.mediaUrl,
      description: input.description || null,
      capturedAt: input.capturedAt || new Date(),
      locationReference: input.locationReference || null,
      visibility: input.visibility || "public",
      reviewStatus: "pending",
    })
    .returning();

  if (!ev) {
    throw new Error("Failed to attach evidence.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "evidence",
    entityId: ev.id,
    action: "EVIDENCE_ATTACHED",
    beforeSummary: null,
    afterSummary: JSON.stringify({ type: input.evidenceType, visibility: input.visibility }),
    reason: "Attached resolution evidence",
  });

  return ev;
}

/**
 * Updates initial review or official inspection status on a claim.
 */
export async function updateClaimReview(input: {
  claimId: string;
  reviewerId: string;
  status:
    | "draft"
    | "submitted"
    | "initial_review"
    | "needs_more_evidence"
    | "ready_for_verification"
    | "under_verification"
    | "verified_resolved"
    | "not_verified"
    | "disputed"
    | "revoked";
  initialReviewNotes?: string;
  officialInspectionCompleted?: boolean;
  officialInspectionNotes?: string;
}): Promise<ResolutionClaim> {
  const [claim] = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.id, input.claimId))
    .limit(1);

  if (!claim) {
    throw new Error("Resolution claim not found.");
  }

  const [updated] = await db
    .update(resolutionClaims)
    .set({
      status: input.status,
      initialReviewerId: input.reviewerId,
      initialReviewNotes: input.initialReviewNotes || claim.initialReviewNotes,
      officialInspectionCompleted:
        input.officialInspectionCompleted !== undefined
          ? input.officialInspectionCompleted
          : claim.officialInspectionCompleted,
      officialInspectionNotes: input.officialInspectionNotes || claim.officialInspectionNotes,
      updatedAt: new Date(),
    })
    .where(eq(resolutionClaims.id, input.claimId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update claim review.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.reviewerId,
    actorOrganizationId: claim.organizationId,
    entityType: "claim",
    entityId: input.claimId,
    action: `CLAIM_REVIEW_${input.status.toUpperCase()}`,
    beforeSummary: JSON.stringify({ previousStatus: claim.status }),
    afterSummary: JSON.stringify({
      newStatus: input.status,
      officialInspectionCompleted: updated.officialInspectionCompleted,
    }),
    reason: input.initialReviewNotes || "Claim review status update",
  });

  return updated;
}
