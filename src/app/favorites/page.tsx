// Server component: fetches the merged (static + admin-approved DB) catalog
// so a favorited/recently-viewed DB submission's card renders here too. See
// FavoritesPageClient.tsx for the actual markup (kept as "use client" since
// favorites/recently-viewed live in browser storage and can't be read here).
import { getAllArtworks } from "@/lib/all-artworks";
import { FavoritesPageClient } from "./FavoritesPageClient";

export default async function FavoritesPage() {
  const catalog = await getAllArtworks();
  return <FavoritesPageClient catalog={catalog} />;
}
