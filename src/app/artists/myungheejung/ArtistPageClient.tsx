"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistCareerLabel", items: ["artistCareerMyungheejung1", "artistCareerMyungheejung2"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="myungheejung" works={works} portrait="/artists/myungheejung/portrait.jpg" cv={CV} />;
}
