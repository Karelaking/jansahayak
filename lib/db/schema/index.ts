import {
  pgTable,
  text,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  customType,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Custom PostGIS Geometry Point type for Drizzle ORM.
 * Stores WGS84 point coordinates geometry(Point, 4326).
 */
export const geometryPoint = customType<{
  data: { longitude: number; latitude: number } | string;
  driverData: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value) {
    if (typeof value === "string") return value;
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
  fromDriver(value) {
    return value;
  },
});

/**
 * Users Table
 * Synchronized with Clerk JS via Webhooks & authentication tokens.
 */
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(), // Matches Clerk userId (e.g. user_xxx)
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("citizen"), // 'citizen' | 'moderator' | 'admin' | 'field_official'
  phoneNumber: varchar("phone_number", { length: 50 }),
  avatarUrl: text("avatar_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Canonical Incidents Table
 * Represents validated, deduplicated physical roadway hazards.
 */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentNumber: varchar("incident_number", { length: 64 }).unique().notNull(), // e.g. INC-2026-0001
    category: varchar("category", { length: 100 }).notNull(), // Road Surface / Pothole, etc.
    severity: varchar("severity", { length: 50 }).notNull().default("medium"), // 'low' | 'medium' | 'high' | 'critical'
    status: varchar("status", { length: 50 }).notNull().default("under_review"), // 'draft' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'resolved'
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    canonicalGeom: geometryPoint("canonical_geom"),
    spatialUncertaintyMeters: numeric("spatial_uncertainty_meters", { precision: 8, scale: 2 })
      .notNull()
      .default("10.00"),
    reportCount: integer("report_count").notNull().default(1),
    verificationVotesCount: integer("verification_votes_count").notNull().default(1),
    resolutionVotesCount: integer("resolution_votes_count").notNull().default(0),
    unresolvedVotesCount: integer("unresolved_votes_count").notNull().default(0),
    publicOpinionStatus: varchar("public_opinion_status", { length: 50 })
      .notNull()
      .default("verified_hazard"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: varchar("published_by", { length: 255 }),
    moderationStatus: varchar("moderation_status", { length: 50 }).notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'needs_evidence'
    moderatedBy: varchar("moderated_by", { length: 255 }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("incidents_status_idx").on(table.status),
    index("incidents_category_idx").on(table.category),
    index("incidents_published_idx").on(table.isPublished),
  ],
);

/**
 * Incident-to-Report Association Junction Table
 * Connects Postgres canonical incidents with MongoDB raw reports.
 */
export const incidentReports = pgTable(
  "incident_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    reportId: varchar("report_id", { length: 128 }).notNull(), // MongoDB raw_reports._id
    userId: varchar("user_id", { length: 255 }).references(() => users.id),
    matchScore: numeric("match_score", { precision: 5, scale: 4 }), // Calibrated confidence score (0.0000 - 1.0000)
    matchReason: text("match_reason"),
    isPrimaryReport: boolean("is_primary_report").notNull().default(false),
    associatedAt: timestamp("associated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("incident_reports_incident_idx").on(table.incidentId),
    index("incident_reports_report_idx").on(table.reportId),
  ],
);

/**
 * Moderation Actions Table
 * Immutable audit trail for all reviewer decisions and manual overrides.
 */
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    reportId: varchar("report_id", { length: 128 }),
    moderatorId: varchar("moderator_id", { length: 255 }),
    action: varchar("action", { length: 50 }).notNull(), // 'approve' | 'reject' | 'request_evidence' | 'merge' | 'split' | 'correct_location'
    reason: text("reason"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("moderation_actions_incident_idx").on(table.incidentId),
    index("moderation_actions_moderator_idx").on(table.moderatorId),
  ],
);

/**
 * Transactional Outbox Events Table
 * Implements the Outbox Pattern to guarantee post-commit pipeline & notification dispatch.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 100 }).notNull(), // 'report.ingested' | 'ai.completed' | 'incident.merged' | 'incident.published'
    aggregateType: varchar("aggregate_type", { length: 50 }).notNull().default("incident"),
    aggregateId: varchar("aggregate_id", { length: 128 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(5),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("outbox_status_idx").on(table.status),
    index("outbox_created_idx").on(table.createdAt),
  ],
);

/**
 * Publication Records Table
 * Immutable snapshot of every atomic map publication event.
 */
export const publicationRecords = pgTable(
  "publication_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    publishedBy: varchar("published_by", { length: 255 }).notNull(),
    publicSnapshot: jsonb("public_snapshot").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("publication_records_incident_idx").on(table.incidentId)],
);

/**
 * Community Hazard Verification & Resolution Votes Table (PRD §14B)
 * Stores local resident and reporter verification votes, update subscriptions,
 * and physical repair confirmation votes.
 */
export const incidentVotes = pgTable(
  "incident_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    voterIdentifier: varchar("voter_identifier", { length: 255 }).notNull(), // userId or voter email/session/ip
    voterName: varchar("voter_name", { length: 255 }),
    voterRole: varchar("voter_role", { length: 50 }).notNull().default("local_resident"), // 'reporter' | 'local_resident' | 'commuter'
    voteType: varchar("vote_type", { length: 50 }).notNull(), // 'verify_hazard' | 'confirm_resolved' | 'still_unresolved'
    comment: text("comment"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    sectorName: varchar("sector_name", { length: 100 }),
    isLocalResident: boolean("is_local_resident").notNull().default(true),
    wantsUpdates: boolean("wants_updates").notNull().default(false),
    voterEmail: varchar("voter_email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("incident_votes_incident_idx").on(table.incidentId),
    index("incident_votes_voter_idx").on(table.voterIdentifier),
    index("incident_votes_type_idx").on(table.voteType),
  ],
);

// Type exports for application use
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

export type IncidentReport = typeof incidentReports.$inferSelect;
export type NewIncidentReport = typeof incidentReports.$inferInsert;

export type ModerationAction = typeof moderationActions.$inferSelect;
export type NewModerationAction = typeof moderationActions.$inferInsert;

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;

export type PublicationRecord = typeof publicationRecords.$inferSelect;
export type NewPublicationRecord = typeof publicationRecords.$inferInsert;

export type IncidentVote = typeof incidentVotes.$inferSelect;
export type NewIncidentVote = typeof incidentVotes.$inferInsert;

/**
 * Organizations Table (PRD §32)
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    organizationType: varchar("organization_type", { length: 50 }).notNull(), // 'corporate' | 'ngo' | 'foundation' | 'contractor' | 'institution' | 'other'
    registrationNumber: varchar("registration_number", { length: 100 }), // CIN, NGO Darpan, Trust ID
    verificationStatus: varchar("verification_status", { length: 50 })
      .notNull()
      .default("pending_verification"), // 'pending_verification' | 'verified' | 'rejected' | 'needs_more_information' | 'suspended'
    publicProfileSlug: varchar("public_profile_slug", { length: 100 }).unique().notNull(),
    publicDescription: text("public_description"),
    websiteUrl: varchar("website_url", { length: 255 }),
    operatingLocations: jsonb("operating_locations").$type<string[]>().default([]),
    focusAreas: jsonb("focus_areas").$type<string[]>().default([]),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 50 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: varchar("verified_by", { length: 255 }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("organizations_status_idx").on(table.verificationStatus),
    index("organizations_slug_idx").on(table.publicProfileSlug),
  ],
);

/**
 * Organization Members Junction Table (PRD §32)
 */
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("org_member"), // 'org_admin' | 'project_manager' | 'evidence_submitter' | 'org_viewer'
    status: varchar("status", { length: 50 }).notNull().default("active"), // 'active' | 'invited' | 'suspended'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("org_members_org_user_idx").on(table.organizationId, table.userId),
    index("org_members_user_idx").on(table.userId),
  ],
);

/**
 * Organization Verifications Table (PRD §32)
 */
export const organizationVerifications = pgTable(
  "organization_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("submitted"), // 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_info'
    documents: jsonb("documents").$type<Array<{ type: string; url: string; name: string }>>().notNull().default([]),
    decisionReason: text("decision_reason"),
    reviewerId: varchar("reviewer_id", { length: 255 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("org_verifications_org_idx").on(table.organizationId)],
);

/**
 * Problem Adoptions Table (PRD §32)
 */
export const problemAdoptions = pgTable(
  "problem_adoptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    proposedRole: varchar("proposed_role", { length: 50 }).notNull().default("implementer"), // 'funder' | 'implementer' | 'technical_partner' | 'joint_partner' | 'coordinator'
    proposalDescription: text("proposal_description").notNull(),
    scope: text("scope").notNull(),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 10 }).notNull().default("INR"),
    proposedDeadline: timestamp("proposed_deadline", { withTimezone: true }),
    status: varchar("status", { length: 50 }).notNull().default("proposal_submitted"), // 'proposal_submitted' | 'under_review' | 'needs_changes' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'withdrawn' | 'expired' | 'on_hold'
    approvedBy: varchar("approved_by", { length: 255 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("problem_adoptions_incident_idx").on(table.incidentId),
    index("problem_adoptions_org_idx").on(table.organizationId),
    index("problem_adoptions_status_idx").on(table.status),
  ],
);

/**
 * Project Milestones Table (PRD §32)
 */
export const projectMilestones = pgTable(
  "project_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    problemAdoptionId: uuid("problem_adoption_id")
      .notNull()
      .references(() => problemAdoptions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
    completedAt: timestamp("completed_at", { withTimezone: true }),
    evidenceReferences: jsonb("evidence_references").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("project_milestones_adoption_idx").on(table.problemAdoptionId)],
);

/**
 * Resolution Claims Table (PRD §32)
 */
export const resolutionClaims = pgTable(
  "resolution_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    problemAdoptionId: uuid("problem_adoption_id").references(() => problemAdoptions.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    submittedByUserId: varchar("submitted_by_user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    claimDescription: text("claim_description").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("submitted"), // 'draft' | 'submitted' | 'initial_review' | 'needs_more_evidence' | 'ready_for_verification' | 'under_verification' | 'inconclusive' | 'verified_resolved' | 'not_verified' | 'disputed' | 'revoked'
    initialReviewerId: varchar("initial_reviewer_id", { length: 255 }),
    initialReviewNotes: text("initial_review_notes"),
    requiresOfficialInspection: boolean("requires_official_inspection").notNull().default(false),
    officialInspectionCompleted: boolean("official_inspection_completed").notNull().default(false),
    officialInspectionNotes: text("official_inspection_notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("resolution_claims_incident_idx").on(table.incidentId),
    index("resolution_claims_org_idx").on(table.organizationId),
    index("resolution_claims_status_idx").on(table.status),
  ],
);

/**
 * Resolution Evidence Table (PRD §32)
 */
export const resolutionEvidence = pgTable(
  "resolution_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resolutionClaimId: uuid("resolution_claim_id")
      .notNull()
      .references(() => resolutionClaims.id, { onDelete: "cascade" }),
    evidenceType: varchar("evidence_type", { length: 50 }).notNull(), // 'photo_before' | 'photo_after' | 'video' | 'completion_certificate' | 'inspection_report' | 'invoice_redacted' | 'permit_noc'
    mediaUrl: text("media_url").notNull(),
    description: text("description"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    locationReference: jsonb("location_reference").$type<{ latitude: number; longitude: number }>(),
    visibility: varchar("visibility", { length: 20 }).notNull().default("public"), // 'public' | 'internal' | 'moderator_only'
    reviewStatus: varchar("review_status", { length: 50 }).notNull().default("pending"), // 'pending' | 'accepted' | 'rejected'
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("resolution_evidence_claim_idx").on(table.resolutionClaimId)],
);

/**
 * Verification Cases Table (PRD §32)
 */
export const verificationCases = pgTable(
  "verification_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resolutionClaimId: uuid("resolution_claim_id")
      .notNull()
      .references(() => resolutionClaims.id, { onDelete: "cascade" }),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("opened"), // 'opened' | 'closed' | 'finalized' | 'inconclusive' | 'disputed' | 'appealed'
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    minimumParticipation: integer("minimum_participation").notNull().default(3),
    consensusThresholdPct: numeric("consensus_threshold_pct", { precision: 5, scale: 2 }).notNull().default("75.00"),
    policyVersion: varchar("policy_version", { length: 50 }).notNull().default("v1.0"),
    finalOutcome: varchar("final_outcome", { length: 50 }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedBy: varchar("finalized_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("verification_cases_claim_idx").on(table.resolutionClaimId),
    index("verification_cases_incident_idx").on(table.incidentId),
    index("verification_cases_status_idx").on(table.status),
  ],
);

/**
 * Citizen Verification Votes Table (PRD §32)
 */
export const citizenVerificationVotes = pgTable(
  "citizen_verification_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verificationCaseId: uuid("verification_case_id")
      .notNull()
      .references(() => verificationCases.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    vote: varchar("vote", { length: 50 }).notNull(), // 'RESOLVED' | 'NOT_RESOLVED' | 'CANNOT_VERIFY'
    explanation: text("explanation"),
    evidenceUrl: text("evidence_url"),
    isLocalResident: boolean("is_local_resident").notNull().default(true),
    distanceMeters: numeric("distance_meters", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("citizen_votes_case_user_idx").on(table.verificationCaseId, table.userId),
    index("citizen_votes_case_idx").on(table.verificationCaseId),
    index("citizen_votes_vote_idx").on(table.vote),
  ],
);

/**
 * Resolution Decisions Table (PRD §32)
 */
export const resolutionDecisions = pgTable(
  "resolution_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resolutionClaimId: uuid("resolution_claim_id")
      .notNull()
      .references(() => resolutionClaims.id, { onDelete: "cascade" }),
    verificationCaseId: uuid("verification_case_id").references(() => verificationCases.id, { onDelete: "set null" }),
    outcome: varchar("outcome", { length: 50 }).notNull(), // 'verified_resolved' | 'not_verified' | 'inconclusive' | 'disputed' | 'revoked'
    decisionReason: text("decision_reason").notNull(),
    decidedBy: varchar("decided_by", { length: 255 }), // moderator ID or 'automated_procedural'
    policyVersion: varchar("policy_version", { length: 50 }).notNull().default("v1.0"),
    evidenceSummary: jsonb("evidence_summary").$type<Record<string, unknown>>().default({}),
    citizenVotesSnapshot: jsonb("citizen_votes_snapshot").$type<Record<string, unknown>>().default({}),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("resolution_decisions_claim_idx").on(table.resolutionClaimId)],
);

/**
 * Impact Attributions Table (PRD §32)
 */
export const impactAttributions = pgTable(
  "impact_attributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    resolutionClaimId: uuid("resolution_claim_id").references(() => resolutionClaims.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(), // 'FUNDER' | 'IMPLEMENTER' | 'TECHNICAL_PARTNER' | 'COMMUNITY_PARTNER' | 'COORDINATOR' | 'GOVERNMENT_AUTHORITY'
    classification: varchar("classification", { length: 50 }).notNull().default("PRIVATE_LED"), // 'GOVERNMENT_LED' | 'PRIVATE_LED' | 'JOINT' | 'COMMUNITY_OR_OTHER' | 'UNCLASSIFIED'
    contributionDescription: text("contribution_description").notNull(),
    supportingEvidence: jsonb("supporting_evidence").$type<string[]>().default([]),
    status: varchar("status", { length: 50 }).notNull().default("verified"), // 'provisional' | 'verified' | 'disputed' | 'revoked'
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("impact_attributions_incident_idx").on(table.incidentId),
    index("impact_attributions_org_idx").on(table.organizationId),
    index("impact_attributions_classification_idx").on(table.classification),
  ],
);

/**
 * Audit Logs Table (PRD §32)
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: varchar("actor_user_id", { length: 255 }),
    actorOrganizationId: uuid("actor_organization_id"),
    entityType: varchar("entity_type", { length: 100 }).notNull(), // 'organization' | 'adoption' | 'milestone' | 'claim' | 'vote' | 'decision' | 'attribution'
    entityId: varchar("entity_id", { length: 128 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    beforeSummary: text("before_summary"),
    afterSummary: text("after_summary"),
    reason: text("reason"),
    ipAddress: varchar("ip_address", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_idx").on(table.createdAt),
  ],
);

// Type exports for Organization & Civic Adoption Subsystem
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type OrganizationVerification = typeof organizationVerifications.$inferSelect;
export type NewOrganizationVerification = typeof organizationVerifications.$inferInsert;

export type ProblemAdoption = typeof problemAdoptions.$inferSelect;
export type NewProblemAdoption = typeof problemAdoptions.$inferInsert;

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type NewProjectMilestone = typeof projectMilestones.$inferInsert;

export type ResolutionClaim = typeof resolutionClaims.$inferSelect;
export type NewResolutionClaim = typeof resolutionClaims.$inferInsert;

export type ResolutionEvidence = typeof resolutionEvidence.$inferSelect;
export type NewResolutionEvidence = typeof resolutionEvidence.$inferInsert;

export type VerificationCase = typeof verificationCases.$inferSelect;
export type NewVerificationCase = typeof verificationCases.$inferInsert;

export type CitizenVerificationVote = typeof citizenVerificationVotes.$inferSelect;
export type NewCitizenVerificationVote = typeof citizenVerificationVotes.$inferInsert;

export type ResolutionDecision = typeof resolutionDecisions.$inferSelect;
export type NewResolutionDecision = typeof resolutionDecisions.$inferInsert;

export type ImpactAttribution = typeof impactAttributions.$inferSelect;
export type NewImpactAttribution = typeof impactAttributions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
