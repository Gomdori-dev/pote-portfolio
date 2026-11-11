import type { Metadata } from "next";
import { getAllArtworks } from "@/lib/all-artworks";
import { artistPortrait } from "@/lib/artist-portraits";
import { artists, type Artist, type ArtistSlug, type Artwork } from "@/lib/artists";
import { artworkMedium, artworkPrice } from "@/lib/catalog";
import { koreanizeDetails } from "@/lib/korean-labels";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function trimTo(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s·,.]+$/, "")}…`;
}

/** "30만~120만 원" when every price is a round 만 원, else "75,000~1,200,000원" — never the two mixed. */
function priceRange(prices: number[]): string {
  if (prices.length === 0) return "";
  const [low, high] = [Math.min(...prices), Math.max(...prices)];
  const round = prices.every((price) => price >= 10_000 && price % 10_000 === 0);
  const format = (amount: number) => round ? `${(amount / 10_000).toLocaleString("ko-KR")}만` : amount.toLocaleString("ko-KR");
  const unit = round ? " 원" : "원";
  return low === high ? `${format(low)}${unit}` : `${format(low)}~${format(high)}${unit}`;
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Search snippet for an artist page that has no hand-written one. Eleven
 * pages said only "OOO의 작가 소개와 작품을 포트 갤러리에서 만나보세요." (10/31), the
 * same sentence with a different name. Everything here is read from the
 * registry and catalogue — the field the artist gave, what is for sale now and
 * at what prices, and the opening of the artist's own statement — so nothing is
 * written on the artist's behalf. Sold works are not counted (never shown).
 */
export function artistMetaDescription(artist: Artist, works: Artwork[], limit = 155): string {
  const available = works.filter((work) => work.statusKey === "available");
  const prices = available.map((work) => artworkPrice(work.price)).filter((price): price is number => price !== null);
  // Portal entries can be English ("Acrylic"); a Korean snippet only takes a
  // Korean material name, and otherwise says just "작품".
  const material = mostCommon(available.map((work) => artworkMedium(koreanizeDetails(work.ko.details))).filter((value) => value && /[가-힣]/.test(value)));
  const field = artist.medium?.ko ?? material;
  const range = priceRange(prices);
  const parts = [
    `${artist.name.ko} 작가의 ${field ? `${field} ` : ""}작품을 소개합니다.`,
    available.length ? `판매 중 ${available.length}점${range ? `, ${range}` : ""}.` : "",
    // A numbered answer from the application form ("1. 작업 방식 : …") reads
    // oddly as a snippet's opening; only the leading number goes.
    artist.statement ? collapse(artist.statement.ko).replace(/^\d+\.\s*/, "") : "",
  ];
  return trimTo(parts.filter(Boolean).join(" "), limit);
}

async function worksBy(slug: ArtistSlug): Promise<Artwork[]> {
  return (await getAllArtworks()).filter((artwork) => artwork.artistSlug === slug);
}

const titleFor = (artist: Artist) => `${artist.name.ko} — 작가 소개와 작품 | 포트 갤러리`;

/** Metadata for /artists/<slug>; `description` is the hand-written one when there is one. */
export async function artistPageMetadata(slug: ArtistSlug, description?: string): Promise<Metadata> {
  const artist = artists[slug];
  return pageMetadata({
    title: titleFor(artist),
    description: description ?? artistMetaDescription(artist, await worksBy(slug)),
    path: `/artists/${slug}`,
    image: artistPortrait(slug),
  });
}

/**
 * ProfilePage + Person for an artist page, and where it sits in the site.
 * Artist pages had no structured data at all, while every artwork page already
 * names its creator with a link here; this is the other end of that link.
 * The description is the artist's own statement when they gave one.
 */
export async function artistJsonLd(slug: ArtistSlug, description?: string) {
  const artist = artists[slug];
  const works = await worksBy(slug);
  const url = absoluteUrl(`/artists/${slug}`);
  const portrait = artistPortrait(slug);
  const alternate = artist.name.en && artist.name.en !== artist.name.ko && !artist.name.ko.includes(artist.name.en) ? artist.name.en : null;
  const person = {
    "@type": "Person",
    name: artist.name.ko,
    ...(alternate ? { alternateName: alternate } : {}),
    url,
    ...(portrait ? { image: absoluteUrl(portrait) } : {}),
    description: artist.statement ? collapse(artist.statement.ko) : description ?? artistMetaDescription(artist, works),
    ...(artist.medium ? { knowsAbout: artist.medium.ko } : {}),
  };
  return [
    { "@context": "https://schema.org", "@type": "ProfilePage", url, name: titleFor(artist), mainEntity: person },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "홈", item: absoluteUrl("/") },
        { name: "참여 작가", item: absoluteUrl("/artists") },
        { name: artist.name.ko, item: url },
      ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
    },
  ];
}
