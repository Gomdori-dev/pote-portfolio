import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, SESSION_COOKIE_OPTIONS, createAdminSessionCookie, verifyAdminPassword } from "@/lib/artist-auth";
import { blocked, clientIp, recordFailure } from "@/lib/rate-limit";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 10 * 60 * 1000;

/**
 * Not in the original route list, but needed to fulfil "set a short-lived
 * signed cookie after a successful password check" for the admin screen —
 * the admin page's client-side unlock form posts here once, then every
 * subsequent admin API call is authorized via this cookie (or, still, the
 * `x-admin-password` header directly — see `isAdminAuthorized`).
 */
export async function POST(request: NextRequest) {
  if (!process.env.ARTIST_SESSION_SECRET) {
    return NextResponse.json({ error: "session_secret_not_configured" }, { status: 503 });
  }
  const failKey = `admin-login:${clientIp(request)}`;
  if (blocked(failKey, FAIL_LIMIT, FAIL_WINDOW_MS)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await verifyAdminPassword(password))) {
    recordFailure(failKey, FAIL_WINDOW_MS);
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionCookie(), SESSION_COOKIE_OPTIONS);
  return response;
}
