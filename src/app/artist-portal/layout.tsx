import type { Metadata } from "next";

// The artist portal is a sign-in screen, not a public page. Same reasoning as
// admin/layout.tsx: noindex here, and robots.ts leaves the path crawlable so
// the tag can be read.
export const metadata: Metadata = {
  title: "작가 포털 | Artist Portal",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
