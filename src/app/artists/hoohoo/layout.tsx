import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "모래를 반복해서 쌓고 흩트리며 캔버스 위에 시간의 밀도를 쌓아가는 작가 후후/HooHoo의 작업 세계와 원화를 만나보세요.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("hoohoo", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("hoohoo", DESCRIPTION)} />{children}</>;
}
