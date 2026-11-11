import { getAllArtworks } from "@/lib/all-artworks";
import { pageMetadata } from "@/lib/seo";
import { INTERNATIONAL_ARTIST_SLUGS } from "@/lib/international-artists";
import { InternationalArtistsClient } from "./InternationalArtistsClient";

export const metadata = pageMetadata({
  title: "해외 작가 | 포트 갤러리",
  description: "포트 갤러리에 참여하는 해외 작가의 이야기와 작품을 소개합니다. Qiuchi Chen의 작업을 만나보세요.",
  path: "/artists/international",
});

export default async function InternationalArtistsPage() {
  const artworks = await getAllArtworks();
  const works = artworks.filter((artwork) => INTERNATIONAL_ARTIST_SLUGS.includes(artwork.artistSlug));
  return <InternationalArtistsClient artworks={works} />;
}
