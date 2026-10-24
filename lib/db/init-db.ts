import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/jansahayak",
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connecting to Postgres & PostGIS...");

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    console.log("Creating tables...");

    await client.query(`
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
    `);

    await client.query(`
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

      CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status);
      CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents(category);
      CREATE INDEX IF NOT EXISTS incidents_published_idx ON incidents(is_published);
      CREATE INDEX IF NOT EXISTS incidents_spatial_idx ON incidents USING GIST(canonical_geom);
    `);

    await client.query(`
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
    `);

    await client.query(`
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
    `);

    await client.query(`
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
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS publication_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
        published_by VARCHAR(255) NOT NULL,
        public_snapshot JSONB NOT NULL,
        published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS publication_records_incident_idx ON publication_records(incident_id);
    `);

    console.log("Database initialized successfully with PostGIS spatial indices!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
