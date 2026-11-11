// Server component: builds the gift shelf from the merged (static + DB)
// catalog, so an approved artist-portal submission under the price cap
// appears here without a code change.
import { getAllArtworks } from "@/lib/all-artworks";
import { artworkPrice } from "@/lib/catalog";
import { GiftPageClient } from "./GiftPageClient";

const GIFT_PRICE_CAP = 500_000;

export default async function GiftPage() {
  const catalog = await getAllArtworks();
  const gifts = catalog
    .filter((artwork) => { const price = artworkPrice(artwork.price); return artwork.statusKey !== "sold" && price !== null && price <= GIFT_PRICE_CAP; })
    .sort((a, b) => artworkPrice(a.price)! - artworkPrice(b.price)!);
  return <GiftPageClient gifts={gifts} />;
}
