import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "작가로 참여하기 — 참여 조건 안내 | 포트 갤러리",
  description: "포트 갤러리는 신진·아마추어 작가의 작품을 소개합니다. 참여 조건과 수수료를 숨기지 않고 전부 공개합니다.",
  path: "/apply",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
