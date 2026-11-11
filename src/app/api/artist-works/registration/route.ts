import { NextRequest, NextResponse } from "next/server";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { saveRegistrationDetails } from "@/lib/artwork-registration-details";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { artists, type ArtistSlug } from "@/lib/artists";
import { schedulePendingReview } from "@/lib/artwork-review-worker";

export const maxDuration = 60;
export async function PATCH(request: NextRequest) {
  const deadline = Date.now() + 50_000;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const artist = getArtistSlugFromRequest(request);
  if (!artist || !Object.hasOwn(artists, artist)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 20_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (body && JSON.stringify(body).length > 20_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (typeof body?.slug !== "string" || typeof body?.price !== "string" || body.price.length > 100 || !body.extras || typeof body.extras !== "object") return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  try {
    const result = await saveRegistrationDetails(body.slug, artist as ArtistSlug, body.extras, body.price, body.inputLang === "en" ? "en" : "ko");
    if (result.ok) schedulePendingReview(body.slug, deadline);
    return NextResponse.json(result, { status: result.ok ? 200 : result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof DatabaseNotConfiguredError ? "db_not_configured" : "save_failed" }, { status: error instanceof DatabaseNotConfiguredError ? 503 : 500 });
  }
}
