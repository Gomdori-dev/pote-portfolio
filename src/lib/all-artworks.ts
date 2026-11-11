import { artworks, type Artwork } from "@/lib/artworks";
import { getApprovedSubmissions } from "@/lib/dynamic-artworks";
import { applyControls, getArtworkControls } from "@/lib/artwork-controls";
import { applyStaticProofPhotos, getStaticProofPhotos } from "@/lib/artwork-proof-photos";
import { applyStaticCopyEdits, getStaticCopyEdits } from "@/lib/artwork-copy-edits";
import { applyStaticMainImages, getStaticMainImages } from "@/lib/artwork-main-images";
import { applyRegistrationDetails, getRegistrationDetails } from "@/lib/artwork-registration-details";

/**
 * The full catalog: the static, hand-registered `artworks` array (left
 * completely untouched — see artworks.ts) plus any artist-submitted works an
 * admin has approved in the DB, minus works taken down or deleted from the
 * site and with any "sold" override applied (`artwork_controls`, see
 * artwork-controls.ts). Use this instead of the static `artworks` export from
 * server-side data-loading entry points (page.tsx, sitemap.ts, API routes)
 * that need the complete, up-to-date catalog. Without a DB configured it
 * shows the static catalog as-is; if the DB exists but the controls lookup fails it
 * throws, so taken-down works are never re-published by a transient error.
 */
export async function getAllArtworks(): Promise<Artwork[]> {
  const [approved, controls, staticProof, copyEdits, mainImages, registration] = await Promise.all([getApprovedSubmissions(), getArtworkControls(), getStaticProofPhotos(), getStaticCopyEdits(), getStaticMainImages(), getRegistrationDetails()]);
  // 정적 작품의 실물 확인 사진은 DB 표에 있어서 여기서 extras.proof로 합친다(artwork-proof-photos.ts).
  return applyControls(applyRegistrationDetails(applyStaticProofPhotos([...applyStaticMainImages(applyStaticCopyEdits(artworks, copyEdits), mainImages), ...approved], staticProof), registration), controls);
}

/** Same as `getArtwork()` in artworks.ts, but also checks approved DB submissions and site controls. */
export async function getArtworkFromAll(slug: string): Promise<Artwork | undefined> {
  return (await getAllArtworks()).find((artwork) => artwork.slug === slug);
}
