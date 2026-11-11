"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 예전 맞춤 페이지의 소개문·노트·이력은 그대로다.
const CV: CvGroup[] = [
  { label: "artistExhibitionsLabel", items: ["artistExhibitionsSummaryHoohoo"] },
  { label: "artistAwardsLabel", items: ["artistAwardHoohoo1", "artistAwardHoohoo2", "artistAwardHoohoo3", "artistAwardHoohoo4"] },
  { label: "artistCollectionsLabel", items: ["artistCollectionsHoohoo"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="hoohoo" works={works} portrait="/artists/hoohoo/portrait.jpg" cv={CV} intro="artistHeroBodyHoohoo" note={{ penName: "artistPenNameHoohoo", heading: "artistNoteHeadingHoohoo", body: "artistNoteBodyHoohoo" }} worksHeading="selectedWorksHeadingHoohoo" />;
}
