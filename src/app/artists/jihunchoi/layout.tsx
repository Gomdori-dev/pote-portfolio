import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "강화수지로 부조 작업을 하는 조각가 최지훈의 작업 소개와 전시·수상 이력.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("jihunchoi", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("jihunchoi", DESCRIPTION)} />{children}</>;
}
