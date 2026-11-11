import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "작품 보기 — 신진 작가 원화 | 포트 갤러리",
  description: "참여 작가들의 원화를 분위기·작가·가격대·크기로 찾아보세요. 작품마다 실제 크기를 벽에 걸어볼 수 있습니다.",
  path: "/artworks",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
