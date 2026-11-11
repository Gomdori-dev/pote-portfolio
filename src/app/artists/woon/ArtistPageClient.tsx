"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduWoon1", "artistEduWoon2"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloWoon1"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupWoon1", "artistGroupWoon2", "artistGroupWoon3", "artistGroupWoon4", "artistGroupWoon5", "artistGroupWoon6", "artistGroupWoon7", "artistGroupWoon8"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="woon" works={works} portrait="/artists/woon/portrait.jpg" cv={CV} />;
}
