"use client";

import Link from "next/link";
import { useState } from "react";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { Artwork } from "@/lib/artworks";
import { T, useT } from "@/lib/i18n";

/**
 * Favorited/recently-viewed slugs live in browser storage, so they can only be
 * resolved to full `Artwork` objects client-side. `catalog` is the merged
 * static+DB list fetched by the server-rendered `page.tsx` via
 * `getAllArtworks()`, so a favorited/viewed DB submission's card renders here
 * too, not just the favorite/view record itself.
 */
export function FavoritesPageClient({ catalog }: { catalog: Artwork[] }) {
  const { favorites, toggle } = useFavorites();
  const saved = catalog.filter((artwork) => favorites.includes(artwork.slug));
  const { recentlyViewed } = useRecentlyViewed();
  // Most-recent-first, matching the stored order; a saved work still shows up
  // here too (a heart is not the same signal as "I looked at this").
  const viewed = recentlyViewed.map((slug) => catalog.find((artwork) => artwork.slug === slug)).filter((artwork): artwork is Artwork => !!artwork);
  const t = useT();
  // Batching several saved works into one inquiry instead of sending them
  // one at a time — selection lives only on this page, in memory, so it
  // never lingers once you leave (unlike favorites, which persist).
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelect = (slug: string) => setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  const inquiryHref = `/inquiry?artworks=${selected.map(encodeURIComponent).join(",")}`;

  return <><SiteHeader /><main className={`inner-page${selected.length > 0 ? " fav-with-bar" : ""}`}><header className="page-intro compact"><p className="eyebrow dark"><T k="favEyebrow" /></p><h1><T k="favHeading" /></h1><p><T k="favBody" /></p></header>
    {saved.length > 0 ? <>
      <p className="fav-select-hint"><T k="favSelectHint" /></p>
      <div className="art-grid catalog-grid">{saved.map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} saved onSave={() => toggle(artwork.slug)} selectable selected={selected.includes(artwork.slug)} onToggleSelect={() => toggleSelect(artwork.slug)} />)}</div>
      {selected.length > 0 ? <div className="fav-inquiry-bar"><Link className="primary-button" href={inquiryHref}>{t("favInquirySelected")} ({selected.length})</Link></div> : null}
    </> : <div className="empty-state"><h2><T k="favEmptyHeading" /></h2><p><T k="favEmptyBody" /></p><Link className="primary-button" href="/artworks"><T k="favBrowse" /></Link></div>}
    {viewed.length > 0 ? <section className="recently-viewed">
      <header className="page-intro compact"><p className="eyebrow dark"><T k="recentlyViewedEyebrow" /></p><h2><T k="recentlyViewedHeading" /></h2><p><T k="recentlyViewedBody" /></p></header>
      <div className="art-grid catalog-grid">{viewed.map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />)}</div>
    </section> : null}
  </main></>;
}
