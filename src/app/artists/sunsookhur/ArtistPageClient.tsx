"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artists";
import styles from "./ArtistProfile.module.css";

const CV: CvGroup[] = [
  { label: "artistSoloShowsLabel", items: ["artistSoloSunsookhur1", "artistSoloSunsookhur2"] },
  { label: "artistGroupShowsLabel", items: ["artistGroupSunsookhur1", "artistGroupSunsookhur2", "artistGroupSunsookhur3", "artistGroupSunsookhur4", "artistGroupSunsookhur5"] },
  { label: "artistAwardsLabel", items: ["artistAwardSunsookhur1", "artistAwardSunsookhur2", "artistAwardSunsookhur3", "artistAwardSunsookhur4", "artistAwardSunsookhur5", "artistAwardSunsookhur6", "artistAwardSunsookhur7", "artistAwardSunsookhur8", "artistAwardSunsookhur9", "artistAwardSunsookhur10", "artistAwardSunsookhur11", "artistAwardSunsookhur12", "artistAwardSunsookhur13", "artistAwardSunsookhur14", "artistAwardSunsookhur15", "artistAwardSunsookhur16", "artistAwardSunsookhur17"] },
  { label: "artistCareerLabel", items: ["artistCareerSunsookhur1"] },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <div className={styles.profile}><ArtistProfilePage slug="sunsookhur" works={works} portrait="/artists/sunsookhur/portrait.jpg" cv={CV} /></div>;
}
