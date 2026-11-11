import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "작가 세금 안내 — 원화 판매 소득·부가세·신고 | 포트 갤러리",
  description: "작가가 자기 작품을 팔았을 때의 소득 구분, 부가가치세 면세, 사업자등록, 종합소득세 신고를 법령과 국세청 자료 기준으로 정리했습니다.",
  path: "/tax-guide",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
