"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import { artists, type Artwork, type MoodKey } from "@/lib/artists";
import { useDailyArtworkOrder } from "@/hooks/useDailyArtworkOrder";
import { useDailyMoodColors } from "@/hooks/useDailyMoodColors";
import { filterCatalog, formatPriceBucket, formatSizeBucket, PRICE_BUCKETS, SIZE_BUCKETS_CM } from "@/lib/catalog";
import { COLOR_FAMILIES, ROOMS, artworkColorFamilies, fitsRoom, isColorFamily, isRoomKey } from "@/lib/discovery";
import { formatWorkCount, T, useLanguage, useT } from "@/lib/i18n";

const moods = [
  { key: "all", label: "moodAll" }, { key: "quiet", label: "moodQuiet" },
  { key: "warm", label: "moodWarm" }, { key: "vivid", label: "moodVivid" },
  { key: "delicate", label: "moodDelicate" },
] as const;

// Rendering every available work (230 on 2026-10-31) made this page 1MB of
// HTML, mostly card markup and image srcsets, before a visitor saw anything.
// Cards come in pages instead; the rest of the catalogue still filters and
// searches in the browser.
const PAGE_SIZE = 24;
const SHOWN_KEY = "pote-artworks-shown";

// How far "더 보기" had got for these filters, so Back from a detail page lands
// on the same long list instead of cutting it to the first page.
function storedShown(filterKey: string): number {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "null") as { key?: string; n?: number } | null;
    return saved?.key === filterKey && Number.isInteger(saved.n) && saved.n! > PAGE_SIZE ? saved.n! : PAGE_SIZE;
  } catch {
    return PAGE_SIZE;
  }
}

// The URL's filters can only be read in the browser, so the Suspense fallback
// renders this same catalogue with no filters: the prerendered HTML carries the
// first page of real cards and detail links instead of a loading line, and the
// URL-driven copy (with the daily shuffle) replaces it in the browser. That copy
// is never server-rendered, so it can read sessionStorage while rendering.
function CatalogFromUrl({ catalog }: { catalog: Artwork[] }) {
  return <Catalog catalog={catalog} params={useSearchParams()} restore />;
}

function Catalog({ catalog, params, restore }: { catalog: Artwork[]; params: Pick<URLSearchParams, "get" | "toString">; restore?: boolean }) {
  const { favorites, toggle } = useFavorites();
  const { lang } = useLanguage();
  const t = useT();
  const moodValue = params.get("mood") ?? "all";
  const mood = moods.some((item) => item.key === moodValue) ? moodValue as MoodKey | "all" : "all";
  const artistValue = params.get("artist") ?? "all";
  const artist = Object.hasOwn(artists, artistValue) ? artistValue : "all";
  const qParam = params.get("q") ?? "";
  // The search box keeps its own state instead of being driven straight off
  // `qParam` (URL search params). Rendering the input's value from a source
  // that only updates a tick after `onChange` (round-tripping through
  // `window.history.replaceState` and Next's router) fights the browser's own
  // IME composition buffer, which corrupts Hangul (built from multiple
  // keystrokes per syllable) while single-keystroke Latin input looks fine —
  // that mismatch was reported as "Korean can't be typed here at all".
  const [query, setQuery] = useState(qParam);
  const [syncedQParam, setSyncedQParam] = useState(qParam);
  if (qParam !== syncedQParam) {
    setSyncedQParam(qParam);
    setQuery(qParam);
  }
  const budgetParam = params.get("budget");
  const budgetValue = budgetParam !== null ? Number(budgetParam) : null;
  const budget = budgetValue !== null && Number.isInteger(budgetValue) && PRICE_BUCKETS[budgetValue] ? budgetValue : null;
  const sizeParam = params.get("size");
  const sizeValue = sizeParam !== null ? Number(sizeParam) : null;
  const size = sizeValue !== null && Number.isInteger(sizeValue) && SIZE_BUCKETS_CM[sizeValue] ? sizeValue : null;
  const colorValue = params.get("color");
  const color = isColorFamily(colorValue) ? colorValue : null;
  const roomValue = params.get("room");
  const room = isRoomKey(roomValue) ? roomValue : null;
  const sortValue = params.get("sort");
  const sort = sortValue === "price-asc" || sortValue === "price-desc" ? sortValue : "curated";
  const names = Object.fromEntries(Object.values(artists).map((item) => [item.slug, Object.values(item.name).join(" ")]));
  const dailyWorks = useDailyArtworkOrder(catalog);
  const moodColours = useDailyMoodColors();
  const visible = filterCatalog(dailyWorks, { mood, artist, query, budget, size, sort }, lang, names)
    .filter((artwork) => (color === null || artworkColorFamilies(artwork).has(color)) && (room === null || fitsRoom(artwork, room)));
  const changed = mood !== "all" || artist !== "all" || query !== "" || budget !== null || size !== null || color !== null || room !== null || sort !== "curated";
  // A new filter starts again from the first page.
  const filterKey = [mood, artist, query, budget, size, color, room, sort].join("|");
  const [shown, setShown] = useState(() => restore ? storedShown(filterKey) : PAGE_SIZE);
  const [shownKey, setShownKey] = useState(filterKey);
  if (filterKey !== shownKey) {
    setShownKey(filterKey);
    setShown(PAGE_SIZE);
  }
  const showMore = () => {
    const next = shown + PAGE_SIZE;
    setShown(next);
    try { sessionStorage.setItem(SHOWN_KEY, JSON.stringify({ key: filterKey, n: next })); } catch { /* private mode: paging still works, Back just starts over */ }
  };

  // Native history integrates with Next search params, preserving the selection
  // on browser Back without sending a request for every search keystroke.
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || value === "curated") next.delete(key);
    else next.set(key, value);
    window.history.replaceState(null, "", next.size ? `/artworks?${next}` : "/artworks");
  };
  const reset = () => window.history.replaceState(null, "", "/artworks");

  return <>
    <div className="catalog-tools catalog-controls">
      <label className="search-field"><input aria-label={t("searchLabel")} type="search" value={query} onChange={(event) => { setQuery(event.target.value); update("q", event.target.value); }} placeholder={t("searchPlaceholder")} /></label>
      <div className="catalog-filter-row catalog-axis">
        <p className="catalog-axis-label"><T k="moodFilterHeading" /></p>
        <div className="mood-filters mood-chip-row" aria-label={t("moodFilterLabel")}>{moods.map((item) => <button type="button" className={mood === item.key ? "active" : ""} style={moodColours[item.key] ? { "--mood-accent": moodColours[item.key] } as React.CSSProperties : undefined} aria-pressed={mood === item.key} key={item.key} onClick={() => update("mood", item.key)}>{t(item.label)}</button>)}</div>
      </div>
      {/* Colour and room: a second click on the lit one clears it, so neither
          needs its own "all" chip. */}
      <div className="catalog-filter-row catalog-axis">
        <p className="catalog-axis-label"><T k="colorFilterHeading" /></p>
        <div className="color-swatches" role="group" aria-label={t("colorFilterHeading")}>{COLOR_FAMILIES.map((family) => <button type="button" key={family.key} className={color === family.key ? "active" : ""} aria-pressed={color === family.key} aria-label={family.label[lang]} title={family.label[lang]} style={{ "--swatch": family.swatch } as React.CSSProperties} onClick={() => update("color", color === family.key ? "" : family.key)}><span aria-hidden="true" /></button>)}</div>
        {color ? <span className="color-swatch-name">{COLOR_FAMILIES.find((family) => family.key === color)?.label[lang]}</span> : null}
      </div>
      <div className="catalog-filter-row catalog-axis">
        <p className="catalog-axis-label"><T k="roomFilterHeading" /></p>
        <div className="mood-filters room-filters" role="group" aria-label={t("roomFilterHeading")}>{ROOMS.map((item) => <button type="button" key={item.key} className={room === item.key ? "active" : ""} aria-pressed={room === item.key} onClick={() => update("room", room === item.key ? "" : item.key)}>{item.label[lang]}</button>)}</div>
      </div>
      <div className="catalog-filter-row catalog-purchase-filters">
        <label className="catalog-select"><select aria-label={t("catalogBudget")} value={budget ?? ""} onChange={(event) => update("budget", event.target.value)}><option value=""><T k="catalogAnyBudget" /></option>{PRICE_BUCKETS.map((bucket, index) => <option key={index} value={index}>{formatPriceBucket(bucket, lang)}</option>)}</select></label>
        <div className="catalog-size-slider">
          <div className="catalog-size-slider-heading"><span>{t("catalogSize")}</span><output>{size === null ? t("catalogAnySize") : formatSizeBucket(SIZE_BUCKETS_CM[size])}</output></div>
          <input type="range" min={0} max={SIZE_BUCKETS_CM.length} step={1} value={size ?? SIZE_BUCKETS_CM.length} aria-label={t("catalogSize")} aria-valuetext={size === null ? t("catalogAnySize") : formatSizeBucket(SIZE_BUCKETS_CM[size])} onChange={(event) => { const next = Number(event.target.value); update("size", next === SIZE_BUCKETS_CM.length ? "" : String(next)); }} />
          <div className="catalog-size-slider-labels" aria-hidden="true"><span>{t("catalogAnySize")}</span>{SIZE_BUCKETS_CM.map((bucket, index) => <span key={index}>{formatSizeBucket(bucket)}</span>)}</div>
        </div>
        <label className="catalog-select"><select aria-label={t("catalogSort")} value={sort} onChange={(event) => update("sort", event.target.value)}><option value="curated"><T k="catalogCurated" /></option><option value="price-asc"><T k="catalogPriceAsc" /></option><option value="price-desc"><T k="catalogPriceDesc" /></option></select></label>
        {/* Artist moved out of the chips: it grows by one every time an artist
            joins, and a line of chips that keeps getting longer stops being
            scannable. A select holds any number of them in the same space. */}
        <label className="catalog-select"><select aria-label={t("artistFilterLabel")} value={artist} onChange={(event) => update("artist", event.target.value)}><option value="all"><T k="artistFilterAll" /></option>{Object.values(artists).map((item) => <option key={item.slug} value={item.slug}>{item.name[lang]}</option>)}</select></label>
      </div>
    </div>
    <div className="catalog-results"><p className="result-count" role="status">{formatWorkCount(visible.length, lang)}</p>{changed ? <button className="text-button" type="button" onClick={reset}><T k="clearFilters" /></button> : null}</div>
    {visible.length > 0 ? <div className="art-grid catalog-grid">{visible.slice(0, shown).map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} room={room} saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />)}</div> : null}
    {visible.length > shown ? <div className="browse-more"><button className="outline-button" type="button" onClick={showMore}>{t("showMoreWorks").replace("{n}", String(Math.min(PAGE_SIZE, visible.length - shown)))}</button></div> : null}
    {/* Sold work is not in this grid any more, so there has to be a door to it. */}
    <div className="browse-next"><Link className="text-button" href="/artworks/sold"><T k="soldLink" /> →</Link></div>
    {visible.length === 0 && <div className="empty-state"><h2><T k="emptyHeading" /></h2><p><T k="emptyBody" /></p><button className="primary-button" type="button" onClick={reset}><T k="clearFilters" /></button></div>}
  </>;
}

/**
 * `catalog` is the merged static+DB catalog fetched by the server-rendered
 * `page.tsx` via `getAllArtworks()`, so an admin-approved artist-portal
 * submission takes part in the daily shuffle and browse/search/filter grid
 * here, not just its own artist page and detail URL.
 */
export function ArtworksPageClient({ catalog }: { catalog: Artwork[] }) {
  return <><SiteHeader /><main className="inner-page">
    <header className="page-intro"><p className="eyebrow dark"><T k="catalogEyebrow" /></p><h1><T k="catalogHeading" /></h1><p><T k="catalogIntro" /></p></header>
    <Suspense fallback={<Catalog catalog={catalog} params={new URLSearchParams()} />}><CatalogFromUrl catalog={catalog} /></Suspense>
  </main></>;
}
