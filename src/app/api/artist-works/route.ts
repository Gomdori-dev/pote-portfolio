import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { artists, type ArtistSlug } from "@/lib/artists";
import { listManagedWorks, performWorkAction, type WorkAction } from "@/lib/artwork-controls";

/**
 * 작가 포털 "내 작품 관리". 로그인한 작가의 작품만 보여주고, 바꾸기도 자기 작품만 된다.
 * 작가 slug는 요청 본문이 아니라 서명된 세션 쿠키에서만 읽는다.
 */

function sessionArtist(request: NextRequest): ArtistSlug | null {
  const slug = getArtistSlugFromRequest(request);
  return slug && Object.hasOwn(artists, slug) ? (slug as ArtistSlug) : null;
}

function failure(error: unknown, where: string) {
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  console.error(`artist-works ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const artistSlug = sessionArtist(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ works: await listManagedWorks(artistSlug) });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  const artistSlug = sessionArtist(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const action = typeof body?.action === "string" ? (body.action as WorkAction) : ("" as WorkAction);
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  try {
    const result = await performWorkAction(slug, action, artistSlug);
    if (!result.ok) {
      const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "POST");
  }
}
