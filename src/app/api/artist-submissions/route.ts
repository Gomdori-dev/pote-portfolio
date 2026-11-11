import { put } from "@vercel/blob";
import { after, NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { insertSubmission, listSubmissionsForArtist } from "@/lib/artist-portal-db";
import { emailReview, reviewSubmission } from "@/lib/artwork-review";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { ArtworkTranslationError, translateToEnglish, translateToKorean } from "@/lib/translate";
import { parseArtworkExtras, PROOF_KEYS, type ProofPhotos } from "@/lib/artwork-extras";
import type { MoodKey, StatusKey } from "@/lib/artists";
import { koreanizeDetails, koreanizePaletteText } from "@/lib/korean-labels";
import { validPortalDimensions } from "@/lib/portal-dimensions";
import { registrationError, validRegistrationYear } from "@/lib/artwork-registration";

const MOOD_KEYS: MoodKey[] = ["quiet", "warm", "vivid", "delicate"];
const STATUS_KEYS: StatusKey[] = ["available", "sold", "pending"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // generous ceiling; the portal resizes client-side before upload

// Uploading several photos, translating and then reviewing can take a while.
export const maxDuration = 60;

// "10만원", "120만 원", "12만5천원" are exact amounts, not guesses, so they are
// stored as "100,000원" etc. Anything with other words in it ("각작품당 10만원")
// stays as typed, and the automatic review flags it for a person to look at.
function normalizePortalPrice(raw: string): string | null {
  const compact = raw.replace(/\s/g, "");
  const won = (value: number) => `${value.toLocaleString("en-US")}원`;
  if (/^[\d,]+원?$/.test(compact) && /\d/.test(compact)) return won(Number(compact.replace(/\D/g, "")));
  const man = compact.match(/^([\d,]+)만(?:([\d,]+)(천)?)?원?$/);
  if (man) {
    const rest = man[2] ? Number(man[2].replace(/,/g, "")) * (man[3] ? 1000 : 1) : 0;
    return won(Number(man[1].replace(/,/g, "")) * 10000 + rest);
  }
  return raw || null;
}

export async function GET(request: NextRequest) {
  const artistSlug = getArtistSlugFromRequest(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const submissions = await listSubmissionsForArtist(artistSlug);
    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("artist-submissions GET failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const deadline = Date.now() + 50_000;
  const artistSlug = getArtistSlugFromRequest(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_form" }, { status: 400 });

  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };

  const inputLang = field("inputLang") === "en" ? "en" : "ko";
  const titleText = field("title") || field("titleKo");
  const descriptionText = field("description") || field("descriptionKo");
  const rawDetails = field("details") || field("detailsKo");
  const rawPalette = field("palette") || field("paletteKo");
  const detailsText = inputLang === "ko" ? koreanizeDetails(rawDetails) : rawDetails;
  const paletteText = inputLang === "ko" ? koreanizePaletteText(rawPalette) : rawPalette;
  const moodKey = field("moodKey") as MoodKey;
  const statusKey = (field("statusKey") || "available") as StatusKey;
  // Free text, so artists type e.g. "290,0000원" (Korean 만-unit grouping)
  // or "1400000". artworkPrice() only accepts standard 3-digit grouping and
  // hides anything else, so store the digits re-grouped whenever the input
  // is just a number (with optional commas/원); leave anything else as typed.
  // 액자·설치 칸. 모르는 값은 parseArtworkExtras가 버린다.
  const extras = parseArtworkExtras({
    medium: field("medium"),
    photoProcess: field("photoProcess"), photoPaper: field("photoPaper"),
    workKind: field("workKind"), condition: field("condition"), signature: field("signature"), signatureLocation: field("signatureLocation"),
    pricing: field("pricing"), authorized: field("authorized"), installation: field("installation"), certificateAvailability: field("certificateAvailability"),
    [inputLang === "ko" ? "conditionNoteKo" : "conditionNoteEn"]: field("conditionNote"),
    frame: field("frame"),
    frameMaterial: field("frameMaterial"),
    framedWidthCm: field("framedWidthCm"),
    framedHeightCm: field("framedHeightCm"),
    depthCm: field("depthCm"),
    edition: field("edition"),
    hangingReady: field("hangingReady"),
    certificate: field("certificate"),
  });
  const rawPrice = field("price");
  const price = extras.pricing === "inquiry" ? null : normalizePortalPrice(rawPrice);

  // Description is optional; the photo review fills it when possible.
  // 재료(첫 칸)와 cm 크기는 필수. 포털 화면에서도 막지만 서버에서도 한 번 더 막는다.
  const materialText = detailsText.split("·")[0]?.trim() ?? "";
  if (!titleText || !detailsText || !materialText || /cm/i.test(materialText) || !validPortalDimensions(detailsText)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!MOOD_KEYS.includes(moodKey)) return NextResponse.json({ error: "invalid_mood_key" }, { status: 400 });
  if (!STATUS_KEYS.includes(statusKey)) return NextResponse.json({ error: "invalid_status_key" }, { status: 400 });
  if (!validRegistrationYear(detailsText.split("·").at(-1)?.trim() ?? "")) return NextResponse.json({ error: "invalid_year" }, { status: 400 });

  const files = form.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "missing_images" }, { status: 400 });
  // One request creates one artwork. Batch mode sends one request per work.
  // Reject ambiguous multi-photo requests before translation or Blob uploads.
  if (files.length > 1 && field("photoMode") !== "same-artwork") {
    return NextResponse.json({ error: "portalSameArtworkRequired" }, { status: 400 });
  }
  if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }
  // Some browsers leave an iPhone HEIC original without a type, so the file
  // name is the fallback check there.
  // 실물 확인 사진(서명·뒷면·옆면)은 칸마다 한 장, 전부 선택이다. 작품 사진 줄과 따로 받아
  // 대표 사진·자동 검토·공간 미리보기에 섞이지 않게 한다.
  const proofFiles = PROOF_KEYS.flatMap((key) => {
    const entry = form.get(`proof_${key}`);
    return entry instanceof File && entry.size > 0 ? [[key, entry] as const] : [];
  });
  const registrationIssue = registrationError(extras, rawPrice, proofFiles.some(([key]) => key === "edge"), true);
  if (registrationIssue) return NextResponse.json({ error: registrationIssue }, { status: 400 });
  const isImage = (file: File) => file.type.startsWith("image/") || (file.type === "" && /\.(heic|heif)$/i.test(file.name));
  if (proofFiles.some(([, file]) => file.size > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }
  if (files.some((file) => !isImage(file)) || proofFiles.some(([, file]) => !isImage(file))) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) {
    // Local dev with no Blob token available won't be able to upload — fail
    // clearly instead of letting `put()` throw an opaque error.
    console.warn("artist-submissions POST: no BLOB_READ_WRITE_TOKEN and not running on Vercel; upload will likely fail");
  }

  try {
    // Translate before Blob uploads so an unavailable translator cannot leave
    // orphaned files or publish English text in the Korean catalog fields.
    const source = { title: titleText, description: descriptionText, details: detailsText, palette: paletteText, ...(extras.condition === "issues" ? { condition: field("conditionNote") } : {}) };
    const translated = inputLang === "ko" ? await translateToEnglish(source) : await translateToKorean(source);
    const ko = inputLang === "ko" ? source : translated;
    const en = inputLang === "en" ? source : translated;
    if (extras.condition === "issues") { extras.conditionNoteKo = ko.condition; extras.conditionNoteEn = en.condition; }
    const imageUrls: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-60) || "image.jpg";
      const pathname = `submissions/${artistSlug}/${crypto.randomUUID()}-${safeName}`;
      const blob = await put(pathname, file, { access: "public" });
      imageUrls.push(blob.url);
    }
    const proof: ProofPhotos = {};
    for (const [key, file] of proofFiles) {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-60) || "image.jpg";
      const blob = await put(`submissions/${artistSlug}/proof/${crypto.randomUUID()}-${key}-${safeName}`, file, { access: "public" });
      proof[key] = blob.url;
    }
    // parseArtworkExtras가 Blob 주소인지 다시 확인한다.
    const savedExtras = proofFiles.length ? parseArtworkExtras({ ...extras, proof }) : extras;

    const submission = await insertSubmission({
      artistSlug,
      titleKo: ko.title,
      titleEn: en.title,
      descriptionKo: ko.description,
      descriptionEn: en.description,
      detailsKo: koreanizeDetails(ko.details),
      detailsEn: en.details,
      paletteKo: koreanizePaletteText(ko.palette),
      paletteEn: en.palette,
      moodKey,
      statusKey,
      price,
      imageUrls,
      extras: savedExtras,
    });
    // The artist gets their answer right away; the photo check and the
    // owner's email (with a one-click approve link) run after the response.
    // If this fails, the daily digest cron picks the row up again.
    after(async () => {
      const review = await reviewSubmission(submission, Math.min(deadline, Date.now() + 40_000));
      if (review) await emailReview(submission, review);
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    if (error instanceof ArtworkTranslationError) return NextResponse.json({ error: "portalTranslationError" }, { status: 503 });
    console.error("artist-submissions POST failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
