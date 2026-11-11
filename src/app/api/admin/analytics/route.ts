import { NextRequest, NextResponse } from "next/server";
import { getSql, DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";

export async function GET(req: NextRequest) {
  const authorized = await isAdminAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getSql();

    // 오늘 통계 — 서버 시간(UTC)이 아니라 한국 시간 자정 기준 (2026-10-20)
    const kstMidnight = (daysAgo: number) => new Date(`${new Date(Date.now() + 9 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
    const todayStart_iso = kstMidnight(0);

    const todayTotal = (await sql`
      SELECT COUNT(*) as count FROM visits WHERE created_at >= ${todayStart_iso}
    `) as Array<{ count: number }>;

    const todayByPath = (await sql`
      SELECT path, COUNT(*) as count FROM visits
      WHERE created_at >= ${todayStart_iso}
      GROUP BY path
      ORDER BY count DESC
    `) as Array<{ path: string; count: number }>;

    const todayByIp = (await sql`
      SELECT ip, COUNT(*) as count FROM visits
      WHERE created_at >= ${todayStart_iso}
      GROUP BY ip
      ORDER BY count DESC
    `) as Array<{ ip: string; count: number }>;

    // 지난 7일 통계
    const weekStart_iso = kstMidnight(7);

    const weekData = (await sql`
      SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul')::text as date, COUNT(*) as count
      FROM visits
      WHERE created_at >= ${weekStart_iso}
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Seoul')
      ORDER BY date ASC
    `) as Array<{ date: string; count: number }>;

    return NextResponse.json({
      today: {
        total: todayTotal[0]?.count || 0,
        byPath: todayByPath.reduce(
          (acc, row) => {
            acc[row.path] = row.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        byIp: todayByIp.map((row) => ({
          ip: row.ip,
          count: row.count,
        })),
      },
      week: weekData.map((row) => ({
        date: row.date,
        count: row.count,
      })),
    // 관리자 데이터는 공유·브라우저 캐시에 남기지 않는다.
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      );
    }
    console.error("Failed to get analytics:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
