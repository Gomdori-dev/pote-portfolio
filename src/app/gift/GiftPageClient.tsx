"use client";

import Link from "next/link";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import type { Artwork } from "@/lib/artworks";
import { T } from "@/lib/i18n";

export function GiftPageClient({ gifts }: { gifts: Artwork[] }) {
  const { favorites, toggle } = useFavorites();

  return (
    <>
      <SiteHeader />
      <main className="inner-page gift-page">
        <header className="page-intro">
          <p className="eyebrow dark"><T k="giftEyebrow" /></p>
          <h1><T k="giftHeading" /></h1>
          <p><T k="giftIntro" /></p>
        </header>
        <ul className="gift-tips">
          <li><T k="giftTipSize" /></li>
          <li><T k="giftTipAddress" /></li>
          <li><T k="giftTipCertificate" /></li>
        </ul>
        {gifts.length > 0 ? (
          <div className="art-grid catalog-grid">
            {gifts.map((artwork) => (
              <ArtworkCard key={artwork.slug} artwork={artwork} saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2><T k="emptyHeading" /></h2></div>
        )}
        <div className="browse-next entry-actions">
          <Link className="outline-button" href="/artworks?sort=price-asc"><T k="entryViewAll" /></Link>
        </div>
      </main>
    </>
  );
}
