import { NextResponse } from "next/server";
import { ARTIST_SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/artist-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ARTIST_SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
