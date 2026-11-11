"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artists";
import styles from "./ArtistProfile.module.css";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEduJaeheeyoon1"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupJaeheeyoon1"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <div className={styles.profile}><ArtistProfilePage slug="jaeheeyoon" works={works} portrait="/artists/jaeheeyoon/portrait.jpg" cv={CV} /></div>;
}
