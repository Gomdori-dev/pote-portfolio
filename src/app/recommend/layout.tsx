import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "공간 사진으로 작품 추천받기 — 무료 | 포트 갤러리",
  description: "집이나 사무실 벽 사진을 보내주시면 포트 갤러리가 어울리는 원화 3점을 골라 48시간 안에 보내드립니다. 무료이며 구매 의무가 없습니다.",
  path: "/recommend",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
