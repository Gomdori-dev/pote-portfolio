import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "참여 작가 | 포트 갤러리",
  description: "포트 갤러리와 함께하는 작가들의 작업과 이야기. 재료를 다루는 방식부터 작품이 태어난 배경까지 소개합니다.",
  path: "/artists",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
