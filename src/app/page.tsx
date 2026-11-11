// Server component: fetches the merged (static + admin-approved DB) catalog
// so a newly approved submission shows up on the homepage — hero slides, the
// mood/budget/size grid and the "MEET THE ARTIST" fallback — without a
// redeploy. See HomeClient.tsx for the actual markup (kept as "use client"
// since it reads the language toggle, the daily mood colours and the daily
// shuffle via hooks).
import { getAllArtworks } from "@/lib/all-artworks";
import { JsonLd } from "@/components/JsonLd";
import { siteJsonLd } from "@/lib/seo";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const catalog = await getAllArtworks();
  return <><JsonLd data={siteJsonLd()} /><HomeClient catalog={catalog} /></>;
}
