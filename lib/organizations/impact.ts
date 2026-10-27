import {
  db,
  isDatabaseReachable,
  incidents,
  organizations,
  impactAttributions,
  resolutionClaims,
  resolutionEvidence,
  verificationCases,
  citizenVerificationVotes,
  problemAdoptions,
} from "@/lib/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export interface PublicImpactSummary {
  totalHazardsReported: number;
  totalResolvedUnique: number;
  totalInProgress: number;
  governmentLedResolutions: number;
  privateLedResolutions: number;
  jointResolutions: number;
  communityLedResolutions: number;
  totalPrivateEstimatedSpendInr: number;
  medianResolutionDays: number;
  deduplicationInvariantVerified: boolean;
}

/**
 * Calculates platform-wide deduplicated civic impact analytics.
 * PRD §31: Unique civic reports must never be double-counted in aggregate totals.
 */
export async function getPublicImpactSummary(filter?: {
  category?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<PublicImpactSummary> {
  if (!(await isDatabaseReachable())) {
    return {
      totalHazardsReported: 0,
      totalResolvedUnique: 0,
      totalInProgress: 0,
      governmentLedResolutions: 0,
      privateLedResolutions: 0,
      jointResolutions: 0,
      communityLedResolutions: 0,
      totalPrivateEstimatedSpendInr: 0,
      medianResolutionDays: 0,
      deduplicationInvariantVerified: true,
    };
  }

  // 1. Total incidents count
  const [totalRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      inProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      resolved: sql<number>`count(*) filter (where status = 'resolved')::int`,
    })
    .from(incidents)
    .where(
      and(
        filter?.category ? eq(incidents.category, filter.category) : undefined,
        filter?.startDate ? sql`${incidents.createdAt} >= ${filter.startDate}` : undefined,
        filter?.endDate ? sql`${incidents.createdAt} <= ${filter.endDate}` : undefined,
      ),
    );

  const totalHazardsReported = Number(totalRow?.total || 0);
  const totalInProgress = Number(totalRow?.inProgress || 0);
  const totalResolvedUnique = Number(totalRow?.resolved || 0);

  // 2. Multi-party attribution breakdown
  const attributions = await db
    .select({
      incidentId: impactAttributions.incidentId,
      classification: impactAttributions.classification,
    })
    .from(impactAttributions)
    .where(eq(impactAttributions.status, "verified"));

  // Track classification per incident to ensure deduplication
  const incidentClassificationMap = new Map<string, string>();
  for (const attr of attributions) {
    if (!incidentClassificationMap.has(attr.incidentId)) {
      incidentClassificationMap.set(attr.incidentId, attr.classification);
    } else {
      // If multiple contributors exist and one is Government / Private, classify as JOINT
      const existing = incidentClassificationMap.get(attr.incidentId);
      if (existing !== attr.classification) {
        incidentClassificationMap.set(attr.incidentId, "JOINT");
      }
    }
  }

  let privateLedResolutions = 0;
  let jointResolutions = 0;
  let communityLedResolutions = 0;

  for (const classification of incidentClassificationMap.values()) {
    if (classification === "PRIVATE_LED") privateLedResolutions++;
    else if (classification === "JOINT") jointResolutions++;
    else if (classification === "COMMUNITY_OR_OTHER") communityLedResolutions++;
  }

  // Any resolved incident not attributed to private/joint is government-led
  const governmentLedResolutions = Math.max(
    0,
    totalResolvedUnique - (privateLedResolutions + jointResolutions + communityLedResolutions),
  );

  // Invariant verification: Sum of classified items cannot exceed unique resolved count
  const deduplicationInvariantVerified =
    governmentLedResolutions + privateLedResolutions + jointResolutions + communityLedResolutions ===
    totalResolvedUnique;

  // 3. Total private investment / CSR spend from completed or approved adoptions
  const [spendRow] = await db
    .select({
      totalSpend: sql<number>`coalesce(sum(estimated_cost::numeric), 0)::float`,
    })
    .from(problemAdoptions)
    .where(inArray(problemAdoptions.status, ["approved", "in_progress", "completed"]));

  // 4. Median resolution duration
  const durationRes = await db.execute(sql`
    SELECT 
      COALESCE(
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0
        ), 
        3.5
      )::float as "medianDays"
    FROM incidents 
    WHERE status = 'resolved'
  `);

  const medianResolutionDays = Math.round(Number(durationRes.rows[0]?.medianDays || 3.5) * 10) / 10;

  return {
    totalHazardsReported,
    totalResolvedUnique,
    totalInProgress,
    governmentLedResolutions,
    privateLedResolutions,
    jointResolutions,
    communityLedResolutions,
    totalPrivateEstimatedSpendInr: Number(spendRow?.totalSpend || 0),
    medianResolutionDays,
    deduplicationInvariantVerified,
  };
}

/**
 * Public Resolution Dossier for /resolutions/:id
 * PRD §30.1: Displays original problem, before/after evidence slider, attribution cards,
 * citizen vote statistics, and strictly redacts PII.
 */
export async function getPublicResolutionDossier(incidentId: string) {
  if (!(await isDatabaseReachable())) {
    return null;
  }

  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) return null;

  // Attributions
  const attributions = await db
    .select({
      attribution: impactAttributions,
      organization: organizations,
    })
    .from(impactAttributions)
    .leftJoin(organizations, eq(impactAttributions.organizationId, organizations.id))
    .where(and(eq(impactAttributions.incidentId, incidentId), eq(impactAttributions.status, "verified")));

  // Claims & Evidence
  const claims = await db
    .select()
    .from(resolutionClaims)
    .where(eq(resolutionClaims.incidentId, incidentId));

  const claimIds = claims.map((c) => c.id);
  const evidenceList =
    claimIds.length > 0
      ? await db
          .select()
          .from(resolutionEvidence)
          .where(
            and(
              inArray(resolutionEvidence.resolutionClaimId, claimIds),
              eq(resolutionEvidence.visibility, "public"),
            ),
          )
      : [];

  // Verification case & citizen votes summary
  let consensusPercentage = 0;
  let totalDecisiveVotes = 0;
  let municipalInspectionVerified = false;

  if (claimIds.length > 0) {
    const [vCase] = await db
      .select()
      .from(verificationCases)
      .where(inArray(verificationCases.resolutionClaimId, claimIds))
      .orderBy(desc(verificationCases.createdAt))
      .limit(1);

    if (vCase) {
      const votes = await db
        .select()
        .from(citizenVerificationVotes)
        .where(eq(citizenVerificationVotes.verificationCaseId, vCase.id));

      let resolved = 0;
      let notResolved = 0;
      for (const v of votes) {
        if (v.vote === "RESOLVED") resolved++;
        if (v.vote === "NOT_RESOLVED") notResolved++;
      }
      totalDecisiveVotes = resolved + notResolved;
      consensusPercentage = totalDecisiveVotes > 0 ? (resolved / totalDecisiveVotes) * 100 : 0;
    }

    const verifiedClaim = claims.find((c) => c.officialInspectionCompleted);
    if (verifiedClaim) municipalInspectionVerified = true;
  }

  // Structure before and after photos
  const beforePhotos = evidenceList
    .filter((e) => e.evidenceType === "photo_before")
    .map((e) => ({ url: e.mediaUrl, description: e.description }));

  const afterPhotos = evidenceList
    .filter((e) => e.evidenceType === "photo_after")
    .map((e) => ({ url: e.mediaUrl, description: e.description }));

  // Sanitize and redact PII
  return {
    id: incident.id,
    incidentNumber: incident.incidentNumber,
    title: incident.title,
    summary: incident.summary,
    category: incident.category,
    severity: incident.severity,
    status: incident.status,
    sectorName: ((incident.metadata as Record<string, unknown>)?.sectorName as string) || "Noida / Greater Noida",
    latitude: incident.latitude ? parseFloat(incident.latitude) : null,
    longitude: incident.longitude ? parseFloat(incident.longitude) : null,
    createdAt: incident.createdAt,
    resolvedAt: incident.updatedAt,
    attributions: attributions.map((a) => ({
      role: a.attribution.role,
      classification: a.attribution.classification,
      description: a.attribution.contributionDescription,
      organizationName: a.organization?.displayName || "Civic Partner",
      organizationSlug: a.organization?.publicProfileSlug || null,
    })),
    beforePhotos,
    afterPhotos,
    citizenConsensusPercentage: Math.round(consensusPercentage),
    citizenDecisiveVotesCount: totalDecisiveVotes,
    municipalInspectionVerified,
  };
}

export interface OrganizationPublicProfile {
  name: string;
  slug: string;
  organizationType: string;
  isVerified: boolean;
  description: string | null;
  websiteUrl: string | null;
  focusAreas: string[];
  operatingLocations: string[];
  badges: Array<{ id: string; name: string; description: string }>;
  verifiedResolutionsCount: number;
  resolvedIncidents: Array<{
    incidentId: string;
    incidentNumber: string;
    title: string;
    category: string;
    resolvedAt: Date;
    role: string;
  }>;
}

/**
 * Public organization profile for /organizations/:slug
 * PRD §30.2: Showcase verified resolutions, badges, and strictly hide internal financials / PII.
 */
export async function getPublicOrganizationProfile(slug: string): Promise<OrganizationPublicProfile | null> {
  if (!(await isDatabaseReachable())) {
    return null;
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.publicProfileSlug, slug))
    .limit(1);

  if (!org) return null;

  // Retrieve verified attributions
  const rows = await db
    .select({
      attribution: impactAttributions,
      incident: incidents,
    })
    .from(impactAttributions)
    .innerJoin(incidents, eq(impactAttributions.incidentId, incidents.id))
    .where(
      and(
        eq(impactAttributions.organizationId, org.id),
        eq(impactAttributions.status, "verified"),
        eq(incidents.status, "resolved"),
      ),
    )
    .orderBy(desc(incidents.updatedAt));

  const count = rows.length;
  const badges: Array<{ id: string; name: string; description: string }> = [];

  if (count >= 1) {
    badges.push({
      id: "CIVIC_CONTRIBUTOR",
      name: "Civic Contributor",
      description: "Successfully resolved and verified at least 1 public civic hazard.",
    });
  }
  if (count >= 5) {
    badges.push({
      id: "VERIFIED_IMPACT_PARTNER",
      name: "Verified Impact Partner",
      description: "Delivered 5+ verified community infrastructure or civic resolutions.",
    });
  }
  if (count >= 10) {
    badges.push({
      id: "COMMUNITY_SAFETY_CHAMPION",
      name: "Community Safety Champion",
      description: "Resolved 10+ high-impact civic hazards with citizen verified consensus.",
    });
  }

  return {
    name: org.displayName,
    slug: org.publicProfileSlug,
    organizationType: org.organizationType,
    isVerified: org.verificationStatus === "verified",
    description: org.publicDescription,
    websiteUrl: org.websiteUrl,
    focusAreas: org.focusAreas || [],
    operatingLocations: org.operatingLocations || [],
    badges,
    verifiedResolutionsCount: count,
    resolvedIncidents: rows.map((r) => ({
      incidentId: r.incident.id,
      incidentNumber: r.incident.incidentNumber,
      title: r.incident.title,
      category: r.incident.category,
      resolvedAt: r.incident.updatedAt,
      role: r.attribution.role,
    })),
  };
}
