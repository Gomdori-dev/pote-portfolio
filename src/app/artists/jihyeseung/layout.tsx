import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { artistJsonLd, artistPageMetadata } from "@/lib/artist-seo";

// The page itself is a client component and cannot export metadata, so it lives
// here, with the artist's structured data. Without it the route inherits the
// root layout's title and looks like a duplicate of every other page to a crawler.
const DESCRIPTION = "서울을 기반으로 다양한 재료와 표현 방식을 오가며 작업하는 작가 지혜승의 어해도 연작과 원화를 소개합니다.";

export function generateMetadata(): Promise<Metadata> {
  return artistPageMetadata("jihyeseung", DESCRIPTION);
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <><JsonLd data={await artistJsonLd("jihyeseung", DESCRIPTION)} />{children}</>;
}
