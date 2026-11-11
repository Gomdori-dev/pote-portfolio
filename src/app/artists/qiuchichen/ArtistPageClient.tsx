"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduQiuchichen1"] },
  { label: "artistAwardsLabel", items: ["artistAwardQiuchichen1"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloQiuchichen1", "artistSoloQiuchichen2", "artistSoloQiuchichen3", "artistSoloQiuchichen4"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupQiuchichen1", "artistGroupQiuchichen2", "artistGroupQiuchichen3", "artistGroupQiuchichen4", "artistGroupQiuchichen5", "artistGroupQiuchichen6"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="qiuchichen" works={works} portrait="/artists/qiuchichen/portrait.jpg" cv={CV} />;
}
