import type { Artwork } from "./artworks";
import { artworkDimensionsCm } from "./catalog";
import photoRatios from "./photo-ratios.json";

// Width / height of each static work's main photo (scripts/photo-ratios.mjs).
const PHOTO_RATIOS: Record<string, number> = photoRatios;

// Most catalogue entries read "세로 × 가로" while artworkDimensionsCm() takes
// the first number as the width, so 56 of the 81 "landscape by cm" works are
// really portrait photos (HANDOFF 09-27 #16). RoomPreview/RoomThumb already
// fix this once the photo loads; this does it from the build-time ratio table
// so the first paint, the photo box and the structured data are right too.
// Portal works (not in the table) and near-square photos keep the catalogued
// order, and RoomPreview's own photo check still covers them.
export function artworkSizeForDisplay(artwork: Pick<Artwork, "image" | "ko">): { w: number; h: number } | null {
  const size = artworkDimensionsCm(artwork.ko.details);
  const ratio = PHOTO_RATIOS[artwork.image];
  if (!size || ratio === undefined || Math.abs(ratio - 1) < 0.03) return size;
  const [long, short] = [Math.max(size.w, size.h), Math.min(size.w, size.h)];
  return ratio > 1 ? { w: long, h: short } : { w: short, h: long };
}
