"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 예전 맞춤 페이지의 소개문·노트·이력은 그대로다.
const CV: CvGroup[] = [
  { label: "artistCareerLabel", items: ["artistCareerHaerang1", "artistCareerHaerang2", "artistCareerHaerang3", "artistCareerHaerang4", "artistCareerHaerang5", "artistCareerHaerang6", "artistCareerHaerang7", "artistCareerHaerang8", "artistCareerHaerang9", "artistCareerHaerang10"] },
  { label: "artistAwardsLabel", items: ["artistAwardHaerang1", "artistAwardHaerang2", "artistAwardHaerang3", "artistAwardHaerang4", "artistAwardHaerang5", "artistAwardHaerang6", "artistAwardHaerang7", "artistAwardHaerang8"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="haerang" works={works} portrait="/artists/haerang/portrait.jpg" cv={CV} intro="artistHeroBodyHaerang" note={{ penName: "artistPenNameHaerang", heading: "artistNoteHeadingHaerang", body: "artistNoteBodyHaerang" }} worksHeading="selectedWorksHeadingHaerang" />;
}
