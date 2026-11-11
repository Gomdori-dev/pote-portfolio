"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistSoloShowsLabel", items: ["artistSoloYulhwi1", "artistSoloYulhwi2", "artistSoloYulhwi3", "artistSoloYulhwi4", "artistSoloYulhwi5"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupYulhwi1", "artistGroupYulhwi2", "artistGroupYulhwi3", "artistGroupYulhwi4", "artistGroupYulhwi5", "artistGroupYulhwi6", "artistGroupYulhwi7"] },
  { label: "artistAwardsLabel", items: ["artistAwardYulhwi1", "artistAwardYulhwi2", "artistAwardYulhwi3", "artistAwardYulhwi4", "artistAwardYulhwi5"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="yulhwi" works={works} portrait="/artists/yulhwi/portrait.jpg" cv={CV} />;
}
