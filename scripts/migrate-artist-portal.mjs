#!/usr/bin/env node
// One-off migration runner for the artist portal schema. A human runs this
// manually, once, after the Neon integration's connection string exists:
//   node scripts/migrate-artist-portal.mjs
// Do NOT run this automatically from app code or CI — there is no DB to
// migrate against yet at the time this script was written.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  console.error(
    "No DATABASE_URL / POSTGRES_URL / DATABASE_URL_UNPOOLED set in the environment. " +
      "Set whichever one Vercel's Neon integration ended up injecting, then re-run this script.",
  );
  process.exit(1);
}

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "artist-portal-schema.sql");
const schema = readFileSync(schemaPath, "utf8");

// This schema file has no semicolons inside string literals, so a naive split
// on ";" is safe here (the neon() sql tag doesn't run multi-statement scripts).
// Comment lines are stripped BEFORE splitting — stripping only whole segments
// that start with "--" (the original approach) silently dropped any statement
// preceded by an explanatory comment on its own line, which is how the
// admin_credentials table's CREATE TABLE went unrun for a while (2026-09-20).
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const sql = neon(connectionString);

async function main() {
  for (const statement of statements) {
    console.log(`Running: ${statement.slice(0, 70).replace(/\s+/g, " ")}...`);
    await sql.query(statement);
  }
  console.log(`Done — ran ${statements.length} statement(s).`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
