"use client";

import Image from "next/image";
import Link from "next/link";
import { ArtistsNavigation } from "@/components/ArtistsNavigation";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { artists, type Artwork } from "@/lib/artists";
import { artistPortrait } from "@/lib/artist-portraits";
import { INTERNATIONAL_ARTIST_SLUGS } from "@/lib/international-artists";
import { T, useLanguage } from "@/lib/i18n";

export function InternationalArtistsClient({ artworks }: { artworks: Artwork[] }) {
  const { lang } = useLanguage();
  return <><SiteHeader /><main className="inner-page international-artists-page">
    <header className="page-intro">
      <p className="eyebrow dark">POTE ARTISTS</p>
      <h1><T k="artistsInternational" /></h1>
      <p><T k="artistsInternationalIntro" /></p>
    </header>
    <ArtistsNavigation international />
    {INTERNATIONAL_ARTIST_SLUGS.map((slug) => {
      const artist = artists[slug];
      const portrait = artistPortrait(slug);
      const works = artworks.filter((artwork) => artwork.artistSlug === slug);
      return <section className="international-artist" key={slug} aria-labelledby={`international-${slug}`}>
        <div className="international-artist-profile">
          {portrait ? <Link className="international-artist-portrait" data-swipe-gallery href={`/artists/${slug}`}>
            <Image src={portrait} alt={artist.name[lang]} fill sizes="(max-width: 700px) 90vw, 400px" />
          </Link> : null}
          <div className="international-artist-copy">
            <p className="eyebrow">{artist.medium?.[lang]}</p>
            <h2 id={`international-${slug}`}>{artist.name[lang]}</h2>
            <p className="international-artist-statement">{artist.statement?.[lang]}</p>
            <Link className="primary-button" href={`/artists/${slug}`}><T k="artistsViewProfile" /></Link>
          </div>
        </div>
        <div className="international-artist-works">
          <h3><T k="artistsInternationalWorks" /></h3>
          {works.length ? <div className="international-works-grid" data-swipe-gallery>{works.slice(0, 3).map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} />)}</div>
            : <p className="international-works-empty"><T k="artistsInternationalEmpty" /></p>}
        </div>
      </section>;
    })}
  </main></>;
}
