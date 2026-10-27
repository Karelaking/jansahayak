import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

// Read .env.local or .env
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/jansahayak";

const isSslRequired =
  connectionString.includes("neon.tech") ||
  connectionString.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

console.log(`[Neon/Postgres Setup] Connecting to: ${connectionString.replace(/:[^:@]+@/, ":****@")}`);
console.log(`[Neon/Postgres Setup] SSL required: ${isSslRequired}`);

const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 15000,
  ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("[Neon/Postgres Setup] Connected successfully. Applying PostGIS & complete schema...");
    const schemaSqlPath = path.resolve(process.cwd(), "lib", "db", "init_schema.sql");
    const sqlContent = fs.readFileSync(schemaSqlPath, "utf-8");
    await client.query(sqlContent);

    // Verify PostGIS
    const postgisRes = await client.query("SELECT PostGIS_Version();");
    console.log(`[Neon/Postgres Setup] PostGIS Version: ${postgisRes.rows[0]?.postgis_version || "enabled"}`);

    // Verify tables created
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r) => r.table_name);
    console.log(`[Neon/Postgres Setup] Active tables (${tables.length}): ${tables.join(", ")}`);
    console.log("[Neon/Postgres Setup] Database schema is fully synced and ready!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[Neon/Postgres Setup] Error setting up database:", err.message);
  process.exit(1);
});
