import { getAllArtworks } from "@/lib/all-artworks";
import { ArtistsIndexClient } from "./ArtistsIndexClient";

export default async function ArtistsIndexPage() {
  const artworks = await getAllArtworks();
  return <ArtistsIndexClient artworks={artworks} />;
}
