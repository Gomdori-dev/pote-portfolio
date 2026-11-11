import { put } from "@vercel/blob";
import { after, NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { artists, type ArtistSlug } from "@/lib/artists";
import { changeMainImage } from "@/lib/artwork-main-images";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getSubmissionById } from "@/lib/artist-portal-db";
import { emailReview, reviewSubmission, sendToOwner } from "@/lib/artwork-review";
import { SITE_URL } from "@/lib/site";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const deadline = Date.now() + 50_000;
  const sessionSlug = getArtistSlugFromRequest(request);
  if (!sessionSlug || !Object.hasOwn(artists, sessionSlug)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const slug = form?.get("slug");
  const image = form?.get("image");
  if (typeof slug !== "string" || !slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  if (!(image instanceof File) || !image.size || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "image_too_large" }, { status: 413 });

  try {
    const result = await changeMainImage(slug, sessionSlug as ArtistSlug, async (owner) => {
      const safeName = image.name.replace(/[^\w.-]+/g, "_").slice(-60) || "image.jpg";
      const blob = await put(`main-images/${owner}/${crypto.randomUUID()}-${safeName}`, image, { access: "public" });
      return blob.url;
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.error === "forbidden" ? 403 : 404 });
    }
    after(async () => {
      const submissionId = slug.match(/^submission-([0-9a-f-]{36})$/i)?.[1];
      const submission = submissionId ? await getSubmissionById(submissionId) : null;
      if (submission?.status === "pending") {
        const review = await reviewSubmission(submission, Math.min(deadline, Date.now() + 40_000));
        if (review) await emailReview(submission, review);
      } else {
        const link = submission?.status === "rejected" ? `${SITE_URL}/artist-portal` : `${SITE_URL}/artworks/${slug}`;
        await sendToOwner(
          `[Pote] ${artists[sessionSlug as ArtistSlug].name.ko} 작가가 대표 그림을 교체했어요`,
          `확인: ${link}\n새 대표 그림이 저장됐어요.`,
        );
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    console.error("artist-works/main-image POST failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
