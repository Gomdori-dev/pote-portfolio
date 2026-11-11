"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artists";
import styles from "./ArtistProfile.module.css";

const CV: CvGroup[] = [
  { label: "artistEducationLabel", items: ["artistEducationJihunchoi1"] },
  { label: "artistSoloShowsLabel", items: ["artistSoloJihunchoi1"] },
  { label: "artistArtFairsLabel", items: ["artistFairJihunchoi1", "artistFairJihunchoi2", "artistFairJihunchoi3", "artistFairJihunchoi4", "artistFairJihunchoi5", "artistFairJihunchoi6", "artistFairJihunchoi7", "artistFairJihunchoi8", "artistFairJihunchoi9", "artistFairJihunchoi10", "artistFairJihunchoi11"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupJihunchoi1", "artistGroupJihunchoi2", "artistGroupJihunchoi3", "artistGroupJihunchoi4", "artistGroupJihunchoi5", "artistGroupJihunchoi6", "artistGroupJihunchoi7", "artistGroupJihunchoi8", "artistGroupJihunchoi9", "artistGroupJihunchoi10", "artistGroupJihunchoi11", "artistGroupJihunchoi12", "artistGroupJihunchoi13", "artistGroupJihunchoi14", "artistGroupJihunchoi15"] },
  { label: "artistAwardsLabel", items: ["artistAwardJihunchoi1", "artistAwardJihunchoi2", "artistAwardJihunchoi3"] },
  { label: "artistCollectionsLabel", items: ["artistCollectionJihunchoi1"] },
  { label: "artistMembershipLabel", items: ["artistMemberJihunchoi1"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <div className={styles.profile}><ArtistProfilePage slug="jihunchoi" works={works} portrait="/artists/jihunchoi/portrait.jpg" cv={CV} /></div>;
}
