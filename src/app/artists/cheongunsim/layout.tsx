import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
// No hand-written description: artistPageMetadata builds one from the
// registry and the works for sale (see artistMetaDescription).
export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("cheongunsim");
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("cheongunsim")} />{children}</>;
}
