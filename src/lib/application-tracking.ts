import { isUuid, type Sql } from "./analytics-store";

export type ApplicationSource = { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null; landing: string | null };
export type ApplicationTracking = { sessionId: string; attribution: ApplicationSource };
const clean = (v: unknown, max = 160) => typeof v === "string" && /^[A-Za-z0-9_.~-]+$/.test(v) ? v.slice(0, max) : null;

// Only campaign identifiers, never arbitrary URLs, query strings or form values.
export function applicationSource(value: unknown): ApplicationSource {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { source: clean(v.source), medium: clean(v.medium), campaign: clean(v.campaign), content: clean(v.content), term: clean(v.term), landing: typeof v.landing === "string" && /^\/[A-Za-z0-9/_-]*$/.test(v.landing) ? v.landing.slice(0, 200) : null };
}

export function parseApplicationTracking(value: unknown): ApplicationTracking | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return isUuid(v.sessionId) ? { sessionId: v.sessionId, attribution: applicationSource(v.attribution) } : null;
}

export function applicationSourceText(source: ApplicationSource) {
  return `신청 유입: ${source.source ?? "직접 방문 또는 알 수 없음"}\n매체: ${source.medium ?? "미확인"}\n캠페인: ${source.campaign ?? "미확인"}\n소재: ${source.content ?? "미확인"}\n광고 세트: ${source.term ?? "미확인"}\n첫 페이지: ${source.landing ?? "미확인"}`;
}

export async function recordApplicationEvent(sql: Sql, event: "visit" | "start" | "accepted", tracking: ApplicationTracking | null, applicationId?: string) {
  const a = applicationSource(tracking?.attribution);
  const key = event === "accepted" ? `accepted:${applicationId}` : `${event}:${tracking?.sessionId}`;
  return sql`INSERT INTO analytics_applications (event_key, event_type, session_id, source, medium, campaign, content, term, landing)
    VALUES (${key}, ${event}, ${tracking?.sessionId ?? null}, ${a.source}, ${a.medium}, ${a.campaign}, ${a.content}, ${a.term}, ${a.landing})
    ON CONFLICT (event_key) DO NOTHING RETURNING event_key`;
}
