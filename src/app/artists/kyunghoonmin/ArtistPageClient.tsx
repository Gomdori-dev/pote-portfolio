"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 이력은 예전 페이지 그대로다.
const SOLO_SHOW_COUNT = 13;
const BOOTH_SHOW_COUNT = 7;

const CV: CvGroup[] = [
  { label: "artistSoloShowsLabel", stat: SOLO_SHOW_COUNT },
  { label: "artistBoothShowsLabel", stat: BOOTH_SHOW_COUNT },
  { label: "artistCareerLabel", items: ["artistCareerKyunghoonmin1", "artistCareerKyunghoonmin2", "artistCareerKyunghoonmin3", "artistCareerKyunghoonmin4", "artistCareerKyunghoonmin5", "artistCareerKyunghoonmin6", "artistCareerKyunghoonmin7", "artistCareerKyunghoonmin8", "artistCareerKyunghoonmin9", "artistCareerKyunghoonmin10", "artistCareerKyunghoonmin11", "artistCareerKyunghoonmin12", "artistCareerKyunghoonmin13"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="kyunghoonmin" works={works} portrait="/artists/kyunghoonmin/portrait.jpg" cv={CV} />;
}
