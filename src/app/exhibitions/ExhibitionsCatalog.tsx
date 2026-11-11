"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArtworkCard } from "@/components/ArtworkCard";
import { ExhibitionCard } from "@/components/ExhibitionCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import { useKoreanToday } from "@/hooks/useKoreanToday";
import type { Artwork } from "@/lib/artists";
import { getExhibitionRegion, isOngoing, isUpcoming, type Exhibition, type RegionKey } from "@/lib/exhibitions";
import { formatExhibitionCount, T, useLanguage, useT, type DictKey } from "@/lib/i18n";

type Tab = "ongoing" | "upcoming";

const REGION_LABEL_KEY: Record<RegionKey, DictKey> = {
  seoul: "regionSeoul",
  gyeonggi: "regionGyeonggi",
  gangwon: "regionGangwon",
  chungcheong: "regionChungcheong",
  jeolla: "regionJeolla",
  gyeongsang: "regionGyeongsang",
  jeju: "regionJeju",
  overseas: "regionOverseas",
};
const REGION_ORDER: RegionKey[] = ["seoul", "gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang", "jeju", "overseas"];
// ~300 ongoing exhibitions rendered at once made this page 0.9MB. Posters open
// in a new tab, so there is no Back to restore and paging can stay in memory.
const PAGE_SIZE = 24;

// Most visitors arrive here from search looking for a show; four of today's
// available works (picked in page.tsx) give them a way into the gallery itself.
export function ExhibitionsCatalog({ exhibitions, todayIso: initialDate, works: dailyWorks }: { exhibitions: Exhibition[]; todayIso: string; works: Artwork[] }) {
  const todayIso = useKoreanToday(initialDate);
  const { favorites, toggle } = useFavorites();
  const [tab, setTab] = useState<Tab>("ongoing");
  const [region, setRegion] = useState<RegionKey | "all">("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const filterKey = `${tab}|${region}|${query}`;
  const [shownKey, setShownKey] = useState(filterKey);
  if (filterKey !== shownKey) {
    setShownKey(filterKey);
    setShown(PAGE_SIZE);
  }
  const { lang } = useLanguage();
  const t = useT();

  const base = useMemo(() => {
    if (tab === "ongoing") {
      return exhibitions.filter((item) => isOngoing(item, todayIso)).sort((a, b) => a.endDate.localeCompare(b.endDate));
    }
    return exhibitions.filter((item) => isUpcoming(item, todayIso)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [exhibitions, tab, todayIso]);

  const availableRegions = useMemo(
    () => REGION_ORDER.filter((key) => base.some((item) => getExhibitionRegion(item) === key)),
    [base],
  );

  const byRegion = useMemo(() => {
    if (region === "all") return base;
    return base.filter((item) => getExhibitionRegion(item) === region);
  }, [base, region]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return byRegion;
    return byRegion.filter((item) => `${item.title} ${item.institution} ${item.genre}`.toLowerCase().includes(needle));
  }, [byRegion, query]);

  return <><SiteHeader /><main className="inner-page">
    <header className="page-intro">
      <p className="eyebrow dark"><T k="exhibitionEyebrow" /></p>
      <h1><T k="exhibitionsCatalogHeading" /></h1>
    </header>
    <div className="catalog-tools exhibition-tools">
      <label className="search-field">
        <span><T k="exhibitionSearchLabel" /></span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("exhibitionSearchPlaceholder")} />
      </label>
      <div className="mood-filters" role="tablist" aria-label={t("exhibitionSearchLabel")}>
        <button role="tab" aria-selected={tab === "ongoing"} className={tab === "ongoing" ? "active" : ""} onClick={() => setTab("ongoing")}>{t("exhibitionTabOngoing")}</button>
        <button role="tab" aria-selected={tab === "upcoming"} className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>{t("exhibitionTabUpcoming")}</button>
      </div>
    </div>
    <div className="mood-filters region-filters" aria-label={t("regionFilterLabel")}>
      <button aria-pressed={region === "all"} className={region === "all" ? "active" : ""} onClick={() => setRegion("all")}>{t("regionAll")}</button>
      {availableRegions.map((key) => (
        <button aria-pressed={region === key} className={region === key ? "active" : ""} key={key} onClick={() => setRegion(key)}>{t(REGION_LABEL_KEY[key])}</button>
      ))}
    </div>
    <p className="result-count">{formatExhibitionCount(visible.length, lang)}</p>
    {visible.length > 0 ? (
      <div className="exhibition-grid catalog-exhibition-grid">
        {visible.slice(0, shown).map((item) => <ExhibitionCard exhibition={item} key={`${item.title}__${item.institution}`} />)}
      </div>
    ) : (
      <div className="empty-state"><h2><T k="exhibitionsCatalogEmptyHeading" /></h2><p><T k="exhibitionsCatalogEmptyBody" /></p></div>
    )}
    {visible.length > shown ? <div className="browse-more"><button className="outline-button" type="button" onClick={() => setShown(shown + PAGE_SIZE)}>{t("showMoreExhibitions").replace("{n}", String(Math.min(PAGE_SIZE, visible.length - shown)))}</button></div> : null}
    {dailyWorks.length > 0 ? (
      <section className="exhibition-works">
        <div className="section-heading"><h2><T k="exhibitionWorksHeading" /></h2><Link href="/artworks"><T k="exhibitionWorksLink" /></Link></div>
        <div className="art-grid">{dailyWorks.map((work) => <ArtworkCard key={work.slug} artwork={work} compact saved={favorites.includes(work.slug)} onSave={() => toggle(work.slug)} />)}</div>
      </section>
    ) : null}
    <p className="exhibition-source"><T k="exhibitionSource" /></p>
  </main></>;
}
