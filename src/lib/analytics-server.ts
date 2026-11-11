import { getSql } from "@/lib/db";
import { recordInquiry, type InquiryMeta, type Sql } from "@/lib/analytics-store";

/**
 * .env.local points at the production database, so local dev, previews and
 * builds must never write funnel rows. ANALYTICS_FORCE_COLLECT=1 is only for
 * a run against an isolated test database.
 */
export function analyticsCollectionEnabled() {
  return process.env.VERCEL_ENV === "production" || process.env.ANALYTICS_FORCE_COLLECT === "1";
}

export const analyticsSql = () => getSql() as unknown as Sql;

/** Runs after the mail provider accepted an inquiry; never affects its response. */
export async function recordInquirySafely(meta: InquiryMeta) {
  if (!analyticsCollectionEnabled()) return;
  try {
    await recordInquiry(analyticsSql(), meta);
  } catch {
    console.error("analytics inquiry record failed");
  }
}
