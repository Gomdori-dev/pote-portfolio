"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artists";
import styles from "./ArtistProfile.module.css";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEducationWonsikjeong1"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloWonsikjeong1"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <div className={styles.profile}><ArtistProfilePage slug="wonsikjeong" works={works} portrait="/artists/wonsikjeong/portrait.jpg" cv={CV} /></div>;
}
