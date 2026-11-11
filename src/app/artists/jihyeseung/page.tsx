// Server component: fetches the merged (static + admin-approved DB) catalog
// so a newly approved submission by this artist shows up on their own page
// without a redeploy. See ArtistPageClient.tsx for the actual markup (kept
// as "use client" since it reads the language toggle via useLanguage()).
import { getAllArtworks } from "@/lib/all-artworks";
import { ArtistPageClient } from "./ArtistPageClient";

export default async function ArtistPage() {
  const artworks = await getAllArtworks();
  const works = artworks.filter((artwork) => artwork.artistSlug === "jihyeseung");
  return <ArtistPageClient works={works} />;
}
