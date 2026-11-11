import type { ArtistSlug } from "@/lib/artworks";

/**
 * 작가 인스타그램 아이디. 관리자 화면(/admin/submissions)의 "인스타" 버튼에만 쓴다.
 * 작품·작가 페이지에는 넣지 않는다 — 구매자가 인스타 DM으로 바로 거래하면
 * 연결 기록이 남지 않아 10% 수수료 모델이 흔들린다(2026-09-25 사용자 결정).
 *
 * 출처: 작가 참여 신청서(poteart.gallery@gmail.com)의 "인스타그램" 칸, 후후는
 * 작가가 보낸 인스타 스크린샷(handoff-archive). 비어 있으면 버튼이 꺼진다.
 */
export const artistInstagram: Partial<Record<ArtistSlug, string>> = {
  // 밑줄 6개. 4개짜리(hoohoo____)는 다른 사람 계정이다(2026-09-25 인스타에서 확인).
  hoohoo: "hoohoo______",
  haerang: "hanjicoll2017",
  hedon139: "hedonhideul139",
  kyunghoonmin: "m.kyunghoon",
  seunghojang: "jangseungho_art",
  eunyeollee: "leeunyeoul",
  luxx: "luxx_young",
  myungheejung: "artistjung23",
  // 신청서 두 통에 @j42581, @42581이 각각 적혀 있었다. j42581이 "율휘 | 왕관그리는 화가" 계정으로 확인됨(42581은 없는 계정).
  yulhwi: "j42581",
  jihyeseung: "bbottone_art", // 2026-09-25 사용자 제공
  // 신청서에는 전화번호만 있었다. 2026-09-27 사용자가 준 주소, 인스타에서 "심청운(@a01056432533)" 계정 확인.
  cheongunsim: "a01056432533",
  // 신청서에는 @__emoi(밑줄 2개)였지만 그건 다른 사람 계정. 실제는 밑줄 4개 "L.pitta | 피타"(2026-09-25 사용자 확인).
  pita: "____emoi",
  // 신청서 @yangwoonchul, 포트폴리오 PDF 마지막 쪽에도 같은 주소(2026-09-29).
  woon: "yangwoonchul",
  // 신청서 프로필 카드 주소 instagram.com/qiuchi.chen (2026-09-29).
  qiuchichen: "qiuchi.chen",
  // 2026-10-02 참여 신청서에 작가가 기재한 계정. 공개 프로필 조회는 접근 제한으로 미확인.
  jaeheeyoon: "jh90100_art",
  // 2026-10-06 참여 신청서 본인 기재. 관리자 화면에서만 사용한다.
  sunsookhur: "sunsook_hur",
};

export function instagramUrl(handle: string) {
  return `https://www.instagram.com/${handle.replace(/^@/, "")}/`;
}
