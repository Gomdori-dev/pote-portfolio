import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "30년 넘게 한지를 다뤄온 작가 해랑이유미. 한지와 빔지의 결에 삶의 시간과 기억을 새긴 작품을 소개합니다.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("haerang", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("haerang", DESCRIPTION)} />{children}</>;
}
