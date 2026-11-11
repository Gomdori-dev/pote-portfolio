"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { safeArtworkHref } from "@/lib/artwork-route";
// Not a limitation worth a fix here: `ALL_PLAYLISTS` (curator-playlists.ts)
// is a hand-curated list of static-catalog slugs by design, so it would
// never reference a DB submission regardless of which artwork list this
// looks the slugs up in.
import { getArtist, type Artwork } from "@/lib/artists";
import { T, useLanguage, useT } from "@/lib/i18n";

import { ALL_PLAYLISTS } from "@/lib/curator-playlists";
import type { SceneReason } from "@/lib/today-scene";
import { useTodayScene } from "@/lib/use-today-scene";

const PICK_COUNT = 3;

// Editorial sequences: no mood scoring or popularity sort. Unavailable works
// drop out without replacing them with an unrelated recommendation.
function pickPlaylists(exclude: string[] = [], first?: string) {
  const pool = ALL_PLAYLISTS.filter((item) => !exclude.includes(item.key) && item.key !== first);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const lead = ALL_PLAYLISTS.find((item) => item.key === first);
  return lead ? [lead, ...pool.slice(0, PICK_COUNT - 1)] : pool.slice(0, PICK_COUNT);
}

const REASON_COPY: Record<SceneReason, `todayScene${Capitalize<SceneReason>}`> = {
  rain: "todaySceneRain", snow: "todaySceneSnow", lateNight: "todaySceneLateNight", morning: "todaySceneMorning",
  sunday: "todaySceneSunday", saturday: "todaySceneSaturday", dusk: "todaySceneDusk", coldNight: "todaySceneColdNight",
  weekendNight: "todaySceneWeekendNight", night: "todaySceneNight", cloudyDay: "todaySceneCloudyDay", clearDay: "todaySceneClearDay",
};

export function CuratorPlaylist({ catalog, compact = false, singleMobile = false }: { catalog: Artwork[]; compact?: boolean; singleMobile?: boolean }) {
  const displayArtworks = catalog.filter((work) => work.statusKey === "available");
  const { lang } = useLanguage();
  const t = useT();
  const rail = useRef<HTMLDivElement>(null);
  const headingId = useId();
  // Rendered the same on server and client first (avoids a hydration
  // mismatch from Math.random), then reshuffled once today's scene is known:
  // the scene that fits the visitor's weather, hour and day (today-scene.ts)
  // leads and is selected, and the other two tabs are random as before.
  const [playlists, setPlaylists] = useState(ALL_PLAYLISTS.slice(0, PICK_COUNT));
  const [selected, setSelected] = useState(ALL_PLAYLISTS[0].key);
  const today = useTodayScene();
  useEffect(() => {
    if (!today) return;
    const shuffled = pickPlaylists([], today.scene);
    queueMicrotask(() => { setPlaylists(shuffled); setSelected(shuffled[0].key); });
  }, [today]);
  const playlist = playlists.find((item) => item.key === selected) ?? playlists[0];
  const works = playlist.slugs.flatMap((slug) => { const work = displayArtworks.find((item) => item.slug === slug); return work ? [work] : []; });

  return <section id="playlist" className={`curator-playlist ${compact ? "compact" : ""}${singleMobile ? " playlist-single-mobile" : ""}`} aria-labelledby={headingId}>
    <header><div><p className="eyebrow"><T k="playlistEyebrow" /></p><h2 id={headingId}><T k="playlistHeading" /></h2><p><T k="playlistNote" /></p></div></header>
    {today ? <p className="playlist-today">{t(REASON_COPY[today.reason])}</p> : null}
    <div className="playlist-tags" role="group" aria-label={t("playlistEyebrow")}>{playlists.map((item) => <button type="button" key={item.key} aria-pressed={item.key === selected} onClick={() => { setSelected(item.key); rail.current?.scrollTo({ left: 0, behavior: "instant" }); }}>{t(item.label)}</button>)}</div>
    <div className="playlist-edition"><p aria-live="polite">{t(playlist.label)}</p><button type="button" onClick={() => { const next = pickPlaylists(playlists.map((item) => item.key)); setPlaylists(next); setSelected(next[0].key); rail.current?.scrollTo({ left: 0, behavior: "instant" }); }} className="playlist-shuffle" aria-label={t("playlistShuffle")} title={t("playlistShuffle")}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v4.5h-4.5" /></svg></button></div>
    <div className="playlist-rail" data-swipe-gallery ref={rail} tabIndex={0} role="region" aria-label={t(playlist.label)}>{works.map((work, index) => { const artist = getArtist(work.artistSlug); return <article key={work.slug}>
      <Link className="playlist-image" href={safeArtworkHref(work)}><Image src={work.image} alt={work[lang].title} fill sizes={singleMobile ? "(max-width:560px) calc(100vw - 46px), 32vw" : "(max-width:560px) 78vw, 32vw"} /></Link>
      {/* The index used to sit as a badge on top of the picture, bottom-left
          — on a busy corner it blended straight into the artwork. It reads
          fine as plain caption text instead, and never overlaps the image. */}
      <p className="playlist-caption"><span className="playlist-index">{String(index + 1).padStart(2, "0")}</span><Link href={safeArtworkHref(work)}>{work[lang].title}</Link></p>
      <small><Link href={`/artists/${artist.slug}`}>{artist.name[lang]}</Link></small>
      <p className="playlist-work-note">{work[lang].description}</p>
    </article>; })}</div>
    {singleMobile && works.length > 1 ? <p className="swipe-hint"><T k="swipeHint" /></p> : null}
    {/* 오늘의 목록은 날씨로 고른다. MET Norway 데이터는 쓰는 곳에 출처를 밝혀야 한다. */}
    <small className="playlist-weather-credit"><T k="todaySceneWeatherCredit" /></small>
  </section>;
}
