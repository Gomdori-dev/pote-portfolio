import { cache } from "react";
import { revalidatePath } from "next/cache";
import { getArtwork } from "@/lib/artworks";
import { getSubmissionById } from "@/lib/artist-portal-db";
import { getSql } from "@/lib/db";
import { isTranslationMissing, translateToEnglish, translateToKorean } from "@/lib/translate";
import { koreanizeDetails } from "@/lib/korean-labels";
import { validPortalDimensions } from "@/lib/portal-dimensions";
import type { Artwork, ArtistSlug } from "@/lib/artists";
import { getRegistrationDetails } from "@/lib/artwork-registration-details";

type CopyEdit = {
  slug: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  price: string | null;
};

const SUBMISSION_ID = /^submission-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const getStaticCopyEdits = cache(async (): Promise<Map<string, CopyEdit>> => {
  try {
    const rows = (await getSql()`SELECT slug, title_ko, title_en, description_ko, description_en, details_ko, details_en, price FROM artwork_copy_edits`) as CopyEdit[];
    return new Map(rows.map((row) => [row.slug, row]));
  } catch (error) {
    console.warn("artwork-copy-edits: could not load edits", error);
    return new Map();
  }
});

export function applyStaticCopyEdits(artworks: Artwork[], edits: Map<string, CopyEdit>): Artwork[] {
  return artworks.map((artwork) => {
    const edit = edits.get(artwork.slug);
    if (!edit) return artwork;
    return {
      ...artwork,
      ko: { ...artwork.ko, title: edit.title_ko, description: edit.description_ko, details: edit.details_ko || artwork.ko.details },
      en: { ...artwork.en, title: edit.title_en, description: edit.description_en, details: edit.details_en || artwork.en.details },
      price: edit.price === null ? artwork.price : edit.price || undefined,
    };
  });
}

export type CopyEditResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" | "invalid_fields" };

export async function updateArtworkCopy(
  slug: string,
  artistSlug: ArtistSlug,
  titleValue: string,
  descriptionValue: string,
  detailsValue: string,
  priceValue: string,
  inputLang: "ko" | "en" = "ko",
): Promise<CopyEditResult> {
  const title = titleValue.trim();
  const description = descriptionValue.trim();
  const details = detailsValue.trim();
  let price = priceValue.trim();
  if (!title || title.length > 200 || description.length > 5000 || details.length > 500 || price.length > 100) return { ok: false, error: "invalid_fields" };

  const staticWork = getArtwork(slug);
  const submissionId = slug.match(SUBMISSION_ID)?.[1];
  const submission = !staticWork && submissionId ? await getSubmissionById(submissionId) : null;
  if (!staticWork && !submission) return { ok: false, error: "not_found" };
  if ((staticWork?.artistSlug ?? submission?.artist_slug) !== artistSlug) return { ok: false, error: "forbidden" };
  const hasRegistration = staticWork ? (await getRegistrationDetails()).has(slug) : Boolean(submission?.extras.pricing);
  if (hasRegistration && price) {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:원)?$/.test(price) || Number(price.replace(/\D/g, "")) <= 0 || !Number.isSafeInteger(Number(price.replace(/\D/g, "")))) return { ok: false, error: "invalid_fields" };
    price = `${Number(price.replace(/\D/g, "")).toLocaleString("en-US")}원`;
  }

  const current = staticWork
    ? (await getStaticCopyEdits()).get(slug) ?? {
        title_ko: staticWork.ko.title, title_en: staticWork.en.title,
        description_ko: staticWork.ko.description, description_en: staticWork.en.description,
        details_ko: staticWork.ko.details, details_en: staticWork.en.details, price: staticWork.price ?? null,
      }
    : submission!;
  const source = inputLang === "ko" ? "_ko" : "_en";
  const target = inputLang === "ko" ? "_en" : "_ko";
  // Existing catalogue text can use older size conventions. Check newly
  // entered dimensions without blocking an unrelated title or price edit.
  if (details !== current[`details${source}`] && !validPortalDimensions(details)) {
    return { ok: false, error: "invalid_fields" };
  }
  const targetLang = inputLang === "ko" ? "en" : "ko";
  const translateTitle = title !== current[`title${source}`] || isTranslationMissing(title, current[`title${target}`], targetLang);
  const translateDescription = description !== current[`description${source}`] || isTranslationMissing(description, current[`description${target}`], targetLang);
  const translateDetails = details !== current[`details${source}`] || isTranslationMissing(details, current[`details${target}`], targetLang);
  const changed = translateTitle || translateDescription || translateDetails;
  const translated = changed
    ? await (inputLang === "ko" ? translateToEnglish : translateToKorean)({ title, description, details, palette: "" })
    : { title: current[`title${target}`], description: current[`description${target}`], details: current[`details${target}`] };
  const titleOther = translateTitle ? translated.title : current[`title${target}`];
  const descriptionOther = translateDescription ? translated.description : current[`description${target}`];
  const detailsOther = translateDetails ? translated.details : current[`details${target}`];
  const titleKo = inputLang === "ko" ? title : titleOther;
  const titleEn = inputLang === "en" ? title : titleOther;
  const descriptionKo = inputLang === "ko" ? description : descriptionOther;
  const descriptionEn = inputLang === "en" ? description : descriptionOther;
  const detailsKo = koreanizeDetails(inputLang === "ko" ? details : detailsOther);
  const detailsEn = inputLang === "en" ? details : detailsOther;
  const sql = getSql();

  if (staticWork) {
    await sql.transaction([sql`
      INSERT INTO artwork_copy_edits (slug, artist_slug, title_ko, title_en, description_ko, description_en, details_ko, details_en, price, updated_at)
      VALUES (${slug}, ${artistSlug}, ${titleKo}, ${titleEn}, ${descriptionKo}, ${descriptionEn}, ${detailsKo}, ${detailsEn}, ${price}, now())
      ON CONFLICT (slug) DO UPDATE SET title_ko = ${titleKo}, title_en = ${titleEn},
        description_ko = ${descriptionKo}, description_en = ${descriptionEn}, details_ko = ${detailsKo}, details_en = ${detailsEn}, price = ${price}, updated_at = now()
    `, sql`UPDATE artwork_registration_details SET price = ${price || null},
      extras = jsonb_set(extras, '{pricing}', ${JSON.stringify(price ? "fixed" : "inquiry")}::jsonb), updated_at = now()
      WHERE slug = ${slug} AND artist_slug = ${artistSlug}`]);
  } else {
    await sql`
      UPDATE artwork_submissions SET title_ko = ${titleKo}, title_en = ${titleEn},
        description_ko = ${descriptionKo}, description_en = ${descriptionEn}, details_ko = ${detailsKo}, details_en = ${detailsEn}, price = ${price},
        extras = CASE WHEN extras ? 'pricing' THEN jsonb_set(extras, '{pricing}', ${JSON.stringify(price ? "fixed" : "inquiry")}::jsonb) ELSE extras END,
        ai_review = CASE WHEN status = 'pending' THEN NULL ELSE ai_review END
      WHERE id = ${submission!.id} AND artist_slug = ${artistSlug}
    `;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
