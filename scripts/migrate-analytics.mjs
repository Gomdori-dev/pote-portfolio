// Creates the funnel analytics tables (scripts/analytics-schema.sql).
// Only CREATE ... IF NOT EXISTS statements: existing tables and rows are untouched.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  console.error("No database connection string configured");
  process.exit(1);
}

const sql = neon(connectionString);
const statements = readFileSync(new URL("./analytics-schema.sql", import.meta.url), "utf8")
  .replace(/^--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

try {
  for (const statement of statements) await sql.query(statement);
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'analytics_%' ORDER BY table_name`;
  console.log(`✓ ${statements.length}개 문장 실행, 테이블: ${tables.map((row) => row.table_name).join(", ")}`);
} catch (error) {
  console.error("❌", error.message);
  process.exit(1);
}
