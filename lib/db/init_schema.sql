CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'citizen',
  phone_number VARCHAR(50),
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number VARCHAR(64) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'under_review',
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  canonical_geom geometry(Point, 4326),
  spatial_uncertainty_meters NUMERIC(8, 2) NOT NULL DEFAULT 10.00,
  report_count INTEGER NOT NULL DEFAULT 1,
  verification_votes_count INTEGER NOT NULL DEFAULT 1,
  resolution_votes_count INTEGER NOT NULL DEFAULT 0,
  unresolved_votes_count INTEGER NOT NULL DEFAULT 0,
  public_opinion_status VARCHAR(50) NOT NULL DEFAULT 'verified_hazard',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  published_by VARCHAR(255),
  moderation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  moderated_by VARCHAR(255),
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure schema backwards compatibility with existing databases
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS verification_votes_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_votes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS unresolved_votes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS public_opinion_status VARCHAR(50) NOT NULL DEFAULT 'verified_hazard';

CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status);
CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents(category);
CREATE INDEX IF NOT EXISTS incidents_published_idx ON incidents(is_published);
CREATE INDEX IF NOT EXISTS incidents_spatial_idx ON incidents USING GIST(canonical_geom);

CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  report_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(255) REFERENCES users(id),
  match_score NUMERIC(5, 4),
  match_reason TEXT,
  is_primary_report BOOLEAN NOT NULL DEFAULT FALSE,
  associated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incident_reports_incident_idx ON incident_reports(incident_id);
CREATE INDEX IF NOT EXISTS incident_reports_report_idx ON incident_reports(report_id);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  report_id VARCHAR(128),
  moderator_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_actions_incident_idx ON moderation_actions(incident_id);
CREATE INDEX IF NOT EXISTS moderation_actions_moderator_idx ON moderation_actions(moderator_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL DEFAULT 'incident',
  aggregate_id VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox_events(status);
CREATE INDEX IF NOT EXISTS outbox_created_idx ON outbox_events(created_at);

CREATE TABLE IF NOT EXISTS publication_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  published_by VARCHAR(255) NOT NULL,
  public_snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS publication_records_incident_idx ON publication_records(incident_id);

-- Incident Votes (PRD §14B)
CREATE TABLE IF NOT EXISTS incident_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  voter_identifier VARCHAR(255) NOT NULL,
  voter_name VARCHAR(255),
  voter_role VARCHAR(50) NOT NULL DEFAULT 'local_resident',
  vote_type VARCHAR(50) NOT NULL,
  comment TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  sector_name VARCHAR(100),
  is_local_resident BOOLEAN NOT NULL DEFAULT TRUE,
  wants_updates BOOLEAN NOT NULL DEFAULT FALSE,
  voter_email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_votes_incident_idx ON incident_votes(incident_id);
CREATE INDEX IF NOT EXISTS incident_votes_voter_idx ON incident_votes(voter_identifier);
CREATE INDEX IF NOT EXISTS incident_votes_type_idx ON incident_votes(vote_type);

-- Organizations Table (PRD §32)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(50) NOT NULL,
  registration_number VARCHAR(100),
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  public_profile_slug VARCHAR(100) UNIQUE NOT NULL,
  public_description TEXT,
  website_url VARCHAR(255),
  operating_locations JSONB DEFAULT '[]'::jsonb,
  focus_areas JSONB DEFAULT '[]'::jsonb,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(255),
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations(verification_status);
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(public_profile_slug);

-- Organization Members Junction Table (PRD §32)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'org_member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_members_org_user_uniq UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members(user_id);

-- Organization Verifications Table (PRD §32)
CREATE TABLE IF NOT EXISTS organization_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_reason TEXT,
  reviewer_id VARCHAR(255),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS org_verifications_org_idx ON organization_verifications(organization_id);

-- Problem Adoptions Table (PRD §32)
CREATE TABLE IF NOT EXISTS problem_adoptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposed_role VARCHAR(50) NOT NULL DEFAULT 'implementer',
  proposal_description TEXT NOT NULL,
  scope TEXT NOT NULL,
  estimated_cost NUMERIC(12, 2),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  proposed_deadline TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'proposal_submitted',
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS problem_adoptions_incident_idx ON problem_adoptions(incident_id);
CREATE INDEX IF NOT EXISTS problem_adoptions_org_idx ON problem_adoptions(organization_id);
CREATE INDEX IF NOT EXISTS problem_adoptions_status_idx ON problem_adoptions(status);

-- Project Milestones Table (PRD §32)
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_adoption_id UUID NOT NULL REFERENCES problem_adoptions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  evidence_references JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_milestones_adoption_idx ON project_milestones(problem_adoption_id);

-- Resolution Claims Table (PRD §32)
CREATE TABLE IF NOT EXISTS resolution_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  problem_adoption_id UUID REFERENCES problem_adoptions(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  submitted_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  claim_description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  initial_reviewer_id VARCHAR(255),
  initial_review_notes TEXT,
  requires_official_inspection BOOLEAN NOT NULL DEFAULT FALSE,
  official_inspection_completed BOOLEAN NOT NULL DEFAULT FALSE,
  official_inspection_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resolution_claims_incident_idx ON resolution_claims(incident_id);
CREATE INDEX IF NOT EXISTS resolution_claims_org_idx ON resolution_claims(organization_id);
CREATE INDEX IF NOT EXISTS resolution_claims_status_idx ON resolution_claims(status);

-- Resolution Evidence Table (PRD §32)
CREATE TABLE IF NOT EXISTS resolution_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_claim_id UUID NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) NOT NULL,
  media_url TEXT NOT NULL,
  description TEXT,
  captured_at TIMESTAMPTZ,
  location_reference JSONB,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resolution_evidence_claim_idx ON resolution_evidence(resolution_claim_id);

-- Verification Cases Table (PRD §32)
CREATE TABLE IF NOT EXISTS verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_claim_id UUID NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'opened',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  minimum_participation INTEGER NOT NULL DEFAULT 3,
  consensus_threshold_pct NUMERIC(5, 2) NOT NULL DEFAULT 75.00,
  policy_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  final_outcome VARCHAR(50),
  finalized_at TIMESTAMPTZ,
  finalized_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verification_cases_claim_idx ON verification_cases(resolution_claim_id);
CREATE INDEX IF NOT EXISTS verification_cases_incident_idx ON verification_cases(incident_id);
CREATE INDEX IF NOT EXISTS verification_cases_status_idx ON verification_cases(status);

-- Citizen Verification Votes Table (PRD §32)
CREATE TABLE IF NOT EXISTS citizen_verification_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_case_id UUID NOT NULL REFERENCES verification_cases(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  vote VARCHAR(50) NOT NULL,
  explanation TEXT,
  evidence_url TEXT,
  is_local_resident BOOLEAN NOT NULL DEFAULT TRUE,
  distance_meters NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizen_votes_case_user_uniq UNIQUE (verification_case_id, user_id)
);
CREATE INDEX IF NOT EXISTS citizen_votes_case_idx ON citizen_verification_votes(verification_case_id);
CREATE INDEX IF NOT EXISTS citizen_votes_vote_idx ON citizen_verification_votes(vote);

-- Resolution Decisions Table (PRD §32)
CREATE TABLE IF NOT EXISTS resolution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_claim_id UUID NOT NULL REFERENCES resolution_claims(id) ON DELETE CASCADE,
  verification_case_id UUID REFERENCES verification_cases(id) ON DELETE SET NULL,
  outcome VARCHAR(50) NOT NULL,
  decision_reason TEXT NOT NULL,
  decided_by VARCHAR(255),
  policy_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  evidence_summary JSONB DEFAULT '{}'::jsonb,
  citizen_votes_snapshot JSONB DEFAULT '{}'::jsonb,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resolution_decisions_claim_idx ON resolution_decisions(resolution_claim_id);

-- Impact Attributions Table (PRD §32)
CREATE TABLE IF NOT EXISTS impact_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  resolution_claim_id UUID REFERENCES resolution_claims(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  classification VARCHAR(50) NOT NULL DEFAULT 'PRIVATE_LED',
  contribution_description TEXT NOT NULL,
  supporting_evidence JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'verified',
  reviewed_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS impact_attributions_incident_idx ON impact_attributions(incident_id);
CREATE INDEX IF NOT EXISTS impact_attributions_org_idx ON impact_attributions(organization_id);
CREATE INDEX IF NOT EXISTS impact_attributions_classification_idx ON impact_attributions(classification);

-- Audit Logs Table (PRD §32)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id VARCHAR(255),
  actor_organization_id UUID,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  action VARCHAR(100) NOT NULL,
  before_summary TEXT,
  after_summary TEXT,
  reason TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at);
