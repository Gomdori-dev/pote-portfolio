"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduLuxx1", "artistEduLuxx2"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloLuxx1"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupLuxx1", "artistGroupLuxx2", "artistGroupLuxx3"] },
  { label: "artistAwardsLabel", items: ["artistAwardLuxx1", "artistAwardLuxx2", "artistAwardLuxx3", "artistAwardLuxx4", "artistAwardLuxx5", "artistAwardLuxx6"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="luxx" works={works} portrait="/artists/luxx/portrait.jpg" cv={CV} />;
}
