import { NextRequest, NextResponse } from "next/server";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { artists, type ArtistSlug } from "@/lib/artists";
import { updateArtworkCopy } from "@/lib/artwork-copy-edits";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { ArtworkTranslationError } from "@/lib/translate";
import { schedulePendingReview } from "@/lib/artwork-review-worker";

export const maxDuration = 60;

export async function PATCH(request: NextRequest) {
  const deadline = Date.now() + 50_000;
  const sessionSlug = getArtistSlugFromRequest(request);
  if (!sessionSlug || !Object.hasOwn(artists, sessionSlug)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const inputLang = body?.inputLang === "en" ? "en" : "ko";
  const title = typeof body?.title === "string" ? body.title : typeof body?.titleKo === "string" ? body.titleKo : "";
  const description = typeof body?.description === "string" ? body.description : typeof body?.descriptionKo === "string" ? body.descriptionKo : "";
  const details = typeof body?.details === "string" ? body.details : typeof body?.detailsKo === "string" ? body.detailsKo : "";
  const price = typeof body?.price === "string" ? body.price : "";
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  try {
    const result = await updateArtworkCopy(slug, sessionSlug as ArtistSlug, title, description, details, price, inputLang);
    if (!result.ok) {
      const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    schedulePendingReview(slug, deadline);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ArtworkTranslationError) return NextResponse.json({ error: "portalTranslationError" }, { status: 503 });
    if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    console.error("artist-works copy PATCH failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
