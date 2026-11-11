import { getAllArtworks } from "@/lib/all-artworks";
import { ArtistPageClient } from "./ArtistPageClient";

export default async function ArtistPage() {
  const artworks = await getAllArtworks();
  const works = artworks.filter((artwork) => artwork.artistSlug === "cheongunsim");
  return <ArtistPageClient works={works} />;
}
