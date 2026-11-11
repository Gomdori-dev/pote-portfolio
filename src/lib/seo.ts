import type { Metadata } from "next";
import type { Artist, Artwork, StatusKey } from "@/lib/artists";
import { artworkDimensionsCm, artworkMedium, artworkPrice } from "@/lib/catalog";
import { artworkSizeForDisplay } from "@/lib/artwork-size";
import { SITE_URL } from "@/lib/site";

const DEFAULT_SHARE_IMAGE = "/brand/pote-gallery-og-card.png";

/**
 * Metadata for one public page, share card included.
 *
 * Next merges metadata shallowly: a page that sets only title and description
 * still inherits the root layout's whole openGraph/twitter object, so a link to
 * /gift or /artists/hoohoo pasted into KakaoTalk or Instagram showed the home
 * page's title and blurb. Every public layout builds its metadata here so the
 * card always matches the page.
 *
 * The brand card is 1200x630. Any other image (an artist portrait) has its own
 * size, so width/height are left out rather than guessed.
 */
export function pageMetadata({ title, description, path, image }: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = image ?? DEFAULT_SHARE_IMAGE;
  const size = image ? {} : { width: 1200, height: 630 };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "포트 갤러리",
      locale: "ko_KR",
      type: "website",
      images: [{ url, ...size }],
    },
    twitter: { card: "summary_large_image", title, description, images: [url] },
  };
}

/** Absolute URL for a site path or an already-absolute image address (Blob uploads). */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, SITE_URL).href;
}

/**
 * Share-card image for an artwork: the 1200px resize from the image optimizer
 * rather than the original, which can be 2MB and makes KakaoTalk and Facebook
 * drop the preview or show it late. 1200 and quality 75 are both allowed in
 * next.config (deviceSizes/qualities), so the optimizer accepts the request.
 */
export function artworkShareImage(image: string): string {
  return `${SITE_URL}/api/display-image?url=${encodeURIComponent(image)}&w=1200&q=75`;
}

// "예약 중" is not open to a new buyer: the catalogue grid only lists
// available works and files reserved ones with the sold ones
// (artwork-order.ts), so it is Reserved here rather than InStock.
const AVAILABILITY: Record<StatusKey, string> = {
  available: "https://schema.org/InStock",
  sold: "https://schema.org/SoldOut",
  pending: "https://schema.org/Reserved",
};

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Search snippet and share-card text for an artwork: the facts first, so a
 * cut still shows the material, size, price and whether the work is
 * available. Whitespace from the artist's text (portal descriptions keep
 * their line breaks) is collapsed, a plain KRW price gets its separators the
 * way the page shows it, and a long description ends on a whole word.
 */
export function artworkMetaDescription(artwork: Artwork, limit = 155): string {
  const amount = artworkPrice(artwork.price);
  const price = amount !== null ? `${amount.toLocaleString("ko-KR")}원` : artwork.price ? collapse(artwork.price) : "";
  // The title leads: a series with one size, price and short note ("Here i am
  // 1~6") otherwise gave six pages the same snippet word for word.
  const facts = [collapse(artwork.ko.title), collapse(artwork.ko.details), price, artwork.ko.status].filter(Boolean).join(" · ");
  const text = [facts, collapse(artwork.ko.description)].filter(Boolean).join(" · ");
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s·,.]+$/, "")}…`;
}

// What can tell two same-titled works apart, in the order a buyer would: size,
// year, then the first colours. The visible title is never changed.
const TITLE_CLUES: ((artwork: Artwork) => string)[] = [
  (artwork) => { const size = artworkDimensionsCm(artwork.ko.details); return size ? `${size.w} × ${size.h}cm` : ""; },
  (artwork) => artwork.ko.details.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "",
  (artwork) => artwork.ko.palette.slice(0, 2).join("·"),
];

/**
 * Page title for an artwork. Series share a title ("Here I Am" ×10, "운우" ×7 on
 * 10/31) and identical titles read as duplicate pages to a crawler, so a title
 * the artist used more than once gets only as many clues as it takes to tell
 * the works apart: "Here I Am (53 × 45.5cm · 2026) — 민경훈 | 포트 갤러리".
 */
export function artworkMetaTitle(artwork: Artwork, artist: Artist, catalog: Artwork[]): string {
  const sameTitle = (work: Artwork) => work.artistSlug === artwork.artistSlug && collapse(work.ko.title).toLowerCase() === collapse(artwork.ko.title).toLowerCase();
  let group = catalog.filter(sameTitle);
  const clues: string[] = [];
  for (const clue of TITLE_CLUES) {
    const mine = clue(artwork);
    if (group.length <= 1) break;
    if (!mine || group.every((work) => clue(work) === mine)) continue;
    clues.push(mine);
    group = group.filter((work) => clue(work) === mine);
  }
  return `${collapse(artwork.ko.title)}${clues.length ? ` (${clues.join(" · ")})` : ""} — ${artist.name.ko} | 포트 갤러리`;
}

/**
 * Structured data for an artwork page. VisualArtwork, not Product: Product
 * rich results expect shipping and return details the site does not have (the
 * artist ships and settles directly), so Google flags them as missing. The
 * offer is only described when the price reads as a plain KRW amount.
 */
export function artworkJsonLd(artwork: Artwork, artist: Artist) {
  const url = absoluteUrl(`/artworks/${artwork.slug}`);
  const artistUrl = absoluteUrl(`/artists/${artist.slug}`);
  const size = artworkSizeForDisplay(artwork);
  const medium = artworkMedium(artwork.ko.details);
  const price = artworkPrice(artwork.price);
  const cm = (value: number) => ({ "@type": "QuantitativeValue", value, unitCode: "CMT" });
  const visualArtwork = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.ko.title,
    description: artwork.ko.description,
    image: absoluteUrl(artwork.image),
    url,
    creator: { "@type": "Person", name: artist.name.ko, url: artistUrl },
    ...(medium ? { artMedium: medium } : {}),
    ...(size ? { width: cm(size.w), height: cm(size.h) } : {}),
    ...(price !== null ? {
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: "KRW",
        availability: AVAILABILITY[artwork.statusKey],
        url,
      },
    } : {}),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "홈", item: absoluteUrl("/") },
      { name: "작품 보기", item: absoluteUrl("/artworks") },
      { name: artist.name.ko, item: artistUrl },
      { name: artwork.ko.title, item: url },
    ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
  };
  return [visualArtwork, breadcrumb];
}

/** Home page: who runs the site and where else it lives. */
export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "포트 갤러리",
      alternateName: "Pote Gallery",
      url: absoluteUrl("/"),
      logo: absoluteUrl("/brand/pote-instagram-avatar.png"),
      sameAs: ["https://www.instagram.com/poteart.gallery/", "https://www.threads.com/@poteart.gallery"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "포트 갤러리",
      // Google's site-name guide reads alternateName for the other spellings
      // people actually type; the wordmark says POTE, Korean users write 포트갤러리.
      alternateName: ["Pote Gallery", "포트갤러리", "POTE GALLERY"],
      url: absoluteUrl("/"),
      inLanguage: "ko-KR",
    },
  ];
}
