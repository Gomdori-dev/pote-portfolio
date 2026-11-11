"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistAwardsLabel", items: ["artistAwardCheongunsim1", "artistAwardCheongunsim2", "artistAwardCheongunsim3"] },
  { label: "artistCareerLabel", items: ["artistCareerCheongunsim1", "artistCareerCheongunsim2"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="cheongunsim" works={works} portrait="/artists/cheongunsim/portrait.jpg" cv={CV} />;
}
