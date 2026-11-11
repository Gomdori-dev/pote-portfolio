"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 예전 맞춤 페이지의 소개문·노트·이력은 그대로다.
const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduDongguk"] },
  { label: "artistExhibitionsLabel", items: ["artistExhDonggukGrad", "artistExhArtmiSelected", "artistExhGiftParis", "artistExhHanok", "artistExhLaCoree", "artistExhColor2020", "artistExhCoffeeEsperanto", "artistExhArtmiOnline"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="jihyeseung" works={works} portrait="/artists/jihyeseung/portrait.jpg" cv={CV} eyebrow="artistFirstEyebrow" intro="artistHeroBody" note={{ penName: "artistPenName", heading: "artistNoteHeading", body: "artistNoteBody" }} worksHeading="selectedWorksHeading" />;
}
