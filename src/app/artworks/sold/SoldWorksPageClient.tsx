"use client";

import Link from "next/link";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import type { Artwork } from "@/lib/artworks";
import { T } from "@/lib/i18n";

/**
 * Where sold work lives now that it is out of the browse grid. Keeping it on
 * the site matters in both directions: it is part of each artist's record, and
 * it is the only thing on Pote that shows a buyer other people have actually
 * bought here.
 *
 * `soldArtworks` is computed by the server-rendered `page.tsx` from the merged
 * static+DB catalog (`soldArtworksFrom(await getAllArtworks())`), so a DB
 * submission approved with statusKey "sold" shows up here too.
 */
export function SoldWorksPageClient({ soldArtworks }: { soldArtworks: Artwork[] }) {
  const { favorites, toggle } = useFavorites();

  return (
    <>
      <SiteHeader />
      <main className="inner-page sold-page">
      <header className="page-intro">
        <p className="eyebrow dark"><T k="soldEyebrow" /></p>
        <h1><T k="soldHeading" /></h1>
        <p><T k="soldIntro" /></p>
      </header>
      {soldArtworks.length > 0 ? (
        <div className="art-grid catalog-grid">
          {soldArtworks.map((artwork) => (
            <ArtworkCard key={artwork.slug} artwork={artwork} saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />
          ))}
        </div>
      ) : (
        <div className="empty-state"><h2><T k="emptyHeading" /></h2></div>
      )}
      <div className="browse-next">
        <Link className="outline-button" href="/artworks"><T k="soldBackToBrowse" /></Link>
      </div>
      </main>
    </>
  );
}
