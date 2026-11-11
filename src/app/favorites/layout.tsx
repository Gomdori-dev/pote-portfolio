import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = {
  title: "찜한 작품 | 포트 갤러리",
  description: "이 브라우저에 저장해 둔 작품 목록입니다.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
