import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArtworkDetailView, type RelatedArtworks } from "@/components/ArtworkDetailView";
import { SiteHeader } from "@/components/SiteHeader";
import { getArtist, type Artwork } from "@/lib/artists";
import { toCardArtwork } from "@/lib/card-artwork";
import { artworkPrice } from "@/lib/catalog";
import { artworkColorFamilies } from "@/lib/discovery";
import { SOCIAL_HOLD_SLUGS } from "@/lib/social-holds";
import { getAllArtworks, getArtworkFromAll } from "@/lib/all-artworks";
import { orderedArtworks } from "@/lib/artwork-order";
import { JsonLd } from "@/components/JsonLd";
import { artworkJsonLd, artworkMetaDescription, artworkMetaTitle, artworkShareImage } from "@/lib/seo";

// Approved DB submissions are included here so their pages are prerendered
// too. `getAllArtworks()` degrades to just the static catalog when the DB
// isn't configured (e.g. at build time before the Neon integration exists),
// so this stays safe to call unconditionally.
export async function generateStaticParams() {
  const artworks = await getAllArtworks();
  return artworks.map(({ slug }) => ({ slug }));
}

/**
 * Every page on the site used to inherit the root layout's title, so all 50
 * sitemap URLs looked like one document to a crawler — which is why the inner
 * pages never made it into Naver's index while the homepage did. Korean copy,
 * since the metadata is server-rendered once and Naver is the search engine
 * that needs it; the language switcher only affects the client render.
 */
export async function generateMetadata({ params }: PageProps<"/artworks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [artwork, catalog] = await Promise.all([getArtworkFromAll(slug), getAllArtworks()]);
  if (!artwork) return {};
  const artist = getArtist(artwork.artistSlug);
  const title = artworkMetaTitle(artwork, artist, catalog);
  const description = artworkMetaDescription(artwork);
  const alt = `${artist.name.ko} — ${artwork.ko.title}`;
  const image = artworkShareImage(artwork.image);
  return {
    title,
    description,
    alternates: { canonical: `/artworks/${slug}` },
    openGraph: { title, description, url: `/artworks/${slug}`, siteName: "포트 갤러리", type: "article", locale: "ko_KR", images: [{ url: image, alt }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

const RELATED_ROW = 4;

/**
 * Two rows under a work, so a visitor who likes it has somewhere to go next
 * instead of the page ending (10/20~30: 297 sessions saw a detail page, 5 opened
 * an inquiry). First the artist's own works; then other artists' works that share
 * the most colour families, then the same mood, then the nearest price — one per
 * artist, so the row is not one painter again and no artist is buried. Sold works
 * never appear (orderedArtworks keeps only available ones).
 */
function relatedArtworks(artwork: Artwork, catalog: Artwork[]): RelatedArtworks {
  const pool = orderedArtworks(undefined, catalog).filter((work) => work.slug !== artwork.slug && !SOCIAL_HOLD_SLUGS.has(work.slug));
  const own = pool.filter((work) => work.artistSlug === artwork.artistSlug).slice(0, RELATED_ROW);
  const families = artworkColorFamilies(artwork);
  const price = artworkPrice(artwork.price);
  const scored = pool.filter((work) => work.artistSlug !== artwork.artistSlug).map((work) => {
    const other = artworkPrice(work.price);
    return {
      work,
      colours: [...artworkColorFamilies(work)].filter((family) => families.has(family)).length,
      mood: work.moodKey === artwork.moodKey ? 1 : 0,
      distance: price === null || other === null ? Number.POSITIVE_INFINITY : Math.abs(other - price),
    };
  }).sort((a, b) => b.colours - a.colours || b.mood - a.mood || a.distance - b.distance);
  const seen = new Set<string>();
  const onePerArtist = scored.filter(({ work }) => !seen.has(work.artistSlug) && seen.add(work.artistSlug));
  const picked = [...onePerArtist, ...scored.filter((item) => !onePerArtist.includes(item))].slice(0, RELATED_ROW);
  return {
    own: own.map(toCardArtwork),
    similar: picked.map(({ work }) => toCardArtwork(work)),
    // "색과 분위기가 비슷한" only when every work shown actually shares one.
    similarByLook: picked.length > 0 && picked.every((item) => item.colours > 0 || item.mood > 0),
  };
}

export default async function ArtworkPage({ params }: PageProps<"/artworks/[slug]">) {
  const { slug } = await params;
  const [artwork, catalog] = await Promise.all([getArtworkFromAll(slug), getAllArtworks()]);
  if (!artwork) notFound();
  const related = relatedArtworks(artwork, catalog);
  return <><JsonLd data={artworkJsonLd(artwork, getArtist(artwork.artistSlug))} /><SiteHeader /><ArtworkDetailView artwork={artwork} related={related} /></>;
}
