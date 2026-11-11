import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const connection = process.env.REGISTRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING;
if (!connection || new URL(connection).hostname.includes("-pooler")) throw new Error("A direct database connection is required");
const sql = neon(connection);
await sql.query(readFileSync(new URL("./artwork-registration-schema.sql", import.meta.url), "utf8"));
const result = await sql`SELECT count(*)::int AS rows FROM artwork_registration_details`;
console.log("Registration schema ready; rows:", result[0].rows);
