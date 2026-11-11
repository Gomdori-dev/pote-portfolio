import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { blocked, clientIp, recordFailure } from "@/lib/rate-limit";

const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 10 * 60 * 1000;

// Hashing both sides first gives equal-length buffers, so timingSafeEqual
// never leaks the password length either.
function sameKey(a: string, b: string) {
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

export async function POST(request: Request) {
  const failKey = `studio-login:${clientIp(request)}`;
  if (blocked(failKey, FAIL_LIMIT, FAIL_WINDOW_MS)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const key = body?.key;
  const expected = process.env.ARTIST_STUDIO_PASSWORD;

  if (!expected || typeof key !== "string" || !sameKey(key, expected)) {
    recordFailure(failKey, FAIL_WINDOW_MS);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
