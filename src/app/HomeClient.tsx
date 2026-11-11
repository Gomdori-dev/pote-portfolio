"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ArtworkCard } from "@/components/ArtworkCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useFavorites } from "@/hooks/useFavorites";
import { useDailyArtworkOrder } from "@/hooks/useDailyArtworkOrder";
import { getArtist, type Artwork } from "@/lib/artists";
import { safeArtworkHref } from "@/lib/artwork-route";
import photoRatios from "@/lib/photo-ratios.json";
import { T, useLanguage, useT } from "@/lib/i18n";
import { OPERATOR_EMAIL } from "@/lib/site";
import { PRICE_BUCKETS, formatPriceBucket } from "@/lib/catalog";

// Width / height of each static work's main photo (scripts/photo-ratios.mjs).
// The canvas size in `details` is no guide: most are written 세로 × 가로.
const PHOTO_RATIOS: Record<string, number> = photoRatios;

export function HomeClient({ catalog }: { catalog: Artwork[] }) {
  const { lang } = useLanguage();
  const t = useT();
  const { favorites, toggle } = useFavorites();
  const dailyWorks = useDailyArtworkOrder(catalog);
  // Photo shape measured in the browser, for works not in PHOTO_RATIOS
  // (e.g. newly approved portal submissions).
  const [measured, setMeasured] = useState<{ image: string; ratio: number } | null>(null);
  // The hero is a painting hung on a gallery wall above a bench, which reads
  // best with a landscape photo. dailyWorks is already available-only.
  const heroWork = dailyWorks.find((work) => {
    const ratio = PHOTO_RATIOS[work.image];
    return ratio >= 1.15 && ratio <= 2.2;
  }) ?? dailyWorks[0];
  const heroPhotoRatio = heroWork ? PHOTO_RATIOS[heroWork.image] ?? (measured?.image === heroWork.image ? measured.ratio : undefined) : undefined;
  const heroRatio = Math.min(2.4, Math.max(0.55, heroPhotoRatio ?? 1.25));
  const rest = dailyWorks.filter((work) => work !== heroWork);
  const discoveries = rest.slice(0, 4);

  return <main className="home-page">
    <SiteHeader />

    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy">
        <p className="home-overline">POTE GALLERY</p>
        <h1 id="home-hero-title"><T k="homeHeroHeading" /></h1>
        <p className="home-hero-intro"><T k="homeHeroBody" /><span><T k="homeHeroService" /></span></p>
        <div className="home-hero-actions">
          <Link className="home-primary" href="/artworks"><T k="heroScroll" /></Link>
          <Link className="home-secondary" href="/inquiry"><T k="footerInquiry" /></Link>
        </div>
        <nav className="home-hero-contact" aria-label={t("collaborationLink")}><Link className="home-artist-apply" href="/apply"><T k="homeArtistApply" /></Link><Link href="/inquiry?intent=collaboration"><T k="collaborationLink" /></Link></nav>
      </div>
      {/* The gallery room from the approved desktop concept
          (public/home/gallery-hero.webp, mock text and placeholder painting
          removed by scripts/home-gallery-hero.py) with the real work hung
          where the placeholder was. The stage keeps the photo's proportions and
          covers the hero, so % positions stay on the same spot of the wall. */}
      {heroWork ? <figure className="home-hero-exhibit" style={{ "--art-ratio": heroRatio } as CSSProperties}>
        <div className="home-hero-stage">
          <Image className="home-hero-scene" src="/home/gallery-hero.webp" alt="" fill preload quality={85} sizes="(max-width:900px) 820px, 100vw" />
          <div className="home-hero-hang">
            <Link className="home-hero-frame" href={safeArtworkHref(heroWork)} aria-label={`${heroWork[lang].title} ${t("detailLink")}`}>
              <Image src={heroWork.image} alt={heroWork[lang].title} fill preload quality={85} sizes="(max-width:900px) 80vw, 560px" onLoad={(event) => { const img = event.currentTarget; if (img.naturalWidth && img.naturalHeight) setMeasured({ image: heroWork.image, ratio: img.naturalWidth / img.naturalHeight }); }} />
            </Link>
            <figcaption className="home-hero-label"><strong>{getArtist(heroWork.artistSlug).name[lang]}</strong><span>{heroWork[lang].title}</span></figcaption>
          </div>
        </div>
      </figure> : null}
    </section>

    <nav className="home-paths" aria-label={t("homeExploreLabel")}>
      <Link href="/guide"><span className="home-path-mark" aria-hidden="true">◎</span><span><T k="homeGuidePath" /></span><span aria-hidden="true">↗</span></Link>
      <Link href="/recommend"><svg className="home-path-mark home-path-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></svg><span><T k="homeSpacePath" /></span><span aria-hidden="true">↗</span></Link>
      <Link href="/gift"><svg className="home-path-mark home-path-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="3.5" y="8.5" width="17" height="4" /><path d="M5 12.5V20h14v-7.5" /><path d="M12 8.5V20" /><path d="M12 8.5C10.5 5 7 4.5 7 6.8c0 1.3 2.2 1.7 5 1.7Zm0 0c1.5-3.5 5-4 5-1.7 0 1.3-2.2 1.7-5 1.7Z" /></svg><span><T k="homeGiftPath" /></span><span aria-hidden="true">↗</span></Link>
    </nav>

    <ul className="home-assure" aria-label={t("homeBuyingEyebrow")}>
      <li><T k="homeAssure1" /></li><li><T k="homeAssure2" /></li><li><T k="homeAssure3" /></li>
    </ul>

    {discoveries.length > 0 ? <section className="home-discover" id="discover" aria-labelledby="home-discover-title">
      <div className="home-section-heading"><div><p className="home-overline"><T k="discoverEyebrow" /></p><h2 id="home-discover-title"><T k="discoverHeading" /></h2></div><Link href="/artworks"><T k="discoverViewAll" /> <span aria-hidden="true">↗</span></Link></div>
      <div className="art-grid">{discoveries.map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} compact saved={favorites.includes(artwork.slug)} onSave={() => toggle(artwork.slug)} />)}</div>
    </section> : null}

    <section className="home-budget" aria-labelledby="home-budget-title">
      <p className="home-overline"><T k="homeBudgetEyebrow" /></p>
      <h2 id="home-budget-title"><T k="homeBudgetHeading" /></h2>
      <nav aria-label={t("homeBudgetEyebrow")}>{PRICE_BUCKETS.map((bucket, index) => <Link key={index} href={`/artworks?budget=${index}`}>{formatPriceBucket(bucket, lang)}</Link>)}</nav>
    </section>

    <section className="home-buying-steps" aria-labelledby="home-buying-steps-title">
      <div className="home-buying-steps-heading">
        <p className="home-overline"><T k="homeBuyingEyebrow" /></p>
        <h2 id="home-buying-steps-title"><T k="homeBuyingHeading" /></h2>
        <p><T k="homeBuyingIntro" /></p>
      </div>
      <ol>
        <li><span>01</span><strong><T k="homeBuyingStep1Title" /></strong><p><T k="homeBuyingStep1Body" /></p></li>
        <li><span>02</span><strong><T k="homeBuyingStep2Title" /></strong><p><T k="homeBuyingStep2Body" /></p></li>
        <li><span>03</span><strong><T k="homeBuyingStep3Title" /></strong><p><T k="homeBuyingStep3Body" /></p></li>
      </ol>
      <p className="home-buying-contact"><T k="operatorName" /> · <a href={`mailto:${OPERATOR_EMAIL}`}>{OPERATOR_EMAIL}</a> · <Link href="/inquiry"><T k="footerInquiry" /></Link><br /><T k="inquiryResponseTime" /></p>
      <Link href="/guide"><T k="homeBuyingGuideLink" /> <span aria-hidden="true">→</span></Link>
    </section>

    <footer>
      <p><T k="footerTagline" /></p>
      <div><Link href="/about"><T k="menuAbout" /></Link><Link href="/guide"><T k="footerGuide" /></Link><Link href="/apply"><T k="footerApply" /></Link><Link href="/inquiry"><T k="footerInquiry" /></Link><Link href="/feedback"><T k="footerFeedback" /></Link><a className="footer-social-link" href="https://www.instagram.com/poteart.gallery/" rel="noreferrer" target="_blank">Instagram</a><a className="footer-social-link" href="https://www.threads.com/@poteart.gallery" rel="noreferrer" target="_blank">Threads</a></div>
      <small><T k="footerCopyright" /></small>
      <small><T k="imageRightsNotice" /></small>
    </footer>
  </main>;
}
