import type { MetadataRoute } from "next";
import { artists } from "@/lib/artists";
import { getAllArtworks } from "@/lib/all-artworks";
import { SITE_URL } from "@/lib/site";
import { artistPortrait } from "@/lib/artist-portraits";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastModified is left out on purpose: the catalog does not record when a
  // work changed, and a made-up date is worse for crawlers than none.
  const staticRoutes: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number; images?: string[] }[] = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/artworks", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/artworks/sold", changeFrequency: "monthly" as const, priority: 0.4 },
    { path: "/artists", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/artists/international", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/exhibitions", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/taste", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/guide", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/recommend", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/event", changeFrequency: "weekly" as const, priority: 0.6 },
    { path: "/gift", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/tax-guide", changeFrequency: "yearly" as const, priority: 0.4 },
    { path: "/apply", changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  // Built from the `artists` registry, not listed by hand: /artists/haerang was
  // missing from this file for as long as 해랑 had been on the site, because the
  // list was hardcoded (see feedback_new_artist_checklist).
  const artistRoutes = Object.values(artists).map((artist) => ({
    path: `/artists/${artist.slug}`, changeFrequency: "monthly" as const, priority: 0.7,
    images: [artistPortrait(artist.slug)].filter((image): image is string => Boolean(image)).map((image) => new URL(image, SITE_URL).href),
  }));

  const artworks = await getAllArtworks();
  const artworkRoutes = artworks.map((artwork) => ({
    path: `/artworks/${artwork.slug}`, changeFrequency: "monthly" as const, priority: 0.7,
    images: [new URL(artwork.image, SITE_URL).href],
  }));

  return [...staticRoutes, ...artistRoutes, ...artworkRoutes].map(({ path, changeFrequency, priority, images }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
    ...(images?.length ? { images } : {}),
  }));
}
