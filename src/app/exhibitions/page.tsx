import { getAllArtworks } from "@/lib/all-artworks";
import { koreanDaySeed, orderedArtworks } from "@/lib/artwork-order";
import { toCardArtwork } from "@/lib/card-artwork";
import { dedupeExhibitions, getSnapshotExhibitions, visibleExhibitions } from "@/lib/exhibitions";
import { getKoreanDate } from "@/lib/korean-date";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ExhibitionsCatalog } from "./ExhibitionsCatalog";

export const metadata: Metadata = pageMetadata({
  title: "지금 열리는 전시 | 포트 갤러리",
  description: "전국 미술관·갤러리에서 지금 열리고 있는 전시를 한자리에 모았습니다. 지역과 기간으로 찾아보세요.",
  path: "/exhibitions",
});

export default async function ExhibitionsPage() {
  const todayIso = getKoreanDate();
  const exhibitions = visibleExhibitions(dedupeExhibitions(getSnapshotExhibitions()), todayIso);
  // Four of the build day's works. Picking them in the browser meant shipping
  // the whole catalogue (~150KB) to show four cards; the exhibition snapshot is
  // committed and deployed every morning, so the four still change daily.
  const works = orderedArtworks(koreanDaySeed(), await getAllArtworks()).slice(0, 4).map(toCardArtwork);
  return <ExhibitionsCatalog exhibitions={exhibitions} todayIso={todayIso} works={works} />;
}
