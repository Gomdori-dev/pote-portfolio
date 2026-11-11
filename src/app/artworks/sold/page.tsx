// Server component: derives the sold list from the merged (static + admin-
// approved DB) catalog so a DB submission approved with statusKey "sold"
// shows up here too. See SoldWorksPageClient.tsx for the actual markup.
import { soldArtworksFrom } from "@/lib/artworks";
import { getAllArtworks } from "@/lib/all-artworks";
import { SoldWorksPageClient } from "./SoldWorksPageClient";

export default async function SoldWorksPage() {
  const catalog = await getAllArtworks();
  return <SoldWorksPageClient soldArtworks={soldArtworksFrom(catalog)} />;
}
