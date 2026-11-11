"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduEunyeollee1"] },
  { label: "artistCollectionsLabel", items: ["artistCollectionsEunyeollee"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="eunyeollee" works={works} portrait="/artists/eunyeollee/portrait.jpg" cv={CV} />;
}
