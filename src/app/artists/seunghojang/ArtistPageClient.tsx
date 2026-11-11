"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 이력은 예전 페이지 그대로다.
const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduSeunghojang1", "artistEduSeunghojang2"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloSeunghojang1", "artistSoloSeunghojang2", "artistSoloSeunghojang3"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupSeunghojang1", "artistGroupSeunghojang2", "artistGroupSeunghojang3", "artistGroupSeunghojang4", "artistGroupSeunghojang5", "artistGroupSeunghojang6", "artistGroupSeunghojang7", "artistGroupSeunghojang8", "artistGroupSeunghojang9", "artistGroupSeunghojang10", "artistGroupSeunghojang11", "artistGroupSeunghojang12", "artistGroupSeunghojang13", "artistGroupSeunghojang14", "artistGroupSeunghojang15", "artistGroupSeunghojang16", "artistGroupSeunghojang17"] },
  { label: "artistAwardsLabel", items: ["artistAwardSeunghojang1", "artistAwardSeunghojang2"] },
  { label: "artistCollectionsLabel", items: ["artistCollectionsSeunghojang"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="seunghojang" works={works} portrait="/artists/seunghojang/portrait.jpg" cv={CV} />;
}
