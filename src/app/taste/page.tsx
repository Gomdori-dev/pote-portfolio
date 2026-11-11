import { getSnapshotExhibitions, visibleExhibitions } from "@/lib/exhibitions";
import { getKoreanDate } from "@/lib/korean-date";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getAllArtworks } from "@/lib/all-artworks";
import { TasteQuiz } from "./TasteQuiz";

export const metadata: Metadata = pageMetadata({
  title: "취향 찾기 — 마음이 가는 작품 고르기 | 포트 갤러리",
  description: "작품 몇 점을 보고 끌리는지 고르면 좋아하는 색과 분위기를 정리해 드리고, 어울리는 원화와 전시를 보여드립니다.",
  path: "/taste",
});

export default async function TastePage() {
  const artworks = await getAllArtworks();
  const todayIso = getKoreanDate();
  return <TasteQuiz artworks={artworks} exhibitions={visibleExhibitions(getSnapshotExhibitions(), todayIso)} todayIso={todayIso} />;
}
