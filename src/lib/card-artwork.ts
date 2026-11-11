import type { Artwork } from "@/lib/artists";

/**
 * The part of an artwork a card grid reads: ArtworkCard, filterCatalog, the
 * colour/room filters and the daily order. Descriptions, extra photos and the
 * portal's frame/condition fields only appear on the detail page, and passing
 * them for every work made /artworks ~310KB of RSC payload on top of its HTML.
 *
 * The result is still an `Artwork`, so the grid code is unchanged; only fields
 * no card reads are emptied. Never pass it to ArtworkDetailView.
 */
export function toCardArtwork({ slug, image, artistSlug, moodKey, statusKey, price, extras, ko, en }: Artwork): Artwork {
  return {
    slug, image, artistSlug, moodKey, statusKey, price,
    ...(extras?.pricing ? { extras: { pricing: extras.pricing } } : {}),
    ko: { ...ko, description: "" },
    en: { ...en, description: "" },
  };
}

/** Browsing grids only ever show works that can be bought (see orderedArtworks). */
export function availableCardArtworks(catalog: Artwork[]): Artwork[] {
  return catalog.filter((artwork) => artwork.statusKey === "available").map(toCardArtwork);
}
