import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Database not configured");
const sql = neon(url);
try {
  const exists = await sql`SELECT to_regclass('public.analytics_applications') IS NOT NULL AS exists`;
  mkdirSync("tmp/application-tracking", { recursive: true });
  const rows = exists[0].exists ? await sql`SELECT event_key, event_type, session_id, source, medium, campaign, content, term, landing, created_at FROM analytics_applications` : [];
  const backup = `tmp/application-tracking/before-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify({ at: new Date().toISOString(), existed: exists[0].exists, rows }), "utf8");
  const statements = readFileSync("scripts/application-tracking-schema.sql", "utf8").replace(/^--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(s => sql.query(s)));
  const result = await sql`SELECT count(*)::int AS count FROM analytics_applications`;
  if (result[0].count !== rows.length) throw new Error("Existing row count changed");
  console.log(`Application tracking schema ready; preserved ${rows.length} existing rows; backup: ${backup}`);
} catch (error) { console.error("Application migration failed:", error.code ?? error.name); process.exitCode = 1; }
