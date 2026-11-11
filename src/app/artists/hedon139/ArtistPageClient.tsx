"use client";

import { ArtistProfilePage, type CvGroup } from "@/components/ArtistProfilePage";
import type { Artwork } from "@/lib/artworks";

// 2026-09-25 공용 ArtistProfilePage로 옮김. 이력 문구는 예전 페이지 그대로다.
const SOLO_SHOWS = [
  "2025. 03  Pink city (모두의 갤러리, 인천)",
  "2025. 06  Hedon is everywhere (도슨트 갤러리, 김해)",
  "2025. 10  천사 타락 작전 (WWD 갤러리, 대전)",
  "2025. 12  Romantic punk (김정숙 갤러리, 인천)",
  "2026. 08  오늘부터 아기로 살겠습니다 (한국만화박물관)",
];

const SELECTED_GROUP_SHOWS = [
  "2026. 04  더 카툰 아트 쇼 서울 (APO22, 서울)",
  "2025. 05  2025 한국현대미술 독일 베를린 아트 페스티벌 (Q 갤러리, 베를린)",
  "2024. 01  한국 인도 교류전 Parallel universe (우르밀라 아트 갤러리, 인도)",
  "2023. 10  GLOBAL DAO ART 기후환경 치유 생명복원 단체전 (싱가포르 아트 뮤지엄)",
  "2023. 10  PCW 한일 글로벌 교류전 (도쿠시마 청소년 센터, 일본)",
  "2023. 06  백남준과 젊은 후예들 (롯데백화점, 일산)",
];

const CV: CvGroup[] = [
  { label: "artistSoloShowsLabel", lines: SOLO_SHOWS },
  { label: "artistGroupShowsLabel", lines: SELECTED_GROUP_SHOWS },
];

export function ArtistPageClient({ works }: { works: Artwork[] }) {
  return <ArtistProfilePage slug="hedon139" works={works} portrait="/artists/hedon139/portrait.jpg" cv={CV} />;
}
