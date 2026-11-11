import { put } from "@vercel/blob";
import { after, NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { getArtistSlugFromRequest } from "@/lib/artist-auth";
import { artists, type ArtistSlug } from "@/lib/artists";
import { changeProofPhoto, type WorkActionResult } from "@/lib/artwork-controls";
import { PROOF_KEYS, type ProofKey } from "@/lib/artwork-extras";
import { sendToOwner } from "@/lib/artwork-review";
import { SITE_URL } from "@/lib/site";

/**
 * 작가 포털 "내 작품 관리" → 실물 확인 사진(서명·뒷면·옆면). 이미 걸린 작품에 칸마다
 * 한 장씩 올리거나(있으면 바꾸기) 지운다. 작가 slug는 세션 쿠키에서만 읽고, 작품 주인
 * 확인은 changeProofPhoto가 서버에서 한다. 올리면 작품 페이지에 바로 보이고,
 * 운영자에게 사진 링크가 담긴 알림 메일이 간다.
 */

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // the portal resizes to 1600px before upload
// For the owner's email only (i18n.tsx is a client module). Same words as proofSignature/proofBack/proofEdge.
const PROOF_LABEL_KO: Record<ProofKey, string> = { signature: "서명", back: "뒷면", edge: "옆면·표면" };

function sessionArtist(request: NextRequest): ArtistSlug | null {
  const slug = getArtistSlugFromRequest(request);
  return slug && Object.hasOwn(artists, slug) ? (slug as ArtistSlug) : null;
}

function proofKey(value: unknown): ProofKey | null {
  return PROOF_KEYS.includes(value as ProofKey) ? (value as ProofKey) : null;
}

function respond(result: WorkActionResult) {
  if (result.ok) return NextResponse.json({ ok: true });
  const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400;
  return NextResponse.json({ error: result.error }, { status });
}

function failure(error: unknown, where: string) {
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  console.error(`artist-works/proof ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const artistSlug = sessionArtist(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const slug = form?.get("slug");
  const key = proofKey(form?.get("key"));
  const image = form?.get("image");
  if (typeof slug !== "string" || !slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  if (!(image instanceof File) || image.size === 0) return NextResponse.json({ error: "missing_image" }, { status: 400 });
  // Same check as the upload form: some browsers leave an iPhone HEIC original without a type.
  if (!image.type.startsWith("image/") && !(image.type === "" && /\.(heic|heif)$/i.test(image.name))) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "image_too_large" }, { status: 413 });

  let uploadedUrl = "";
  try {
    const result = await changeProofPhoto(
      slug,
      key,
      async (owner) => {
        const safeName = image.name.replace(/[^\w.-]+/g, "_").slice(-60) || "image.jpg";
        const blob = await put(`proof/${owner}/${crypto.randomUUID()}-${key}-${safeName}`, image, { access: "public" });
        uploadedUrl = blob.url;
        return blob.url;
      },
      artistSlug,
    );
    if (result.ok) {
      after(() =>
        sendToOwner(
          `[Pote] ${artists[artistSlug].name.ko} 작가가 실물 확인 사진(${PROOF_LABEL_KO[key]})을 올렸어요`,
          `작품: ${SITE_URL}/artworks/${slug}\n사진: ${uploadedUrl}\n\n작품 페이지에 바로 보이고 있어요. 사람·동물이 찍혔거나 작품과 관계없는 사진이면 관리자 화면의 "포털 보기"로 들어가 지울 수 있어요.`,
        ),
      );
    }
    return respond(result);
  } catch (error) {
    return failure(error, "POST");
  }
}

export async function DELETE(request: NextRequest) {
  const artistSlug = sessionArtist(request);
  if (!artistSlug) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const key = proofKey(body?.key);
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  try {
    return respond(await changeProofPhoto(slug, key, null, artistSlug));
  } catch (error) {
    return failure(error, "DELETE");
  }
}
