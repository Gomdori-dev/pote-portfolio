import { cache } from "react";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { getArtwork } from "@/lib/artworks";
import { getSubmissionById } from "@/lib/artist-portal-db";
import { getSql } from "@/lib/db";
import type { Artwork, ArtistSlug } from "@/lib/artists";

type ImageEdit = { slug: string; url: string };
type ChangeResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" };
const SUBMISSION_ID = /^submission-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const getStaticMainImages = cache(async (): Promise<Map<string, string>> => {
  try {
    const rows = (await getSql()`SELECT slug, url FROM artwork_main_images`) as ImageEdit[];
    return new Map(rows.map(({ slug, url }) => [slug, url]));
  } catch (error) {
    console.warn("artwork-main-images: could not load images", error);
    return new Map();
  }
});

export function applyStaticMainImages(works: Artwork[], edits: Map<string, string>): Artwork[] {
  return works.map((work) => {
    const image = edits.get(work.slug);
    if (!image) return work;
    return {
      ...work,
      image,
      images: work.images?.length ? [image, ...work.images.slice(1)] : undefined,
    };
  });
}

/** Resolve ownership before uploading, then save the new URL and remove only an old Blob upload. */
export async function changeMainImage(
  slug: string,
  artistSlug: ArtistSlug,
  upload: (artistSlug: string) => Promise<string>,
): Promise<ChangeResult> {
  const staticWork = getArtwork(slug);
  const submissionId = slug.match(SUBMISSION_ID)?.[1];
  const submission = !staticWork && submissionId ? await getSubmissionById(submissionId) : null;
  if (!staticWork && !submission) return { ok: false, error: "not_found" };
  if ((staticWork?.artistSlug ?? submission?.artist_slug) !== artistSlug) return { ok: false, error: "forbidden" };
  const sql = getSql();
  const deleted = (await sql`SELECT deleted FROM artwork_controls WHERE slug = ${slug}`) as { deleted: boolean }[];
  if (deleted[0]?.deleted) return { ok: false, error: "not_found" };

  const url = await upload(artistSlug);
  let oldUrl: string | undefined;
  try {
    if (staticWork) {
      const previous = (await sql`SELECT url FROM artwork_main_images WHERE slug = ${slug}`) as ImageEdit[];
      oldUrl = previous[0]?.url;
      const rows = (await sql`
        INSERT INTO artwork_main_images (slug, artist_slug, url, updated_at)
        VALUES (${slug}, ${artistSlug}, ${url}, now())
        ON CONFLICT (slug) DO UPDATE SET url = ${url}, updated_at = now()
        RETURNING url
      `) as ImageEdit[];
      if (!rows.length) throw new Error("Main image was not saved");
    } else {
      // jsonb_set changes only the first photo, leaving additional views intact.
      const rows = (await sql`
        UPDATE artwork_submissions
        SET image_urls = jsonb_set(image_urls, '{0}', to_jsonb(${url}::text)),
            ai_review = CASE WHEN status = 'pending' THEN NULL ELSE ai_review END
        WHERE id = ${submission!.id} AND artist_slug = ${artistSlug}
          AND jsonb_typeof(image_urls) = 'array' AND jsonb_array_length(image_urls) > 0
        RETURNING image_urls
      `) as { image_urls: unknown }[];
      if (!rows.length) throw new Error("Main image was not saved");
      oldUrl = submission!.image_urls[0];
    }
  } catch (error) {
    await del(url).catch((cleanupError) => console.warn("artwork-main-images: uploaded file cleanup failed", cleanupError));
    throw error;
  }
  if (oldUrl?.includes(".public.blob.vercel-storage.com/")) {
    await del(oldUrl).catch((error) => console.warn("artwork-main-images: old file cleanup failed", error));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
