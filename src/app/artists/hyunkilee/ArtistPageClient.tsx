"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artists";
import styles from "./ArtistProfile.module.css";

const CV: CvGroup[] = [
  { label: "artistAwardsLabel", items: ["artistAwardHyunkilee1"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <div className={styles.profile}><ArtistProfilePage slug="hyunkilee" works={works} portrait="/artists/hyunkilee/portrait.jpg" cv={CV} /></div>;
}
