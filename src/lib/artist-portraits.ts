import type { ArtistSlug } from "@/lib/artworks";

/** 아직 프로필 사진을 받지 못한 작가. 사진이 오면 여기서 빼고 public/artists/<slug>/portrait.jpg를 넣는다. */
const NO_PORTRAIT: ArtistSlug[] = [];

/** 작가 프로필 사진 경로. 사진이 없으면 undefined — 화면은 이름 첫 글자로 대신한다. */
export function artistPortrait(slug: ArtistSlug): string | undefined {
  return NO_PORTRAIT.includes(slug) ? undefined : `/artists/${slug}/portrait.jpg`;
}

/**
 * 256px 정사각 썸네일(public/artists/<slug>/thumb.jpg). 포털·관리자 명부처럼 작게 여러 장
 * 보여줄 때 쓴다. 새 작가 사진을 넣으면 thumb.jpg도 같이 만든다(sharp, 256×256 cover).
 */
export function artistThumb(slug: ArtistSlug): string | undefined {
  return NO_PORTRAIT.includes(slug) ? undefined : `/artists/${slug}/thumb.jpg`;
}
