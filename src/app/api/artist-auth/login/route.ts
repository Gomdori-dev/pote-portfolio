import { NextRequest, NextResponse } from "next/server";
import { artists } from "@/lib/artists";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getCredential } from "@/lib/artist-portal-db";
import {
  ARTIST_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionCookie,
  verifyPassword,
} from "@/lib/artist-auth";
import { blocked, clientIp, recordFailure } from "@/lib/rate-limit";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!process.env.ARTIST_SESSION_SECRET) {
    return NextResponse.json({ error: "session_secret_not_configured" }, { status: 503 });
  }

  const failKey = `artist-login:${clientIp(request)}`;
  if (blocked(failKey, FAIL_LIMIT, FAIL_WINDOW_MS)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const artistSlug = typeof body?.artistSlug === "string" ? body.artistSlug : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!artistSlug || !password || !Object.hasOwn(artists, artistSlug)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const credential = await getCredential(artistSlug);
    if (!credential || !verifyPassword(password, credential.salt, credential.password_hash)) {
      recordFailure(failKey, FAIL_WINDOW_MS);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true, artistSlug });
    response.cookies.set(ARTIST_SESSION_COOKIE, createSessionCookie(artistSlug), SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("artist-auth/login failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
