import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "두 판과 2~3색의 메조틴트 기법으로 자연을 주제로 작업하는 판화 작가 원식 정의 소개와 이력.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("wonsikjeong", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("wonsikjeong", DESCRIPTION)} />{children}</>;
}
