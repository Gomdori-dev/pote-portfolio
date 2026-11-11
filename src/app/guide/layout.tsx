import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page itself is a client component and cannot export metadata, so it lives
// here. Without it the route inherits the root layout's title and looks like a
// duplicate of every other page to a crawler.
export const metadata: Metadata = pageMetadata({
  title: "구매 안내 — 배송·보증서·환불 | 포트 갤러리",
  description: "작품 문의부터 배송, 보증서, 환불까지. 포트 갤러리에서 원화를 구매할 때 알아두실 절차를 정리했습니다.",
  path: "/guide",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
