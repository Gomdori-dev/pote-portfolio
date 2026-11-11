import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { getAllArtworks } from "@/lib/all-artworks";
import { getArtist } from "@/lib/artists";
import { analyticsSql } from "@/lib/analytics-server";
import { journeysReport, overviewReport, parseReportQuery, type CatalogEntry } from "@/lib/analytics-report";

// Admin data must never sit in a shared or browser cache.
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return json({ error: "unauthorized" }, 401);
  const query = parseReportQuery(request.nextUrl.searchParams);
  if ("error" in query) return json({ error: "invalid_query", message: query.error }, 400);

  try {
    const catalog: CatalogEntry[] = (await getAllArtworks()).map((artwork) => ({
      slug: artwork.slug,
      title: artwork.ko.title,
      artistSlug: artwork.artistSlug,
      artistName: getArtist(artwork.artistSlug)?.name.ko ?? artwork.artistSlug,
    }));
    const sql = analyticsSql();
    const report = query.mode === "journeys" ? await journeysReport(sql, query, catalog) : await overviewReport(sql, query, catalog);
    return json({ query, ...report, ...(query.mode === "overview" ? { artistOptions: [...new Map(catalog.map((item) => [item.artistSlug, item.artistName]))].map(([slug, name]) => ({ slug, name })) } : {}) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return json({ error: "no_database", message: "데이터베이스 연결이 설정되지 않았습니다." }, 503);
    const missing = error instanceof Error && /analytics_\w+" does not exist/.test(error.message);
    console.error("admin funnel report failed");
    return json({ error: missing ? "not_migrated" : "query_failed", message: missing ? "분석 테이블이 아직 만들어지지 않았습니다." : "집계 조회 중 오류가 발생했습니다." }, 500);
  }
}
