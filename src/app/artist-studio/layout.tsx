import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = {
  title: "작가 스튜디오 | 포트 갤러리",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
