import {
  db,
  isDatabaseReachable,
  organizations,
  organizationMembers,
  organizationVerifications,
  auditLogs,
  Organization,
  NewOrganization,
  OrganizationMember,
  users,
} from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { isTestEnvironment } from "@/lib/auth/clerk-config";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface RegisterOrganizationInput {
  legalName: string;
  displayName: string;
  organizationType: "corporate" | "ngo" | "foundation" | "contractor" | "institution" | "other";
  registrationNumber?: string;
  contactEmail: string;
  contactPhone?: string;
  publicDescription?: string;
  websiteUrl?: string;
  operatingLocations?: string[];
  focusAreas?: string[];
  ownerUserId: string;
}

/**
 * Ensures user exists in Postgres so foreign key constraints pass, especially in tests.
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
        role: "org_admin",
      })
      .onConflictDoNothing();
  }
}

/**
 * Registers a new organization and assigns the registering user as org_admin.
 */
export async function registerOrganization(
  input: RegisterOrganizationInput,
): Promise<{ organization: Organization; member: OrganizationMember }> {
  if (!input.legalName || !input.displayName || !input.contactEmail) {
    throw new Error("Missing mandatory organization fields: legalName, displayName, contactEmail.");
  }

  await ensureUserRowExists(input.ownerUserId);

  let baseSlug = slugify(input.displayName) || "org";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.publicProfileSlug, slug))
      .limit(1);

    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      legalName: input.legalName,
      displayName: input.displayName,
      organizationType: input.organizationType,
      registrationNumber: input.registrationNumber || null,
      verificationStatus: "pending_verification",
      publicProfileSlug: slug,
      publicDescription: input.publicDescription || null,
      websiteUrl: input.websiteUrl || null,
      operatingLocations: input.operatingLocations || [],
      focusAreas: input.focusAreas || [],
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone || null,
    })
    .returning();

  if (!org) {
    throw new Error("Failed to register organization.");
  }

  const [member] = await db
    .insert(organizationMembers)
    .values({
      organizationId: org.id,
      userId: input.ownerUserId,
      role: "org_admin",
      status: "active",
    })
    .returning();

  if (!member) {
    throw new Error("Failed to create organization membership.");
  }

  await db.insert(auditLogs).values({
    actorUserId: input.ownerUserId,
    actorOrganizationId: org.id,
    entityType: "organization",
    entityId: org.id,
    action: "ORGANIZATION_REGISTERED",
    beforeSummary: null,
    afterSummary: JSON.stringify({
      id: org.id,
      legalName: org.legalName,
      verificationStatus: org.verificationStatus,
    }),
    reason: "New organization registration submitted",
  });

  return { organization: org, member };
}

/**
 * Retrieves organization by its primary UUID.
 */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!(await isDatabaseReachable())) return null;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return org || null;
}

/**
 * Retrieves organization by public URL slug.
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!(await isDatabaseReachable())) return null;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.publicProfileSlug, slug))
    .limit(1);
  return org || null;
}

/**
 * Retrieves the organization that a user belongs to.
 */
export async function getUserOrganization(
  userId: string,
): Promise<{ organization: Organization; membership: OrganizationMember } | null> {
  if (!(await isDatabaseReachable())) return null;
  const [row] = await db
    .select({
      org: organizations,
      member: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")))
    .limit(1);

  if (!row) return null;
  return { organization: row.org, membership: row.member };
}

/**
 * Checks whether a given user is an active member of an organization, optionally checking role.
 */
export async function isUserMemberOfOrg(
  userId: string,
  organizationId: string,
  allowedRoles?: string[],
): Promise<boolean> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
      ),
    )
    .limit(1);

  if (!member) return false;
  if (allowedRoles && allowedRoles.length > 0) {
    return allowedRoles.includes(member.role);
  }
  return true;
}

/**
 * Submits compliance and verification documents for platform review.
 */
export async function submitOrganizationVerification(input: {
  organizationId: string;
  userId: string;
  documents: Array<{ type: string; url: string; name: string }>;
}): Promise<void> {
  const isMember = await isUserMemberOfOrg(input.userId, input.organizationId, ["org_admin"]);
  if (!isMember) {
    throw new Error("Unauthorized: Only org_admin can submit verification documents.");
  }

  await db.insert(organizationVerifications).values({
    organizationId: input.organizationId,
    status: "submitted",
    documents: input.documents,
    submittedAt: new Date(),
  });

  await db
    .update(organizations)
    .set({
      verificationStatus: "pending_verification",
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId));

  await db.insert(auditLogs).values({
    actorUserId: input.userId,
    actorOrganizationId: input.organizationId,
    entityType: "organization",
    entityId: input.organizationId,
    action: "VERIFICATION_DOCUMENTS_SUBMITTED",
    beforeSummary: null,
    afterSummary: JSON.stringify({ documentCount: input.documents.length }),
    reason: "Submitted verification evidence documents",
  });
}

/**
 * Platform Administrator review of an organization's verification.
 */
export async function reviewOrganizationVerification(input: {
  organizationId: string;
  reviewerId: string;
  status: "verified" | "rejected" | "needs_more_information";
  decisionReason: string;
}): Promise<Organization> {
  const org = await getOrganizationById(input.organizationId);
  if (!org) {
    throw new Error("Organization not found.");
  }

  const [updated] = await db
    .update(organizations)
    .set({
      verificationStatus: input.status,
      verifiedAt: input.status === "verified" ? new Date() : null,
      verifiedBy: input.status === "verified" ? input.reviewerId : null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update organization status.");
  }

  await db
    .update(organizationVerifications)
    .set({
      status: input.status === "verified" ? "approved" : input.status === "rejected" ? "rejected" : "needs_info",
      decisionReason: input.decisionReason,
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(organizationVerifications.organizationId, input.organizationId));

  await db.insert(auditLogs).values({
    actorUserId: input.reviewerId,
    actorOrganizationId: input.organizationId,
    entityType: "organization",
    entityId: input.organizationId,
    action: `ORGANIZATION_${input.status.toUpperCase()}`,
    beforeSummary: JSON.stringify({ previousStatus: org.verificationStatus }),
    afterSummary: JSON.stringify({ newStatus: input.status, reason: input.decisionReason }),
    reason: input.decisionReason,
  });

  return updated;
}

/**
 * Lists organizations with optional filtering.
 */
export async function listOrganizations(filter?: {
  verificationStatus?: string;
  limit?: number;
}): Promise<Organization[]> {
  if (!(await isDatabaseReachable())) return [];
  const query = db.select().from(organizations);
  if (filter?.verificationStatus) {
    return query
      .where(eq(organizations.verificationStatus, filter.verificationStatus))
      .orderBy(desc(organizations.createdAt))
      .limit(filter.limit || 50);
  }
  return query.orderBy(desc(organizations.createdAt)).limit(filter?.limit || 50);
}
