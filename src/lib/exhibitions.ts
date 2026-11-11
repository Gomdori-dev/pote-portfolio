import type { MoodKey } from "@/lib/artworks";
import { getKoreanDate } from "./korean-date";
import { cleanExhibitionText, summarizeExhibitionText } from "./exhibition-text";
import exhibitionSnapshot from "../../public/data/exhibitions.json";

export type Exhibition = {
  id: string;
  title: string;
  institution: string;
  genre: string;
  startDate: string;
  endDate: string;
  location: string;
  fee: string;
  bookingUrl?: string;
  description: string;
  /** Public-data institutions only. Ground Seesaw's posters are deliberately
   *  not collected — see the note atop scripts/scrape-groundseesaw.mjs. */
  image?: string;
};

export type ExhibitionWithMood = Exhibition & { moodKeys: MoodKey[] };

export type RegionKey = "seoul" | "gyeonggi" | "gangwon" | "chungcheong" | "jeolla" | "gyeongsang" | "jeju" | "overseas";

/**
 * The API's own `location`(EVENT_SITE) field is venue-specific ("복합전시 1관",
 * "3층 기획전시실"), not a clean region — but it does often include a real
 * city/province name for exhibitions that move between an institution's
 * branches (e.g. 국립현대미술관's 서울/과천/덕수궁/청주 sites). Where it doesn't,
 * fall back to each institution's real, publicly known host city — every name
 * below is a real government/national institution already present in the
 * collected data, not a guess.
 */
const LOCATION_REGION_KEYWORDS: [string, RegionKey][] = [
  ["과천", "gyeonggi"],
  ["청주", "chungcheong"],
  ["공주", "chungcheong"],
  ["부여", "chungcheong"],
  ["세종", "chungcheong"],
  ["경주", "gyeongsang"],
  ["진주", "gyeongsang"],
  ["김해", "gyeongsang"],
  ["대구", "gyeongsang"],
  ["춘천", "gangwon"],
  ["강원", "gangwon"],
  ["익산", "jeolla"],
  ["광주", "jeolla"],
  ["전주", "jeolla"],
  ["제주", "jeju"],
  // Province abbreviations. The culture-portal feed writes the region as
  // "충북 청주시" / "전남 나주시", and without these the whole province fell
  // through to the institution table and then to the 서울 default — 38 live
  // exhibitions were being filed in the wrong region.
  ["충북", "chungcheong"],
  ["충남", "chungcheong"],
  ["전북", "jeolla"],
  ["전남", "jeolla"],
  ["경북", "gyeongsang"],
  ["경남", "gyeongsang"],
  ["경기", "gyeonggi"],
  ["인천", "gyeonggi"],
  ["부산", "gyeongsang"],
  ["울산", "gyeongsang"],
  ["대전", "chungcheong"],
  ["서울", "seoul"],
  ["덕수궁", "seoul"],
  ["중국", "overseas"],
  ["상하이", "overseas"],
  ["일본", "overseas"],
  ["미국", "overseas"],
];

const INSTITUTION_REGION: Record<string, RegionKey> = {
  국립현대미술관: "seoul",
  국립경주박물관: "gyeongsang",
  국립아시아문화전당: "jeolla",
  한국예술종합학교: "seoul",
  국립중앙박물관: "seoul",
  대한민국역사박물관: "seoul",
  국립공주박물관: "chungcheong",
  국립춘천박물관: "gangwon",
  국립진주박물관: "gyeongsang",
  국립김해박물관: "gyeongsang",
  국립어린이청소년도서관: "chungcheong",
  국립익산박물관: "jeolla",
  국립광주박물관: "jeolla",
  국립박물관문화재단: "seoul",
  국립제주박물관: "jeju",
  국립대구박물관: "gyeongsang",
  국립한글박물관: "seoul",
  한국영상자료원: "seoul",
  예술의전당: "seoul",
  국립부여박물관: "chungcheong",
  국립청주박물관: "chungcheong",
};

export function getExhibitionRegion(exhibition: Pick<Exhibition, "location" | "institution">): RegionKey {
  for (const [keyword, region] of LOCATION_REGION_KEYWORDS) {
    if (exhibition.location?.includes(keyword)) return region;
  }
  return INSTITUTION_REGION[exhibition.institution] ?? "seoul";
}

/**
 * The real API (문화체육관광부_12개 기관 전시정보) has no mood/vibe field —
 * only free-text genre and description. This is a heuristic keyword match,
 * not a verified classification, so recommendations should always be framed
 * to the user as approximate ("~한 분위기에 가까워요"), never as fact.
 */
const MOOD_KEYWORDS: Record<MoodKey, string[]> = {
  quiet: ["사진", "흑백", "여백", "명상", "고요", "미니멀", "수묵", "먹"],
  warm: ["온기", "따뜻", "가족", "일상", "공예", "도자", "자연", "손"],
  vivid: ["팝아트", "원색", "미디어아트", "설치", "강렬", "네온", "그래피티"],
  delicate: ["세밀", "자수", "섬세", "정밀", "드로잉", "판화", "세공"],
};

export function classifyMood(exhibition: Pick<Exhibition, "genre" | "title" | "description">): MoodKey[] {
  const haystack = `${exhibition.genre} ${exhibition.title} ${exhibition.description}`;
  const matches = (Object.keys(MOOD_KEYWORDS) as MoodKey[]).filter((mood) =>
    MOOD_KEYWORDS[mood].some((keyword) => haystack.includes(keyword)),
  );
  return matches.length > 0 ? matches : ["quiet"];
}

/**
 * Local placeholder data ONLY — deliberately generic names, not real
 * institutions or real running exhibitions. Used to build and test the
 * recommendation UI before the data.go.kr API key is connected. Must not
 * be shown as if it were real, confirmed exhibition information.
 */
export const SAMPLE_EXHIBITIONS: Exhibition[] = [
  {
    id: "sample-1",
    title: "샘플 전시 · 고요한 순간들",
    institution: "샘플 미술관",
    genre: "사진, 미니멀",
    startDate: "2026-09-01",
    endDate: "2026-10-31",
    location: "서울",
    fee: "무료",
    description: "흑백 사진과 여백을 중심으로 한 고요한 분위기의 전시(샘플 데이터).",
  },
  {
    id: "sample-2",
    title: "샘플 전시 · 손끝의 온기",
    institution: "샘플 공예관",
    genre: "공예, 도자",
    startDate: "2026-09-10",
    endDate: "2026-11-15",
    location: "경기",
    fee: "5,000원",
    description: "도자와 손으로 빚은 공예품을 통해 온기를 전하는 전시(샘플 데이터).",
  },
  {
    id: "sample-3",
    title: "샘플 전시 · 원색의 물결",
    institution: "샘플 현대미술관",
    genre: "팝아트, 설치미술",
    startDate: "2026-08-20",
    endDate: "2026-09-30",
    location: "서울",
    fee: "12,000원",
    description: "강렬한 원색과 대형 설치 작품으로 채운 팝아트 전시(샘플 데이터).",
  },
  {
    id: "sample-4",
    title: "샘플 전시 · 세밀한 손길",
    institution: "샘플 판화미술관",
    genre: "판화, 드로잉",
    startDate: "2026-09-05",
    endDate: "2026-10-05",
    location: "인천",
    fee: "8,000원",
    description: "세밀한 드로잉과 판화 작업을 조명하는 전시(샘플 데이터).",
  },
];

/** 원본 API에 동일 전시가 기관별로 중복 수집된 경우가 있어 제목+기관 기준으로 한 번만 남긴다. */
export function dedupeExhibitions(source: Exhibition[]): Exhibition[] {
  const seen = new Set<string>();
  return source.filter((exhibition) => {
    const key = `${exhibition.title}__${exhibition.institution}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function recommendExhibitions(mood: MoodKey, source: Exhibition[] = SAMPLE_EXHIBITIONS, todayIso = getKoreanDate()): ExhibitionWithMood[] {
  return dedupeExhibitions(source)
    .filter((exhibition) => isOngoing(exhibition, todayIso) || isUpcoming(exhibition, todayIso))
    .map((exhibition) => ({ ...exhibition, moodKeys: classifyMood(exhibition) }))
    .filter((exhibition) => exhibition.moodKeys.includes(mood));
}

/** startDate/endDate는 "YYYY-MM-DD" 형식이라 오늘 날짜 문자열과 사전식 비교가 가능하다. */
export function isOngoing(exhibition: Pick<Exhibition, "startDate" | "endDate">, todayIso: string): boolean {
  return !!exhibition.startDate && exhibition.startDate <= todayIso && (!exhibition.endDate || exhibition.endDate >= todayIso);
}

export function isUpcoming(exhibition: Pick<Exhibition, "startDate" | "endDate">, todayIso: string): boolean {
  return !!exhibition.startDate && exhibition.startDate > todayIso && (!exhibition.endDate || exhibition.endDate >= exhibition.startDate);
}

/**
 * 빌드 날짜에 진행 중도 예정도 아닌 전시(이미 끝난 것)는 날짜가 지나도 다시
 * 보일 일이 없으므로 클라이언트로 보내지 않는다. 10/31 스냅샷 470건 중 118건.
 */
export function visibleExhibitions(source: Exhibition[], todayIso: string): Exhibition[] {
  return source.filter((exhibition) => isOngoing(exhibition, todayIso) || isUpcoming(exhibition, todayIso));
}

type ExhibitionSnapshot = {
  updatedAt: string;
  items: Exhibition[];
};

/**
 * The generated snapshot is refreshed on the user's Korean-network PC before
 * deployment. This keeps the Vercel build independent from KCISA DNS while
 * keeping the public pages fully static and fast.
 */
export function getSnapshotExhibitions(): Exhibition[] {
  const snapshot = exhibitionSnapshot as ExhibitionSnapshot;
  if (!Array.isArray(snapshot.items)) return [];
  // 원문 HTML 표식·엔티티를 걷어내고, 설명은 카드에 보이는 만큼만 넘긴다.
  // 9,000자 넘는 원문이 그대로 클라이언트로 가던 것도 함께 줄어든다.
  // 카드는 12px 3줄(한글 약 80자)에서 잘리므로 100자면 충분하다(10/31, 160자에서 축소).
  return snapshot.items.map((item) => ({
    ...item,
    title: cleanExhibitionText(item.title),
    institution: cleanExhibitionText(item.institution),
    genre: cleanExhibitionText(item.genre),
    location: cleanExhibitionText(item.location),
    fee: cleanExhibitionText(item.fee),
    description: summarizeExhibitionText(cleanExhibitionText(item.description), 100),
  }));
}
