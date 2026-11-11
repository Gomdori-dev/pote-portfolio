"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ArtworkCard } from "@/components/ArtworkCard";
import { artists, type ArtistSlug, type Artwork } from "@/lib/artists";
import { artworkPrice } from "@/lib/catalog";
import { T, type DictKey, useLanguage, usePrice, useT } from "@/lib/i18n";

/** 이력 한 묶음. 번역 키(items), 원문 그대로의 줄(lines), 또는 숫자 하나(stat) 중 필요한 것을 쓴다. */
export type CvGroup = { label: DictKey; items?: DictKey[]; lines?: string[]; stat?: number };

/** 예전 맞춤 페이지에만 있던 글(필명·노트 제목·본문). 없으면 생략된다. */
export type ArtistNote = { penName?: DictKey; heading?: DictKey; body?: DictKey };

/**
 * 프로필만 등록된 작가(신청서로 들어온 작가)의 공용 페이지.
 *
 * 전시장 한 켠처럼 꾸몄다: 작가 사진은 못에 걸린 액자(마우스를 올리면 살짝
 * 흔들린다), 옆에는 미술관 벽 캡션처럼 이름·분야·작품 수를 적은 라벨, 이력은
 * 연표, 작품이 아직 없으면 빈 액자 세 개가 걸린 "빈 벽"을 보여준다 — 페이지가
 * 비어 보이지 않으면서도, 없는 작품을 있는 것처럼 꾸미지 않는다.
 */
export function ArtistProfilePage({ slug, works, portrait, cv, eyebrow = "artistSecondEyebrow", intro, note, worksHeading }: {
  slug: ArtistSlug;
  works: Artwork[];
  portrait?: string;
  cv: CvGroup[];
  eyebrow?: DictKey;
  /** 히어로 소개문을 번역 사전에서 가져올 때. 없으면 artist.statement를 쓴다. */
  intro?: DictKey;
  note?: ArtistNote;
  worksHeading?: DictKey;
}) {
  const { lang } = useLanguage();
  const t = useT();
  const artist = artists[slug];
  const name = artist.name[lang];
  // 다른 언어 이름을 작게 곁들인다. "후후/HooHoo"처럼 이미 들어 있으면 생략.
  const altName = artist.name[lang === "ko" ? "en" : "ko"];
  const showAlt = altName && altName !== name && !name.includes(altName);
  const seller = artist.sellerType === "business" ? "artistLabelSellerBusiness" : artist.sellerType === "individual" ? "artistLabelSellerIndividual" : null;
  // What the works for sale cost now, from the catalogue (sold ones left out):
  // the first thing a buyer wants to know about an artist before scrolling.
  const formatPrice = usePrice();
  const prices = works.filter((artwork) => artwork.statusKey === "available").map((artwork) => artworkPrice(artwork.price)).filter((price): price is number => price !== null);
  const priceRange = prices.length === 0 ? null : Math.min(...prices) === Math.max(...prices) ? formatPrice(prices[0]) : `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`;

  return <><SiteHeader /><main className="ap">
    <nav className="ap-navigation" aria-label={t("artistExploreOthers")}><Link className="back-button" href="/artists"><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M11 1 2 8l9 7Z" /></svg><T k="artistExploreOthers" /></Link></nav>
    <section className="ap-hero">
      <div className="ap-hero-copy">
        <p className="eyebrow"><T k={eyebrow} /></p>
        {/* "후후/HooHoo" is one unbroken word to the line breaker, so on a phone
            it split mid-name ("HooHo / o"). <wbr> offers the slash instead. */}
        <h1 className="ap-name">{name.split("/").map((part, index) => index ? <Fragment key={index}>/<wbr />{part}</Fragment> : part)}</h1>
        {showAlt ? <p className="ap-alt-name">{altName}</p> : null}
        {artist.medium ? <p className="ap-medium">{artist.medium[lang]}</p> : null}
        {intro ? <blockquote className="ap-quote"><p><T k={intro} /></p></blockquote> : artist.statement ? <blockquote className="ap-quote"><p>{artist.statement[lang]}</p></blockquote> : null}
      </div>

      <div className="ap-wall">
        <div className="ap-frame" tabIndex={0} aria-label={name}>
          <span className="ap-nail" aria-hidden="true" />
          {/* 못(정가운데)에서 액자 위 양쪽 고리까지 대칭으로 내려오는 끈 */}
          <svg className="ap-string" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="18,70 50,6 82,70" />
          </svg>
          <div className="ap-frame-inner">
            {portrait
              ? <Image src={portrait} alt={name} fill preload sizes="(max-width:900px) 80vw, 36vw" />
              : <span className="ap-frame-empty"><span>{name.slice(0, 1)}</span><small><T k="artistPhotoSoon" /></small></span>}
          </div>
        </div>
        <dl className="ap-label">
          <div><dt><T k="artistLabelArtist" /></dt><dd>{name}</dd></div>
          {artist.medium ? <div><dt><T k="artistLabelMedium" /></dt><dd>{artist.medium[lang]}</dd></div> : null}
          <div><dt><T k="artistLabelWorks" /></dt><dd>{t("artistLabelWorksCount").replace("{n}", String(works.length))}</dd></div>
          {priceRange ? <div><dt><T k="artistLabelPriceRange" /></dt><dd>{priceRange}</dd></div> : null}
          {seller ? <div><dt><T k="artistLabelSeller" /></dt><dd><T k={seller} /></dd></div> : null}
        </dl>
      </div>
    </section>

    {note?.heading || note?.body ? (
      <section className="ap-note">
        <p className="section-number"><T k="artistNoteEyebrow" /></p>
        <div>
          {note.penName ? <p className="ap-pen-name"><T k={note.penName} /></p> : null}
          {note.heading ? <h2><T k={note.heading} /></h2> : null}
          {note.body ? <p className="ap-note-body"><T k={note.body} /></p> : null}
        </div>
      </section>
    ) : null}

    {cv.length > 0 ? (
      <section className="ap-cv">
        {/* 왼쪽: 한눈에 보기 — 이력 묶음마다 개수만 세서 보여준다(지어낸 숫자 없음). 스크롤을 따라온다. 문의 버튼은 페이지 끝 한 곳에만 둔다. */}
        <aside className="ap-cv-aside">
          <p className="section-number">{note?.heading || note?.body ? "CV" : <T k="artistNoteEyebrow" />}</p>
          <p className="ap-glance-title"><T k="artistGlanceTitle" /></p>
          <dl className="ap-glance">
            {cv.map((group) => (
              <div key={group.label}>
                <dt><T k={group.label} /></dt>
                <dd>{group.stat ?? (group.items?.length ?? 0) + (group.lines?.length ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <div className="ap-cv-main">
          {/* 숫자 하나짜리 이력(예: 개인전 13회)은 목록 옆에 두면 아래가 비어서, 맨 위 한 줄로 모은다. */}
          {cv.some((group) => group.stat !== undefined) ? (
            <div className="ap-stat-strip">
              {cv.filter((group) => group.stat !== undefined).map((group) => (
                <div key={group.label}>
                  <p className="ap-stat">{group.stat}</p>
                  <p className="ap-stat-label"><T k={group.label} /></p>
                </div>
              ))}
            </div>
          ) : null}
          {/* 목록은 신문 단처럼 흘러가게 해서, 짧은 묶음 밑에 구멍이 생기지 않게 한다. */}
          <div className="ap-cv-groups" data-count={cv.filter((group) => group.stat === undefined).length}>
            {cv.filter((group) => group.stat === undefined).map((group) => (
              <div className="ap-cv-group" key={group.label}>
                <h3><T k={group.label} /><span>{(group.items?.length ?? 0) + (group.lines?.length ?? 0)}</span></h3>
                <ol className="ap-timeline">
                  {group.items?.map((item) => <li key={item}><T k={item} /></li>)}
                  {group.lines?.map((line) => <li key={line}>{line}</li>)}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>
    ) : null}

    <section className="artist-works ap-works">
      <div className="section-heading">
        <div><p className="eyebrow dark"><T k="selectedWorksEyebrow" /></p><h2>{worksHeading ? <T k={worksHeading} /> : name}</h2></div>
        <Link href="/artworks"><T k="viewAllArrow" /></Link>
      </div>
      {works.length > 0 ? (
        <div className="art-grid ap-work-grid">{works.map((artwork) => <ArtworkCard key={artwork.slug} artwork={artwork} />)}</div>
      ) : null}
      {works.length > 0 ? (
        /* 작품이 있는 작가도 페이지 끝에서 같은 두 버튼으로 이어지게 한다(빈 벽과 같은 모양). */
        <div className="ap-empty-actions ap-works-cta">
          <Link className="ap-btn ap-btn-primary" href="/artworks"><T k="artistEmptyWallBrowse" /></Link>
          <Link className="ap-btn ap-btn-ghost" href="/inquiry"><T k="artistEmptyWallAsk" /></Link>
        </div>
      ) : (
        <div className="ap-empty-wall">
          <div className="ap-empty-frames" aria-hidden="true">
            <span className="ap-empty-frame" /><span className="ap-empty-frame" /><span className="ap-empty-frame" />
          </div>
          <h3><T k="artistEmptyWallHeading" /></h3>
          <p>{t("artistEmptyWallBody").replace("{name}", name)}</p>
          <div className="ap-empty-actions">
            <Link className="ap-btn ap-btn-primary" href="/artworks"><T k="artistEmptyWallBrowse" /></Link>
            <Link className="ap-btn ap-btn-ghost" href="/inquiry"><T k="artistEmptyWallAsk" /></Link>
          </div>
        </div>
      )}
    </section>
    <nav className="ap-other-artists" aria-label={t("artistExploreOthers")}><h2><T k="artistExploreOthers" /></h2><div>{Object.values(artists).filter((item) => item.slug !== slug).map((item) => <Link href={`/artists/${item.slug}`} key={item.slug}>{item.name[lang]}</Link>)}</div></nav>
  </main></>;
}
