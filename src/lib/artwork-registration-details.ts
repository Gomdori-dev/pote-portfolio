import { cache } from "react";
import { revalidatePath } from "next/cache";
import { getSql, DatabaseNotConfiguredError } from "./db";
import { getArtwork } from "./artworks";
import { getSubmissionById } from "./artist-portal-db";
import { getStaticProofPhotos } from "./artwork-proof-photos";
import { getArtworkControls } from "./artwork-controls";
import { parseArtworkExtras } from "./artwork-extras";
import { registrationError } from "./artwork-registration";
import { translateToEnglish, translateToKorean } from "./translate";
import type { Artwork, ArtistSlug } from "./artists";

type Row = { slug: string; extras: unknown; price: string | null };
export const getRegistrationDetails = cache(async (): Promise<Map<string, Row>> => {
  try {
    const rows = await getSql()`SELECT slug, extras, price FROM artwork_registration_details` as Row[];
    return new Map(rows.map((row) => [row.slug, row]));
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError || (error as { code?: string })?.code === "42P01") return new Map();
    // A failed lookup must not hide a previously disclosed defect.
    throw error;
  }
});

export function applyRegistrationDetails(list: Artwork[], values: Map<string, Row>): Artwork[] {
  return list.map((artwork) => {
    const row = values.get(artwork.slug);
    return row ? { ...artwork, extras: { ...artwork.extras, ...parseArtworkExtras(row.extras) }, price: row.price ?? undefined } : artwork;
  });
}

export async function saveRegistrationDetails(slug: string, artistSlug: ArtistSlug, raw: unknown, price: string, lang: "ko" | "en") {
  const staticWork = getArtwork(slug);
  const id = slug.match(/^submission-([0-9a-f-]{36})$/i)?.[1];
  const submission = !staticWork && id ? await getSubmissionById(id) : null;
  if (!staticWork && !submission) return { ok: false, error: "not_found" } as const;
  if ((staticWork?.artistSlug ?? submission?.artist_slug) !== artistSlug) return { ok: false, error: "forbidden" } as const;
  if ((await getArtworkControls()).get(slug)?.deleted) return { ok: false, error: "not_found" } as const;
  const extras = parseArtworkExtras(raw);
  // Existing classified works retain their medium when an older form omits it.
  extras.medium ??= submission?.extras.medium ?? staticWork?.extras?.medium;
  const photos = staticWork ? (await getStaticProofPhotos()).get(slug) : submission?.extras.proof;
  const normalizedPrice = extras.pricing === "fixed" ? price.trim().replace(/\s/g, "").replace(/원$/, "") : "";
  const error = registrationError(extras, normalizedPrice, Boolean(photos?.edge));
  if (error) return { ok: false, error } as const;
  const note = lang === "ko" ? extras.conditionNoteKo : extras.conditionNoteEn;
  if (extras.condition === "issues" && !note?.trim()) return { ok: false, error: "registrationConditionError" } as const;
  if (extras.condition === "issues" && note) {
    const translated = await (lang === "ko" ? translateToEnglish : translateToKorean)({ title: "Condition report", description: "", details: "Condition report", palette: "", condition: note });
    extras.conditionNoteKo = lang === "ko" ? note : translated.condition;
    extras.conditionNoteEn = lang === "en" ? note : translated.condition;
  } else {
    delete extras.conditionNoteKo;
    delete extras.conditionNoteEn;
  }
  // Photos are managed separately, so a stale form cannot replace or delete them.
  delete extras.proof;
  if (extras.signature !== "signed") delete extras.signatureLocation;
  const savedPrice = extras.pricing === "fixed" ? `${Number(normalizedPrice.replace(/,/g, "")).toLocaleString("en-US")}원` : null;
  if (staticWork) {
    await getSql()`INSERT INTO artwork_registration_details (slug, artist_slug, extras, price, updated_at)
      VALUES (${slug}, ${artistSlug}, ${JSON.stringify(extras)}, ${savedPrice}, now())
      ON CONFLICT (slug) DO UPDATE SET extras = ${JSON.stringify(extras)}, price = ${savedPrice}, updated_at = now()`;
  } else {
    await getSql()`UPDATE artwork_submissions SET extras =
      (COALESCE(extras, '{}'::jsonb) - 'conditionNoteKo' - 'conditionNoteEn' - 'signatureLocation') || ${JSON.stringify(extras)}::jsonb,
      price = ${savedPrice}, ai_review = CASE WHEN status = 'pending' THEN NULL ELSE ai_review END
      WHERE id = ${submission!.id} AND artist_slug = ${artistSlug}`;
  }
  revalidatePath("/", "layout");
  return { ok: true } as const;
}
