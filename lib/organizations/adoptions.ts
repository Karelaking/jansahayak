import {
  db,
  isDatabaseReachable,
  incidents,
  problemAdoptions,
  projectMilestones,
  organizations,
  auditLogs,
  Incident,
  ProblemAdoption,
  ProjectMilestone,
} from "@/lib/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { isUserMemberOfOrg } from "./service";

export interface PermissionRequirements {
  requiresNoc: boolean;
  statutoryAuthority: string;
  requirements: string[];
  riskLevel: "low" | "medium" | "high";
}

/**
 * Determines municipal permission requirements and risk level based on civic incident category.
 * PRD §25.2, §29.5: High-risk road surface & structural work requires statutory sign-off.
 */
export function getCategoryPermissions(category: string): PermissionRequirements {
  const cat = (category || "").toLowerCase();

  if (cat.includes("pothole") || cat.includes("road") || cat.includes("bridge") || cat.includes("structural")) {
    return {
      requiresNoc: true,
      statutoryAuthority: "Public Works Department (PWD) / Development Authority",
      requirements: [
        "PWD Road Excavation / Trenching NOC",
        "Traffic Police Diversion Clearance",
        "Certified Road Contractor Sign-off",
      ],
      riskLevel: "high",
    };
  }

  if (cat.includes("drainage") || cat.includes("sewage") || cat.includes("water")) {
    return {
      requiresNoc: true,
      statutoryAuthority: "Jal Board / Municipal Water & Sanitation Authority",
      requirements: [
        "Underground Utility Mapping Clearance",
        "Municipal Drainage Cell Permission",
      ],
      riskLevel: "high",
    };
  }

  if (cat.includes("electricity") || cat.includes("street_light") || cat.includes("transformer")) {
    return {
      requiresNoc: true,
      statutoryAuthority: "Electricity Distribution Corporation (DISCOM)",
      requirements: [
        "DISCOM Isolation & Work Permit",
        "Licensed Electrical Contractor Certification",
      ],
      riskLevel: "high",
    };
  }

  if (cat.includes("garbage") || cat.includes("waste") || cat.includes("dump")) {
    return {
      requiresNoc: false,
      statutoryAuthority: "Municipal Health & Sanitation Wing",
      requirements: [
        "Designated Landfill Dumping Slip",
        "Sanitation Cell Prior Intimation",
      ],
      riskLevel: "low",
    };
  }

  return {
    requiresNoc: false,
    statutoryAuthority: "Local Municipal Corporation Ward Office",
    requirements: ["Ward Supervisor Intimation"],
    riskLevel: "medium",
  };
}

export interface DiscoverProblemsFilter {
  category?: string;
  sector?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Browses published, eligible civic problems seeking intervention.
 * Invariant: Excludes already resolved incidents.
 */
export async function discoverCivicProblems(filter?: DiscoverProblemsFilter) {
  const page = Math.max(1, filter?.page || 1);
  const limit = Math.min(50, Math.max(1, filter?.limit || 20));
  const offset = (page - 1) * limit;

  if (!(await isDatabaseReachable())) {
    return {
      problems: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  // Published incidents that are not resolved
  const query = db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.isPublished, true),
        eq(incidents.moderationStatus, "approved"),
        sql`${incidents.status} != 'resolved'`,
        filter?.category ? eq(incidents.category, filter.category) : undefined,
      ),
    )
    .orderBy(desc(incidents.createdAt))
    .limit(limit)
    .offset(offset);

  const incidentRows = await query;

  // Retrieve active adoption counts for these incidents to show multi-proposal interest
  const incidentIds = incidentRows.map((i) => i.id);
  const adoptionCounts: Record<string, number> = {};

  if (incidentIds.length > 0) {
    const counts = await db
      .select({
        incidentId: problemAdoptions.incidentId,
        count: sql<number>`count(*)::int`,
      })
      .from(problemAdoptions)
      .where(inArray(problemAdoptions.incidentId, incidentIds))
      .groupBy(problemAdoptions.incidentId);

    for (const c of counts) {
      adoptionCounts[c.incidentId] = Number(c.count);
    }
  }

  const enriched = incidentRows.map((inc) => ({
    ...inc,
    permissions: getCategoryPermissions(inc.category),
    activeAdoptionCount: adoptionCounts[inc.id] || 0,
    isHighRisk: getCategoryPermissions(inc.category).riskLevel === "high",
  }));

  return {
    page,
    limit,
    items: enriched,
  };
}

export interface CreateAdoptionProposalInput {
  incidentId: string;
  organizationId: string;
  userId: string;
  proposedRole: "funder" | "implementer" | "technical_partner" | "joint_partner" | "coordinator";
  proposalDescription: string;
  scope: string;
  estimatedCost?: number;
  currency?: string;
  proposedDeadline?: Date;
}

/**
 * Submits an adoption proposal for an eligible civic incident.
 * INVARIANT: Organization MUST be verified. Unverified orgs cannot adopt problems.
 * INVARIANT: Adoption does NOT resolve incident!
 */
export async function createAdoptionProposal(
  input: CreateAdoptionProposalInput,
): Promise<ProblemAdoption> {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of this organization.");
  }

  // 1. Check organization verification status
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found.");
  }

  if (org.verificationStatus !== "verified") {
    throw new Error(
      `Organization cannot adopt problems: Verification status is '${org.verificationStatus}'. Only verified organizations may adopt civic problems.`,
    );
  }

  // 2. Check incident status
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, input.incidentId))
    .limit(1);

  if (!incident) {
    throw new Error("Incident not found.");
  }

  if (incident.status === "resolved") {
    throw new Error("This incident is already resolved and is no longer open for adoption.");
  }

  const [proposal] = await db
    .insert(problemAdoptions)
    .values({
      incidentId: input.incidentId,
      organizationId: input.organizationId,
      proposedRole: input.proposedRole,
      proposalDescription: input.proposalDescription,
      scope: input.scope,
      estimatedCost: input.estimatedCost ? input.estimatedCost.toString() : null,
      currency: input.currency || "INR",
      proposedDeadline: input.proposedDeadline || null,
      status: "proposal_submitted",
    })
    .returning();

  if (!proposal) {
    throw new Error("Failed to create adoption proposal.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "adoption",
    entityId: proposal.id,
    action: "ADOPTION_PROPOSAL_SUBMITTED",
    beforeSummary: null,
    afterSummary: JSON.stringify({
      adoptionId: proposal.id,
      incidentId: input.incidentId,
      role: input.proposedRole,
      scope: input.scope,
    }),
    reason: "Submitted civic problem adoption proposal",
  });

  return proposal;
}

/**
 * Retrieves all adoptions belonging to an organization.
 */
export async function getAdoptionsByOrganization(organizationId: string) {
  if (!(await isDatabaseReachable())) return [];
  const rows = await db
    .select({
      adoption: problemAdoptions,
      incident: incidents,
    })
    .from(problemAdoptions)
    .innerJoin(incidents, eq(problemAdoptions.incidentId, incidents.id))
    .where(eq(problemAdoptions.organizationId, organizationId))
    .orderBy(desc(problemAdoptions.createdAt));

  return rows;
}

/**
 * Retrieves detailed adoption information including milestones and incident.
 */
export async function getAdoptionById(adoptionId: string) {
  if (!(await isDatabaseReachable())) return null;
  const [row] = await db
    .select({
      adoption: problemAdoptions,
      incident: incidents,
      organization: organizations,
    })
    .from(problemAdoptions)
    .innerJoin(incidents, eq(problemAdoptions.incidentId, incidents.id))
    .innerJoin(organizations, eq(problemAdoptions.organizationId, organizations.id))
    .where(eq(problemAdoptions.id, adoptionId))
    .limit(1);

  if (!row) return null;

  const milestones = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.problemAdoptionId, adoptionId))
    .orderBy(projectMilestones.createdAt);

  return {
    ...row,
    milestones,
    permissions: getCategoryPermissions(row.incident.category),
  };
}

/**
 * Updates an adoption proposal's review status.
 */
export async function updateAdoptionStatus(input: {
  adoptionId: string;
  status:
    | "proposal_submitted"
    | "under_review"
    | "needs_changes"
    | "approved"
    | "rejected"
    | "in_progress"
    | "completed"
    | "withdrawn"
    | "expired"
    | "on_hold";
  reviewerUserId?: string;
  rejectionReason?: string;
}) {
  const [existing] = await db
    .select()
    .from(problemAdoptions)
    .where(eq(problemAdoptions.id, input.adoptionId))
    .limit(1);

  if (!existing) {
    throw new Error("Adoption record not found.");
  }

  const [updated] = await db
    .update(problemAdoptions)
    .set({
      status: input.status,
      approvedBy: input.status === "approved" ? input.reviewerUserId : existing.approvedBy,
      approvedAt: input.status === "approved" ? new Date() : existing.approvedAt,
      rejectionReason: input.rejectionReason || existing.rejectionReason,
      updatedAt: new Date(),
    })
    .where(eq(problemAdoptions.id, input.adoptionId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update adoption status.");
  }

  // If approved or in_progress, update incident status to in_progress
  if (input.status === "approved" || input.status === "in_progress") {
    await db
      .update(incidents)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, existing.incidentId), sql`${incidents.status} != 'resolved'`));
  }

  await db.insert(auditLogs).values({
    actorUserId: input.reviewerUserId || null,
    actorOrganizationId: existing.organizationId,
    entityType: "adoption",
    entityId: input.adoptionId,
    action: `ADOPTION_STATUS_${input.status.toUpperCase()}`,
    beforeSummary: JSON.stringify({ previousStatus: existing.status }),
    afterSummary: JSON.stringify({ newStatus: input.status, reason: input.rejectionReason }),
    reason: input.rejectionReason || `Status transitioned to ${input.status}`,
  });

  return updated;
}

/**
 * Withdraws an active adoption.
 * Invariant: Problem remains unresolved and can be adopted by others or managed by municipality.
 */
export async function withdrawAdoption(input: {
  adoptionId: string;
  organizationId: string;
  userId: string;
  reason: string;
}) {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId, ["org_admin", "project_manager"]);
  if (!isMember) {
    throw new Error("Unauthorized: Only org_admin or project_manager can withdraw an adoption.");
  }

  const [adoption] = await db
    .select()
    .from(problemAdoptions)
    .where(
      and(
        eq(problemAdoptions.id, input.adoptionId),
        eq(problemAdoptions.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!adoption) {
    throw new Error("Adoption not found or does not belong to this organization.");
  }

  const [updated] = await db
    .update(problemAdoptions)
    .set({
      status: "withdrawn",
      rejectionReason: input.reason,
      updatedAt: new Date(),
    })
    .where(eq(problemAdoptions.id, input.adoptionId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update adoption status.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "adoption",
    entityId: input.adoptionId,
    action: "ADOPTION_WITHDRAWN",
    beforeSummary: JSON.stringify({ previousStatus: adoption.status }),
    afterSummary: JSON.stringify({ newStatus: "withdrawn", reason: input.reason }),
    reason: input.reason,
  });

  return updated;
}

/**
 * Adds a project milestone.
 */
export async function addProjectMilestone(input: {
  adoptionId: string;
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  dueAt?: Date;
}): Promise<ProjectMilestone> {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of this organization.");
  }

  const [adoption] = await db
    .select()
    .from(problemAdoptions)
    .where(
      and(
        eq(problemAdoptions.id, input.adoptionId),
        eq(problemAdoptions.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!adoption) {
    throw new Error("Adoption not found or does not belong to this organization.");
  }

  const [milestone] = await db
    .insert(projectMilestones)
    .values({
      problemAdoptionId: input.adoptionId,
      title: input.title,
      description: input.description || null,
      dueAt: input.dueAt || null,
      status: "pending",
    })
    .returning();

  if (!milestone) {
    throw new Error("Failed to create milestone.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "milestone",
    entityId: milestone.id,
    action: "MILESTONE_CREATED",
    beforeSummary: null,
    afterSummary: JSON.stringify({ title: input.title }),
    reason: "Added project milestone",
  });

  return milestone;
}

/**
 * Updates a project milestone's status.
 */
export async function updateProjectMilestone(input: {
  milestoneId: string;
  organizationId: string;
  userId: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
  completedAt?: Date;
  evidenceReferences?: string[];
}): Promise<ProjectMilestone> {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId);
  if (!isMember) {
    throw new Error("Unauthorized: User is not an active member of this organization.");
  }

  const [milestone] = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.id, input.milestoneId))
    .limit(1);

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  const [updated] = await db
    .update(projectMilestones)
    .set({
      status: input.status,
      completedAt: input.status === "completed" ? (input.completedAt || new Date()) : null,
      evidenceReferences: input.evidenceReferences || milestone.evidenceReferences,
      updatedAt: new Date(),
    })
    .where(eq(projectMilestones.id, input.milestoneId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update milestone.");
  }

  return updated;
}
