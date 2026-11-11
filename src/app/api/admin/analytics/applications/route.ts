import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { analyticsSql } from "@/lib/analytics-server";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return json({ error: "unauthorized" }, 401);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const from = request.nextUrl.searchParams.get("from") ?? today;
  const to = request.nextUrl.searchParams.get("to") ?? today;
  const day = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!day(from) || !day(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400_000) return json({ message: "시작일과 종료일을 확인해 주세요(최대 367일)." }, 400);
  try {
    const sql = analyticsSql();
    const rows = await sql`
      WITH period AS (
        SELECT * FROM analytics_applications WHERE created_at >= ${from + "T00:00:00+09:00"}::timestamptz AND created_at < ${to + "T00:00:00+09:00"}::timestamptz + interval '1 day'
      )
      SELECT source, medium, campaign, content, term,
        count(DISTINCT session_id) FILTER (WHERE event_type = 'visit')::int AS visits,
        count(DISTINCT session_id) FILTER (WHERE event_type = 'start' AND session_id IN (SELECT session_id FROM period WHERE event_type = 'visit'))::int AS starts,
        count(*) FILTER (WHERE event_type = 'accepted')::int AS applications,
        count(DISTINCT session_id) FILTER (WHERE event_type = 'accepted' AND session_id IN (SELECT session_id FROM period WHERE event_type = 'visit'))::int AS converted,
        count(*) FILTER (WHERE event_type = 'accepted' AND (session_id IS NULL OR session_id NOT IN (SELECT session_id FROM period WHERE event_type = 'visit')))::int AS unmatched
      FROM period GROUP BY source, medium, campaign, content, term
      ORDER BY applications DESC, visits DESC, campaign, content`;
    const first = await sql`SELECT min(created_at) AS first FROM analytics_applications`;
    return json({ from, to, collectionStart: first[0]?.first ?? null, rows });
  } catch { console.error("application report failed"); return json({ message: "신청 성과를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." }, 500); }
}
