import type { Metadata } from "next";

// Admin screens must never be indexed. Without this they inherit the root
// layout's canonical "/" and can be read as a copy of the home page. robots.ts
// deliberately does not block /admin: a crawler that cannot fetch the page
// never sees this noindex.
export const metadata: Metadata = {
  title: "관리",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
