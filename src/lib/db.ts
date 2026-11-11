import { neon } from "@neondatabase/serverless";

/**
 * Thrown by `getSql()` when no database connection string is configured yet.
 * Every caller (both build-time data loaders and API routes) must catch this
 * specifically and degrade gracefully — the Neon integration may not be wired
 * up yet, and the site (including `next build`) must keep working without it.
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "No database connection string configured. Set DATABASE_URL, POSTGRES_URL, " +
        "or DATABASE_URL_UNPOOLED (Vercel's Neon integration will inject one of these).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * The exact env var name the Vercel/Neon marketplace integration ends up
 * using was not settled when this was written, so this checks every
 * plausible name in order. Throws `DatabaseNotConfiguredError` (never a raw
 * fetch/network error) when none are set, so callers can catch a single,
 * well-known error type and fall back cleanly instead of crashing a build or
 * a page render.
 */
export function getSql() {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new DatabaseNotConfiguredError();
  return neon(connectionString);
}
