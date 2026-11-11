/**
 * Korean-mode labels stay Korean: artists often type colour names and
 * materials as loanwords or English ("화이트", "Acrylic on canvas") into the
 * Korean fields. The English side already has its own fields, so KO shows
 * 흰색 / 캔버스에 아크릴 and EN keeps White / Acrylic on canvas.
 *
 * Applied when a portal submission is saved and again when approved rows are
 * read, so rows stored before this existed are covered too.
 */

const COLOR_KO: Record<string, string> = {
  화이트: "흰색", 핑크: "분홍", 블랙: "검정", 블루: "파랑", 퍼플: "보라", 레드: "빨강",
  그레이: "회색", 옐로: "노랑", 옐로우: "노랑", 그린: "초록", 오렌지: "주황", 브라운: "갈색",
  네이비: "남색", 골드: "금색", 실버: "은색", 오커: "황토색", 바이올렛: "보라", 코랄: "산호색",
  아이보리: "상아색", 베이지: "연갈색", 크림: "미색", 라벤더: "연보라", 버건디: "검붉은색",
  민트: "옥색", 올리브: "황록색", 세이지그린: "회녹색", 스카이블루: "하늘색", 틸: "청록",
  white: "흰색", pink: "분홍", black: "검정", blue: "파랑", purple: "보라", red: "빨강",
  gray: "회색", grey: "회색", yellow: "노랑", green: "초록", orange: "주황", brown: "갈색",
  navy: "남색", gold: "금색", silver: "은색", ochre: "황토색", ocher: "황토색", violet: "보라",
  coral: "산호색", ivory: "상아색", beige: "연갈색", cream: "미색", lavender: "연보라",
  burgundy: "검붉은색", mint: "옥색", olive: "황록색", teal: "청록", "sky blue": "하늘색",
};

export function koreanizeColor(name: string): string {
  const key = name.trim();
  return COLOR_KO[key] ?? COLOR_KO[key.toLowerCase()] ?? key;
}

/** Maps each colour and drops duplicates the mapping creates (화이트 + 흰색 → 흰색). */
export function koreanizePalette(names: string[]): string[] {
  return [...new Set(names.map(koreanizeColor).filter(Boolean))];
}

/** Same, for the portal's comma-separated text field. */
export function koreanizePaletteText(value: string): string {
  let parts = value.split(/[,·、]/).map((item) => item.trim()).filter(Boolean);
  // "레드 옐로 그린 화이트" typed without commas: split on spaces, but only
  // when every word is a colour we know (so "짙은 파랑" stays one colour).
  if (parts.length === 1) {
    const words = parts[0].split(/\s+/);
    if (words.length > 1 && words.every((word) => koreanizeColor(word) !== word || Object.values(COLOR_KO).includes(word))) parts = words;
  }
  return koreanizePalette(parts).join(", ");
}

const MEDIUM_KO: Record<string, string> = {
  acrylic: "아크릴", oil: "오일", "mixed media": "혼합재료", watercolor: "수채", watercolour: "수채",
  "oil pastel": "오일파스텔", ink: "잉크", gouache: "과슈", pencil: "연필", charcoal: "목탄",
};
const SURFACE_KO: Record<string, string> = {
  canvas: "캔버스", panel: "패널", pannal: "패널", paper: "종이", wood: "나무", board: "보드", linen: "린넨",
};
const MATERIAL_RE = /^(mixed media|oil pastel|acrylic|oil|watercolou?r|ink|gouache|pencil|charcoal)\s+on\s+(canvas|panel|pannal|paper|wood|board|linen)/i;
// The medium alone, with no surface ("Acrylic · 50 × 50cm · 2019"): eleven of
// 민경훈's works were entered this way and showed English on the Korean page.
const BARE_MEDIUM_RE = /^(mixed media|oil pastel|acrylic|oil|watercolou?r|ink|gouache|pencil|charcoal)(?=\s*(?:[·,]|$))/i;

const PRINT_KO: Record<string, string> = { pigment: "피그먼트", giclee: "지클레", giclée: "지클레", "fine art": "파인아트" };
const PRINT_RE = /^(pigment|gicl[eé]e|fine art)\s+print/i;

/** "Acrylic on panel, 56x67cm" → "패널에 아크릴, 56x67cm"; "Acrylic · 50 × 50cm" → "아크릴 · 50 × 50cm"; "Pigment Print" → "피그먼트 프린트". Anything else is left as written. */
export function koreanizeDetails(details: string): string {
  return details
    .replace(MATERIAL_RE, (_, medium: string, surface: string) =>
      `${SURFACE_KO[surface.toLowerCase()]}에 ${MEDIUM_KO[medium.toLowerCase()]}`)
    .replace(BARE_MEDIUM_RE, (medium: string) => MEDIUM_KO[medium.toLowerCase()])
    .replace(PRINT_RE, (_, kind: string) => `${PRINT_KO[kind.toLowerCase()]} 프린트`);
}

/**
 * Korean colour names the catalog already uses, each with its English label —
 * the only names the automatic reviewer (src/lib/artwork-review.ts) may pick
 * when it fills in a blank "주요 색".
 */
export const KNOWN_COLORS: { ko: string; en: string }[] = (() => {
  const seen = new Map<string, string>();
  for (const [key, ko] of Object.entries(COLOR_KO)) {
    if (!/^[a-z ]+$/.test(key) || seen.has(ko)) continue;
    seen.set(ko, key.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return [...seen].map(([ko, en]) => ({ ko, en }));
})();
