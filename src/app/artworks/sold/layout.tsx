import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// The page is a client component and cannot export metadata, so it lives here.
export const metadata: Metadata = pageMetadata({
  title: "판매 완료 | 포트 갤러리",
  description: "포트 갤러리에서 새로운 주인을 만난 작품들입니다. 구매는 어렵지만 작가가 지나온 자리를 함께 볼 수 있도록 남겨두었습니다.",
  path: "/artworks/sold",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
