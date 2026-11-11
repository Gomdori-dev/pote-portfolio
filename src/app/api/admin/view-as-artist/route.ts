import { NextRequest, NextResponse } from "next/server";
import { artists } from "@/lib/artists";
import { ARTIST_SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createSessionCookie, isAdminAuthorized } from "@/lib/artist-auth";

/**
 * 관리자가 작가 비밀번호 없이 그 작가의 포털(/artist-portal)을 열어 보게 한다
 * (2026-09-25 사용자 요청 — 포털이 어떻게 보이는지 관리자가 직접 확인하려고).
 * 관리자 인증이 된 요청에만 작가 세션 쿠키를 발급한다. 작가 비밀번호는 건드리지 않는다.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ARTIST_SESSION_SECRET) {
    return NextResponse.json({ error: "session_secret_not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const artistSlug = typeof body?.artistSlug === "string" ? body.artistSlug : "";
  if (!artistSlug || !Object.hasOwn(artists, artistSlug)) {
    return NextResponse.json({ error: "invalid_artist_slug" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, artistSlug });
  response.cookies.set(ARTIST_SESSION_COOKIE, createSessionCookie(artistSlug), SESSION_COOKIE_OPTIONS);
  return response;
}
