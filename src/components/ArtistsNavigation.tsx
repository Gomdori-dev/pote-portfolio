"use client";

import Link from "next/link";
import { T, useT } from "@/lib/i18n";

export function ArtistsNavigation({ international = false }: { international?: boolean }) {
  const t = useT();
  return <nav className="artists-navigation" aria-label={t("artistsNavigationLabel")}>
    <Link href="/artists" aria-current={!international ? "page" : undefined}><T k="artistsAll" /></Link>
    <Link href="/artists/international" aria-current={international ? "page" : undefined}><T k="artistsInternational" /></Link>
  </nav>;
}
