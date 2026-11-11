// Server component: fetches the merged (static + admin-approved DB) catalog
// so a newly approved submission takes part in this page's daily shuffle and
// search/filter grid, not just its own artist page and detail URL. See
// ArtworksPageClient.tsx for the actual markup (kept as "use client" since it
// reads `useSearchParams()` for the filter state).
import { getAllArtworks } from "@/lib/all-artworks";
import { availableCardArtworks } from "@/lib/card-artwork";
import { ArtworksPageClient } from "./ArtworksPageClient";

export default async function ArtworksPage() {
  // Sold works are never in this grid (they live at /artworks/sold), and the
  // cards need no descriptions or extra photos.
  const catalog = availableCardArtworks(await getAllArtworks());
  return <ArtworksPageClient catalog={catalog} />;
}
