import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "작품 문의하기 | 포트 갤러리",
  description: "마음에 드는 작품이 있다면 편하게 문의하세요. 문의만으로 구매가 확정되지는 않습니다.",
  path: "/inquiry",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
