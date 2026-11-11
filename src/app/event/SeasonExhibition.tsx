"use client";

import { useEffect, useMemo, useState } from "react";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useDailyArtworkOrder } from "@/hooks/useDailyArtworkOrder";
import { useFavorites } from "@/hooks/useFavorites";
import type { Artwork } from "@/lib/artworks";
import { T, formatWorkCount, useLanguage } from "@/lib/i18n";
import { koreanDate, seasonEnd, seasonFor, seasonWorks } from "@/lib/seasons";

/**
 * The page is prerendered, so the build's date decides the first paint; the
 * reader's own date in Korea takes over after mount (same reason the daily
 * artwork order waits for mount). A build from November still opens on
 * winter on 1 December.
 */
export function SeasonExhibition({ catalog }: { catalog: Artwork[] }) {
  const { lang } = useLanguage();
  const { favorites, toggle } = useFavorites();
  const [today, setToday] = useState(() => koreanDate());
  useEffect(() => { queueMicrotask(() => setToday(koreanDate())); }, []);
  const season = seasonFor(today.month);
  const end = seasonEnd(today);
  const daily = useDailyArtworkOrder(catalog);
  const works = useMemo(() => seasonWorks(season, daily), [season, daily]);

  const until = lang === "ko" ? `${end.month}월 ${end.day}일까지` : `Until ${new Date(Date.UTC(2000, end.month - 1, end.day)).toLocaleDateString("en", { month: "long", day: "numeric", timeZone: "UTC" })}`;
  const dday = end.daysLeft === 0 ? "D-DAY" : `D-${end.daysLeft}`;

  return <>
    <SiteHeader />
    <main className={`inner-page season-page season-${season.key}`}>
      <header className="page-intro season-intro">
        <p className="eyebrow dark">{season.label[lang]}</p>
        <h1>{season.title[lang]}</h1>
        <p className="season-until"><span>{until}</span><span className="season-dday">{dday}</span></p>
        <p>{season.intro[lang]}</p>
      </header>
      <p className="result-count season-count" role="status">{formatWorkCount(works.length, lang)}</p>
      {works.length > 0
        ? <div className="art-grid catalog-grid">{works.map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />)}</div>
        : <div className="empty-state"><h2><T k="emptyHeading" /></h2></div>}
    </main>
  </>;
}
