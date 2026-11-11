import { cache } from "react";
import { del } from "@vercel/blob";
import type { Artwork } from "@/lib/artists";
import { getSql } from "@/lib/db";
import { PROOF_KEYS, type ArtworkExtras, type ProofKey, type ProofPhotos } from "@/lib/artwork-extras";

/**
 * 실물 확인 사진(서명·뒷면·옆면)을 이미 걸린 작품에 나중에 더하기(2026-09-28).
 *
 * 저장 위치는 작품 종류에 따라 다르다.
 * - 포털 작품("submission-<uuid>"): 새 작품 등록 때와 같은 `artwork_submissions.extras.proof`.
 * - 정적 작품(artworks.ts): 실행 중에 코드를 못 고치니 `artwork_proof_photos` 표에 두고,
 *   카탈로그를 만들 때 `extras.proof`로 합친다. 그래서 화면은 둘 다 `proofPhotos(extras)` 하나로 읽는다.
 *
 * 소유 확인은 여기서 하지 않는다. artwork-controls.ts의 `changeProofPhoto`가 먼저 한다.
 */

type Row = { slug: string; proof_key: string; url: string };

/** Never throws: without a DB (or before the table exists) static works simply have no condition photos. */
export const getStaticProofPhotos = cache(async (): Promise<Map<string, ProofPhotos>> => {
  try {
    const rows = (await getSql()`SELECT slug, proof_key, url FROM artwork_proof_photos`) as Row[];
    const map = new Map<string, ProofPhotos>();
    for (const row of rows) {
      if (!PROOF_KEYS.includes(row.proof_key as ProofKey)) continue;
      map.set(row.slug, { ...map.get(row.slug), [row.proof_key]: row.url });
    }
    return map;
  } catch (error) {
    console.warn("artwork-proof-photos: could not load photos, showing works without them", error);
    return new Map();
  }
});

export function applyStaticProofPhotos(list: Artwork[], photos: Map<string, ProofPhotos>): Artwork[] {
  if (!photos.size) return list;
  return list.map((artwork) => {
    const proof = photos.get(artwork.slug);
    return proof ? { ...artwork, extras: { ...artwork.extras, proof: { ...artwork.extras?.proof, ...proof } } } : artwork;
  });
}

/** Sets (url) or clears (null) one static work's photo. Returns the file it replaced, for removal. */
export async function setStaticProofPhoto(slug: string, artistSlug: string, key: ProofKey, url: string | null, actor: string): Promise<string | null> {
  const sql = getSql();
  const previous = (await sql`SELECT url FROM artwork_proof_photos WHERE slug = ${slug} AND proof_key = ${key}`) as { url: string }[];
  if (url) {
    await sql`
      INSERT INTO artwork_proof_photos (slug, artist_slug, proof_key, url, updated_by, updated_at)
      VALUES (${slug}, ${artistSlug}, ${key}, ${url}, ${actor}, now())
      ON CONFLICT (slug, proof_key) DO UPDATE SET url = ${url}, updated_by = ${actor}, updated_at = now()
    `;
  } else {
    await sql`DELETE FROM artwork_proof_photos WHERE slug = ${slug} AND proof_key = ${key}`;
  }
  return previous[0]?.url ?? null;
}

/** Same for a portal work, inside its `extras`. Returns the file it replaced. */
export async function setSubmissionProofPhoto(id: string, extras: ArtworkExtras, key: ProofKey, url: string | null): Promise<string | null> {
  const previous = extras.proof?.[key] ?? null;
  // Update only the selected photo, preserving concurrent edits to sale details.
  if (url) {
    await getSql()`UPDATE artwork_submissions SET extras = jsonb_set(COALESCE(extras, '{}'::jsonb), '{proof}',
      COALESCE(extras->'proof', '{}'::jsonb) || ${JSON.stringify({ [key]: url })}::jsonb) WHERE id = ${id}`;
  } else {
    await getSql()`UPDATE artwork_submissions SET extras = extras #- ${`{proof,${key}}`}::text[] WHERE id = ${id}`;
  }
  return previous;
}

export async function removeProofFiles(urls: (string | null | undefined)[]) {
  const list = urls.filter((url): url is string => Boolean(url));
  if (!list.length) return;
  await del(list).catch((error) => console.warn("artwork-proof-photos: photo files were not removed", error));
}
