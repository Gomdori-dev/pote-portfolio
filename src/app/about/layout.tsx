import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page is a client component and cannot export metadata, so it lives here.
export const metadata: Metadata = pageMetadata({
  title: "포트 갤러리 소개 — 그림 한 점이 평생의 단짝이 되도록",
  description: "Pote는 프랑스어로 ‘단짝’. 포트 갤러리는 지금 작업하는 작가들의 원화를 이름보다 작품으로 소개하는 온라인 갤러리입니다.",
  path: "/about",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
