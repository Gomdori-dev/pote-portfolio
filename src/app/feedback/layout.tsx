import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "의견 보내기 | 포트 갤러리",
  description: "포트 갤러리를 더 나은 곳으로 만들기 위한 의견을 기다립니다.",
  path: "/feedback",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
