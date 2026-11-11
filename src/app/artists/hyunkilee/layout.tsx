import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "석회가루와 색소 재료의 우연성과 의도적 개입을 결합하는 이현기의 작업 소개와 수상 이력.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("hyunkilee", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("hyunkilee", DESCRIPTION)} />{children}</>;
}
