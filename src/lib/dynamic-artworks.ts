import { getSql, DatabaseNotConfiguredError } from "@/lib/db";
import { artists, type Artwork, type ArtistSlug, type MoodKey, type StatusKey } from "@/lib/artists";
import { koreanizeDetails, koreanizePaletteText } from "@/lib/korean-labels";
import { parseArtworkExtras } from "@/lib/artwork-extras";
import { cache } from "react";

const KNOWN_MOOD_KEYS: MoodKey[] = ["quiet", "warm", "vivid", "delicate"];
const KNOWN_STATUS_KEYS: StatusKey[] = ["available", "sold", "pending"];

// Same labels the static catalog writes out by hand per artwork (and the
// portal's own selects show), so a portal work's "분위기"/"작품 상태" rows
// aren't blank on the detail page.
const MOOD_LABEL: Record<MoodKey, { ko: string; en: string }> = {
  quiet: { ko: "고요한", en: "Quiet" },
  warm: { ko: "따뜻한", en: "Warm" },
  vivid: { ko: "선명한", en: "Vivid" },
  delicate: { ko: "섬세한", en: "Delicate" },
};
export const STATUS_LABEL: Record<StatusKey, { ko: string; en: string }> = {
  available: { ko: "문의 가능", en: "Available" },
  sold: { ko: "판매 완료", en: "Sold" },
  pending: { ko: "예약 중", en: "Pending" },
};

type SubmissionRow = {
  id: string;
  artist_slug: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  palette_ko: string | null;
  palette_en: string | null;
  mood_key: string;
  status_key: string;
  price: string | null;
  image_urls: unknown;
  extras?: unknown;
};

// "화이트, 오커 · 블루" → ["화이트", "오커", "블루"]; empty stays [].
function splitPalette(value: string | null): string[] {
  return (value ?? "").split(/[,·、]/).map((item) => item.trim()).filter(Boolean);
}

/**
 * Maps one `artwork_submissions` row to the existing `Artwork` shape used
 * everywhere else on the site. Returns null (and logs a warning) for a row
 * that can't be mapped safely — e.g. an artist slug no longer in the
 * `artists` registry, or malformed `image_urls` — rather than letting one bad
 * row crash every page that renders the catalog.
 *
 * `palette` comes from the portal's optional "주요 색상" field and may be
 * empty — every caller already treats an empty palette defensively, and the
 * detail page hides the row when there's nothing in it.
 */
function rowToArtwork(row: SubmissionRow): Artwork | null {
  if (!Object.hasOwn(artists, row.artist_slug)) {
    console.warn(`dynamic-artworks: skipping submission ${row.id} — unknown artist_slug "${row.artist_slug}"`);
    return null;
  }
  const moodKey = KNOWN_MOOD_KEYS.includes(row.mood_key as MoodKey) ? (row.mood_key as MoodKey) : "quiet";
  const statusKey = KNOWN_STATUS_KEYS.includes(row.status_key as StatusKey) ? (row.status_key as StatusKey) : "available";

  let imageUrls: string[] = [];
  try {
    const parsed = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : row.image_urls;
    if (Array.isArray(parsed)) imageUrls = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Fall through with an empty list — handled just below.
  }
  if (imageUrls.length === 0) {
    console.warn(`dynamic-artworks: skipping submission ${row.id} — no usable image_urls`);
    return null;
  }

  return {
    slug: `submission-${row.id}`,
    image: imageUrls[0],
    // All of them: the detail page lets visitors step through each angle.
    images: imageUrls.length > 1 ? imageUrls : undefined,
    artistSlug: row.artist_slug as ArtistSlug,
    moodKey,
    statusKey,
    price: row.price ?? undefined,
    extras: parseArtworkExtras(row.extras),
    ko: {
      title: row.title_ko,
      description: row.description_ko,
      details: koreanizeDetails(row.details_ko),
      mood: MOOD_LABEL[moodKey].ko,
      status: STATUS_LABEL[statusKey].ko,
      palette: splitPalette(koreanizePaletteText(row.palette_ko ?? "")),
    },
    en: {
      title: row.title_en,
      description: row.description_en,
      details: row.details_en,
      mood: MOOD_LABEL[moodKey].en,
      status: STATUS_LABEL[statusKey].en,
      palette: splitPalette(row.palette_en),
    },
  };
}

/**
 * Approved artist-submitted artworks, mapped into the same `Artwork` shape as
 * the static catalog. Never throws: if the DB isn't configured yet (common
 * during this feature's rollout, and always true at `next build` time until
 * the Neon integration finishes) or any query fails, this logs a warning and
 * returns an empty list so every caller (pages, sitemap, etc.) degrades to
 * "just the static catalog" instead of failing.
 */
export const getApprovedSubmissions = cache(async (): Promise<Artwork[]> => {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, artist_slug, title_ko, title_en, description_ko, description_en,
             details_ko, details_en, palette_ko, palette_en, mood_key, status_key, price, image_urls, extras
      FROM artwork_submissions
      WHERE status = 'approved'
      ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
    `) as unknown as SubmissionRow[];
    return rows.map(rowToArtwork).filter((artwork): artwork is Artwork => artwork !== null);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      console.warn("dynamic-artworks: database not configured yet, returning no approved submissions");
    } else {
      console.warn("dynamic-artworks: failed to load approved submissions", error);
    }
    return [];
  }
});
