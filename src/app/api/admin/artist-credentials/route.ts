import { NextRequest, NextResponse } from "next/server";
import { artists } from "@/lib/artists";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized, hashPassword, generateInitialPassword } from "@/lib/artist-auth";
import { upsertCredential } from "@/lib/artist-portal-db";

/**
 * Issues or resets an artist's login password. Returns the plaintext
 * password exactly once in this response — the admin UI must show it once
 * and never persist or log it; only the hash+salt are stored.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const artistSlug = typeof body?.artistSlug === "string" ? body.artistSlug : "";
  if (!artistSlug || !Object.hasOwn(artists, artistSlug)) {
    return NextResponse.json({ error: "invalid_artist_slug" }, { status: 400 });
  }

  try {
    const password = generateInitialPassword();
    const { hash, salt } = hashPassword(password);
    await upsertCredential(artistSlug, hash, salt);
    return NextResponse.json({ artistSlug, password });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("admin/artist-credentials POST failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
