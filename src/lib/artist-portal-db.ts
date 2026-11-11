import { parseArtworkExtras, type ArtworkExtras } from "@/lib/artwork-extras";
import { getSql } from "@/lib/db";
import { parseAiReview, type AiReview } from "@/lib/artwork-review";
import { ArtworkTranslationError, isTranslationMissing, translateToEnglish } from "@/lib/translate";

/**
 * Raw DB operations backing the artist portal + admin approval API routes.
 * Unlike `dynamic-artworks.ts` (which must never throw, since it feeds page
 * rendering and `next build`), these throw on any DB error — every route
 * handler that calls into this module wraps the call in try/catch and turns
 * a `DatabaseNotConfiguredError` (or any other DB error) into a clear JSON
 * `503`/`500` response, per the "must catch DB errors" requirement.
 */

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type SubmissionRecord = {
  id: string;
  artist_slug: string;
  status: SubmissionStatus;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  palette_ko: string;
  palette_en: string;
  mood_key: string;
  status_key: string;
  price: string | null;
  image_urls: string[];
  /** 액자·설치 등 부가 정보(src/lib/artwork-extras.ts). */
  extras: ArtworkExtras;
  /** Raw JSON snapshot for the reviewer's compare-and-set; never use for display. */
  review_extras?: unknown;
  admin_note: string | null;
  /** 자동 검토 결과(src/lib/artwork-review.ts). 아직 검토 전이면 null. */
  ai_review: AiReview | null;
  created_at: string;
  reviewed_at: string | null;
};

type RawSubmissionRow = Omit<SubmissionRecord, "image_urls" | "extras" | "ai_review"> & { image_urls: unknown; extras?: unknown; ai_review?: unknown };

function normalizeImageUrls(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // fall through
  }
  return [];
}

function normalizeSubmission(row: RawSubmissionRow): SubmissionRecord {
  return {
    ...row,
    image_urls: normalizeImageUrls(row.image_urls),
    extras: parseArtworkExtras(row.extras),
    review_extras: row.extras ?? {},
    ai_review: parseAiReview(row.ai_review),
  };
}

// --- artist_credentials ------------------------------------------------

export async function getCredential(artistSlug: string): Promise<{ password_hash: string; salt: string } | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT password_hash, salt FROM artist_credentials WHERE artist_slug = ${artistSlug}
  `) as { password_hash: string; salt: string }[];
  return rows[0] ?? null;
}

export async function upsertCredential(artistSlug: string, hash: string, salt: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO artist_credentials (artist_slug, password_hash, salt, updated_at)
    VALUES (${artistSlug}, ${hash}, ${salt}, now())
    ON CONFLICT (artist_slug) DO UPDATE SET password_hash = ${hash}, salt = ${salt}, updated_at = now()
  `;
}

// --- admin_credentials (single row) -------------------------------------

export async function getAdminCredential(): Promise<{ password_hash: string; salt: string } | null> {
  const sql = getSql();
  const rows = (await sql`SELECT password_hash, salt FROM admin_credentials WHERE id = 1`) as {
    password_hash: string;
    salt: string;
  }[];
  return rows[0] ?? null;
}

export async function upsertAdminCredential(hash: string, salt: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO admin_credentials (id, password_hash, salt, updated_at)
    VALUES (1, ${hash}, ${salt}, now())
    ON CONFLICT (id) DO UPDATE SET password_hash = ${hash}, salt = ${salt}, updated_at = now()
  `;
}

// --- artwork_submissions -------------------------------------------------

export async function insertSubmission(input: {
  artistSlug: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  detailsKo: string;
  detailsEn: string;
  paletteKo: string;
  paletteEn: string;
  moodKey: string;
  statusKey: string;
  price: string | null;
  imageUrls: string[];
  extras: ArtworkExtras;
}): Promise<SubmissionRecord> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO artwork_submissions (
      artist_slug, title_ko, title_en, description_ko, description_en,
      details_ko, details_en, palette_ko, palette_en, mood_key, status_key, price, image_urls, extras
    ) VALUES (
      ${input.artistSlug}, ${input.titleKo}, ${input.titleEn}, ${input.descriptionKo}, ${input.descriptionEn},
      ${input.detailsKo}, ${input.detailsEn}, ${input.paletteKo}, ${input.paletteEn}, ${input.moodKey}, ${input.statusKey}, ${input.price},
      ${JSON.stringify(input.imageUrls)}, ${JSON.stringify(input.extras)}
    )
    RETURNING *
  `) as RawSubmissionRow[];
  return normalizeSubmission(rows[0]);
}

export async function listSubmissionsForArtist(artistSlug: string): Promise<SubmissionRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM artwork_submissions WHERE artist_slug = ${artistSlug} ORDER BY created_at DESC
  `) as RawSubmissionRow[];
  return rows.map(normalizeSubmission);
}

export async function listSubmissionsForAdmin(status?: SubmissionStatus): Promise<SubmissionRecord[]> {
  const sql = getSql();
  const rows = (
    status
      ? await sql`SELECT * FROM artwork_submissions WHERE status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM artwork_submissions ORDER BY created_at DESC`
  ) as RawSubmissionRow[];
  return rows.map(normalizeSubmission);
}

/** Retry interrupted/failed runs after their lease has expired. Bound each cron batch. */
export async function listUnreviewedPending(): Promise<SubmissionRecord[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM artwork_submissions WHERE status = 'pending'
      AND (ai_review IS NULL OR (ai_review->>'retryable' = 'true'
        AND COALESCE(ai_review->>'checkedAt', '') < to_char((now() - interval '2 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    ORDER BY COALESCE(ai_review->>'checkedAt', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    LIMIT 4
  `) as RawSubmissionRow[];
  return rows.map(normalizeSubmission);
}

export async function getSubmissionById(id: string): Promise<SubmissionRecord | null> {
  const sql = getSql();
  const rows = (await sql`SELECT * FROM artwork_submissions WHERE id = ${id}`) as RawSubmissionRow[];
  return rows[0] ? normalizeSubmission(rows[0]) : null;
}

export async function approveSubmission(id: string): Promise<SubmissionRecord | null> {
  const sql = getSql();
  const current = await getSubmissionById(id);
  if (!current) return null;
  const source = { title: current.title_ko, description: current.description_ko, details: current.details_ko, palette: current.palette_ko, condition: current.extras.conditionNoteKo };
  const english = { title: current.title_en, description: current.description_en, details: current.details_en, palette: current.palette_en, condition: current.extras.conditionNoteEn };
  const fields = ["title", "description", "details", "palette", "condition"] as const;
  if (fields.some((field) => isTranslationMissing(source[field] ?? "", english[field]))) {
    const translated = await translateToEnglish(source);
    for (const field of fields) {
      if (isTranslationMissing(source[field] ?? "", english[field])) english[field] = translated[field] ?? "";
    }
    // Both approval routes share this guard. Do not overwrite an edit made
    // while the translator was running, or approve with untranslated copy.
    const extrasPatch = english.condition ? { conditionNoteEn: english.condition } : {};
    const repaired = (await sql`
      UPDATE artwork_submissions SET title_en = ${english.title}, description_en = ${english.description},
        details_en = ${english.details}, palette_en = ${english.palette}, extras = COALESCE(extras::jsonb, '{}'::jsonb) || ${JSON.stringify(extrasPatch)}::jsonb,
        status = 'approved', reviewed_at = now(), admin_note = NULL
      WHERE id = ${id} AND status = ${current.status}
        AND title_ko = ${current.title_ko} AND description_ko = ${current.description_ko}
        AND details_ko = ${current.details_ko} AND palette_ko = ${current.palette_ko}
        AND title_en = ${current.title_en} AND description_en = ${current.description_en}
        AND details_en = ${current.details_en} AND palette_en = ${current.palette_en}
        AND COALESCE(extras::jsonb->>'conditionNoteKo', '') = ${current.extras.conditionNoteKo ?? ""}
        AND COALESCE(extras::jsonb->>'conditionNoteEn', '') = ${current.extras.conditionNoteEn ?? ""}
      RETURNING *
    `) as RawSubmissionRow[];
    if (!repaired[0]) throw new ArtworkTranslationError();
    return normalizeSubmission(repaired[0]);
  }
  const rows = (await sql`
    UPDATE artwork_submissions SET status = 'approved', reviewed_at = now(), admin_note = NULL
    WHERE id = ${id} RETURNING *
  `) as RawSubmissionRow[];
  return rows[0] ? normalizeSubmission(rows[0]) : null;
}

export async function rejectSubmission(id: string, note: string | null): Promise<SubmissionRecord | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE artwork_submissions SET status = 'rejected', reviewed_at = now(), admin_note = ${note}
    WHERE id = ${id} RETURNING *
  `) as RawSubmissionRow[];
  return rows[0] ? normalizeSubmission(rows[0]) : null;
}
