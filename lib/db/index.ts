import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

// Global cache for pg.Pool across Next.js dev reloads
declare global {
  // eslint-disable-next-line no-var
  var __jansahayak_pg_pool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __jansahayak_pg_conn_str__: string | undefined;
}

function resolveConnectionString(): string {
  try {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const raw = fs.readFileSync(envLocalPath, "utf-8");
      const match = raw.match(/^\s*DATABASE_URL\s*=\s*([^\r\n]+)/m);
      if (match && match[1]) {
        let val = match[1].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        return val;
      }
    }
  } catch {
    // fallback
  }
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/jansahayak";
}

const connectionString = resolveConnectionString();

const isSslRequired =
  connectionString.includes("neon.tech") ||
  connectionString.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

// If the connection string changed or pool was created with stale options, re-create the pool
if (global.__jansahayak_pg_pool__) {
  const poolConnStr = global.__jansahayak_pg_pool__.options?.connectionString;
  if (!poolConnStr || poolConnStr !== connectionString) {
    try {
      global.__jansahayak_pg_pool__.end();
    } catch {
      // Ignore pool end errors on reload
    }
    global.__jansahayak_pg_pool__ = undefined;
  }
}

export const pool =
  global.__jansahayak_pg_pool__ ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });

global.__jansahayak_pg_conn_str__ = connectionString;

// Prevent unhandled error events on idle clients from crashing Node
pool.on("error", (err) => {
  console.warn("[Postgres-Pool] Idle client warning:", (err as Error)?.message || err);
});

if (process.env.NODE_ENV !== "production") {
  global.__jansahayak_pg_pool__ = pool;
}

export const db = drizzle(pool, { schema });

let lastDbCheckTime = 0;
let lastDbCheckResult = false;
const DB_CHECK_TTL_MS = 4000;

/**
 * Fast, non-throwing check to verify if the configured PostgreSQL server is accepting TCP connections.
 * Caches positive and negative results for 4 seconds using performance.now() to minimize connection overhead.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  const now = performance.now();
  if (lastDbCheckTime > 0 && now - lastDbCheckTime < DB_CHECK_TTL_MS) {
    return lastDbCheckResult;
  }

  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database connection check timed out")), 5000),
      ),
    ]);
    client.release();
    lastDbCheckTime = now;
    lastDbCheckResult = true;
    return true;
  } catch (err) {
    console.warn("[Postgres-Check] Database unreachable:", (err as Error)?.message || err);
    lastDbCheckTime = now;
    lastDbCheckResult = false;
    return false;
  }
}

/**
 * Initializes PostGIS extension and ensures the spatial indices are enabled.
 */
export async function initPostgres(): Promise<{ success: boolean; message: string }> {
  try {
    const client = await pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

      try {
        const fs = await import("fs");
        const path = await import("path");
        const schemaSqlPath = path.resolve(process.cwd(), "lib", "db", "init_schema.sql");
        if (fs.existsSync(schemaSqlPath)) {
          const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");
          await client.query(schemaSql);
        }
      } catch (err) {
        console.warn("[Postgres-Init] File schema execution warning:", (err as Error)?.message || err);
      }

      await client.query(`
        ALTER TABLE incidents 
        ADD COLUMN IF NOT EXISTS verification_votes_count integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS resolution_votes_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS unresolved_votes_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS public_opinion_status varchar(50) NOT NULL DEFAULT 'verified_hazard';

        CREATE TABLE IF NOT EXISTS incident_votes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          voter_identifier varchar(255) NOT NULL,
          voter_name varchar(255),
          voter_role varchar(50) NOT NULL DEFAULT 'local_resident',
          vote_type varchar(50) NOT NULL,
          comment text,
          latitude numeric(10, 7),
          longitude numeric(10, 7),
          sector_name varchar(100),
          is_local_resident boolean NOT NULL DEFAULT true,
          wants_updates boolean NOT NULL DEFAULT false,
          voter_email varchar(255),
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS incident_votes_incident_idx ON incident_votes(incident_id);
        CREATE INDEX IF NOT EXISTS incident_votes_voter_idx ON incident_votes(voter_identifier);
        CREATE INDEX IF NOT EXISTS incident_votes_type_idx ON incident_votes(vote_type);

        -- Organizations Table (PRD §32)
        CREATE TABLE IF NOT EXISTS organizations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          legal_name varchar(255) NOT NULL,
          display_name varchar(255) NOT NULL,
          organization_type varchar(50) NOT NULL,
          registration_number varchar(100),
          verification_status varchar(50) NOT NULL DEFAULT 'pending_verification',
          public_profile_slug varchar(100) UNIQUE NOT NULL,
          public_description text,
          website_url varchar(255),
          operating_locations jsonb DEFAULT '[]'::jsonb,
          focus_areas jsonb DEFAULT '[]'::jsonb,
          contact_email varchar(255) NOT NULL,
          contact_phone varchar(50),
          metadata jsonb DEFAULT '{}'::jsonb,
          verified_at timestamp with time zone,
          verified_by varchar(255),
          suspended_at timestamp with time zone,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations(verification_status);
        CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(public_profile_slug);

        -- Organization Members Junction Table (PRD §32)
        CREATE TABLE IF NOT EXISTS organization_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role varchar(50) NOT NULL DEFAULT 'org_member',
          status varchar(50) NOT NULL DEFAULT 'active',
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT org_members_org_user_uniq UNIQUE (organization_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);

        -- Organization Verifications Table (PRD §32)
        CREATE TABLE IF NOT EXISTS organization_verifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          status varchar(50) NOT NULL DEFAULT 'submitted',
          documents jsonb NOT NULL DEFAULT '[]'::jsonb,
          decision_reason text,
          reviewer_id varchar(255),
          submitted_at timestamp with time zone NOT NULL DEFAULT now(),
          reviewed_at timestamp with time zone,
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS org_verifications_org_idx ON organization_verifications(organization_id);

        -- Problem Adoptions Table (PRD §32)
        CREATE TABLE IF NOT EXISTS problem_adoptions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          proposed_role varchar(50) NOT NULL DEFAULT 'implementer',
          proposal_description text NOT NULL,
          scope text NOT NULL,
          estimated_cost numeric(12, 2),
          currency varchar(10) NOT NULL DEFAULT 'INR',
          proposed_deadline timestamp with time zone,
          status varchar(50) NOT NULL DEFAULT 'proposal_submitted',
          approved_by varchar(255),
          approved_at timestamp with time zone,
          rejection_reason text,
          metadata jsonb DEFAULT '{}'::jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS problem_adoptions_incident_idx ON problem_adoptions(incident_id);
        CREATE INDEX IF NOT EXISTS problem_adoptions_org_idx ON problem_adoptions(organization_id);
        CREATE INDEX IF NOT EXISTS problem_adoptions_status_idx ON problem_adoptions(status);

        -- Project Milestones Table (PRD §32)
        CREATE TABLE IF NOT EXISTS project_milestones (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          problem_adoption_id uuid NOT NULL REFERENCES problem_adoptions(id) ON DELETE CASCADE,
          title varchar(255) NOT NULL,
          description text,
          due_at timestamp with time zone,
          status varchar(50) NOT NULL DEFAULT 'pending',
          completed_at timestamp with time zone,
          evidence_references jsonb DEFAULT '[]'::jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS project_milestones_adoption_idx ON project_milestones(problem_adoption_id);

        -- Resolution Claims Table (PRD §32)
        CREATE TABLE IF NOT EXISTS resolution_claims (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          problem_adoption_id uuid REFERENCES problem_adoptions(id) ON DELETE SET NULL,
          organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
          submitted_by_user_id varchar(255) NOT NULL REFERENCES users(id),
          claim_description text NOT NULL,
          status varchar(50) NOT NULL DEFAULT 'submitted',
          initial_reviewer_id varchar(255),
          initial_review_notes text,
          requires_official_inspection boolean NOT NULL DEFAULT false,
          official_inspection_completed boolean NOT NULL DEFAULT false,
          official_inspection_notes text,
          submitted_at timestamp with time zone NOT NULL DEFAULT now(),
          finalized_at timestamp with time zone,
          metadata jsonb DEFAULT '{}'::jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS resolution_claims_incident_idx ON resolution_claims(incident_id);
        CREATE INDEX IF NOT EXISTS resolution_claims_org_idx ON resolution_claims(organization_id);
        CREATE INDEX IF NOT EXISTS resolution_claims_status_idx ON resolution_claims(status);

        -- Resolution Evidence Table (PRD §32)
        CREATE TABLE IF NOT EXISTS resolution_evidence (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          resolution_claim_id uuid NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
          evidence_type varchar(50) NOT NULL,
          media_url text NOT NULL,
          description text,
          captured_at timestamp with time zone,
          location_reference jsonb,
          visibility varchar(20) NOT NULL DEFAULT 'public',
          review_status varchar(50) NOT NULL DEFAULT 'pending',
          rejection_reason text,
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS resolution_evidence_claim_idx ON resolution_evidence(resolution_claim_id);

        -- Verification Cases Table (PRD §32)
        CREATE TABLE IF NOT EXISTS verification_cases (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          resolution_claim_id uuid NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
          incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          status varchar(50) NOT NULL DEFAULT 'opened',
          opened_at timestamp with time zone NOT NULL DEFAULT now(),
          closes_at timestamp with time zone NOT NULL,
          minimum_participation integer NOT NULL DEFAULT 3,
          consensus_threshold_pct numeric(5, 2) NOT NULL DEFAULT 75.00,
          policy_version varchar(50) NOT NULL DEFAULT 'v1.0',
          final_outcome varchar(50),
          finalized_at timestamp with time zone,
          finalized_by varchar(255),
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS verification_cases_claim_idx ON verification_cases(resolution_claim_id);
        CREATE INDEX IF NOT EXISTS verification_cases_incident_idx ON verification_cases(incident_id);
        CREATE INDEX IF NOT EXISTS verification_cases_status_idx ON verification_cases(status);

        -- Citizen Verification Votes Table (PRD §32)
        CREATE TABLE IF NOT EXISTS citizen_verification_votes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          verification_case_id uuid NOT NULL REFERENCES verification_cases(id) ON DELETE CASCADE,
          user_id varchar(255) NOT NULL REFERENCES users(id),
          vote varchar(50) NOT NULL,
          explanation text,
          evidence_url text,
          is_local_resident boolean NOT NULL DEFAULT true,
          distance_meters numeric(10, 2),
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT citizen_votes_case_user_uniq UNIQUE (verification_case_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS citizen_votes_case_idx ON citizen_verification_votes(verification_case_id);
        CREATE INDEX IF NOT EXISTS citizen_votes_vote_idx ON citizen_verification_votes(vote);

        -- Resolution Decisions Table (PRD §32)
        CREATE TABLE IF NOT EXISTS resolution_decisions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          resolution_claim_id uuid NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
          verification_case_id uuid REFERENCES verification_cases(id) ON DELETE SET NULL,
          outcome varchar(50) NOT NULL,
          decision_reason text NOT NULL,
          decided_by varchar(255),
          policy_version varchar(50) NOT NULL DEFAULT 'v1.0',
          evidence_summary jsonb DEFAULT '{}'::jsonb,
          citizen_votes_snapshot jsonb DEFAULT '{}'::jsonb,
          decided_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS resolution_decisions_claim_idx ON resolution_decisions(resolution_claim_id);

        -- Impact Attributions Table (PRD §32)
        CREATE TABLE IF NOT EXISTS impact_attributions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          resolution_claim_id uuid REFERENCES resolution_claims(id) ON DELETE SET NULL,
          organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          role varchar(50) NOT NULL,
          classification varchar(50) NOT NULL DEFAULT 'PRIVATE_LED',
          contribution_description text NOT NULL,
          supporting_evidence jsonb DEFAULT '[]'::jsonb,
          status varchar(50) NOT NULL DEFAULT 'verified',
          reviewed_by varchar(255),
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS impact_attributions_incident_idx ON impact_attributions(incident_id);
        CREATE INDEX IF NOT EXISTS impact_attributions_org_idx ON impact_attributions(organization_id);
        CREATE INDEX IF NOT EXISTS impact_attributions_classification_idx ON impact_attributions(classification);

        -- Audit Logs Table (PRD §32)
        CREATE TABLE IF NOT EXISTS audit_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_user_id varchar(255),
          actor_organization_id uuid,
          entity_type varchar(100) NOT NULL,
          entity_id varchar(128) NOT NULL,
          action varchar(100) NOT NULL,
          before_summary text,
          after_summary text,
          reason text,
          ip_address varchar(100),
          created_at timestamp with time zone NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at);
      `);
      return {
        success: true,
        message: "PostgreSQL, PostGIS & JanSahayak tables successfully initialized",
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `PostgreSQL connection failed: ${msg}` };
  }
}

/**
 * Stage 5 PostGIS Spatial Discovery:
 * Find nearby canonical incidents within a given radius (meters) using ST_DWithin and ST_Distance on geography.
 */
export async function findNearbyIncidents(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number; // Default 30 meters (PRD Stage 5)
  category?: string;
  excludeIncidentId?: string;
}) {
  if (!(await isDatabaseReachable())) {
    return [];
  }

  const radius = params.radiusMeters || 30.0;
  const { latitude, longitude, category, excludeIncidentId } = params;

  // PostGIS query using ST_DWithin on WGS84 geography
  const query = sql`
    SELECT 
      id,
      incident_number as "incidentNumber",
      category,
      severity,
      status,
      title,
      summary,
      latitude::float as latitude,
      longitude::float as longitude,
      spatial_uncertainty_meters::float as "spatialUncertaintyMeters",
      report_count as "reportCount",
      is_published as "isPublished",
      moderation_status as "moderationStatus",
      created_at as "createdAt",
      ROUND(
        ST_Distance(
          canonical_geom::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        )::numeric,
        2
      )::float as "distanceMeters"
    FROM incidents
    WHERE 
      canonical_geom IS NOT NULL
      AND ST_DWithin(
        canonical_geom::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        ${radius}
      )
      ${category ? sql`AND category = ${category}` : sql``}
      ${excludeIncidentId ? sql`AND id != ${excludeIncidentId}::uuid` : sql``}
    ORDER BY "distanceMeters" ASC
    LIMIT 20;
  `;

  const result = await db.execute(query);
  return result.rows as Array<{
    id: string;
    incidentNumber: string;
    category: string;
    severity: string;
    status: string;
    title: string;
    summary: string;
    latitude: number;
    longitude: number;
    spatialUncertaintyMeters: number;
    reportCount: number;
    isPublished: boolean;
    moderationStatus: string;
    createdAt: string;
    distanceMeters: number;
  }>;
}

export * from "./schema";
