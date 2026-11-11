/**
 * 전시 원문 정제(2026-09-28 고객 임장 P0). KCISA 등 외부 피드의 제목·설명에
 * `<!-- wp:paragraph -->` 같은 워드프레스 표식, `<p>` 태그, `&middot;` 엔티티가
 * 그대로 남아 카드에 보였다. 수집 스크립트가 걸러도 새 피드·병합 경로에서
 * 다시 샐 수 있어, 화면에 내보내기 직전에 한 번 더 정리한다.
 *
 * `<미틸라 회화>`처럼 한국어 제목을 꺾쇠로 감싼 표기는 실제 내용이라 지우지
 * 않는다 — 영문자·`/`·`!`로 시작하는 진짜 태그만 제거한다.
 */
const NAMED: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  mdash: "—", ndash: "–", middot: "·", times: "×", hellip: "…", bull: "•", laquo: "«", raquo: "»",
  eacute: "é", egrave: "è", ccedil: "ç", agrave: "à", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ouml: "ö", uuml: "ü",
};

function decodeOnce(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => safeCodePoint(parseInt(hex, 16)) ?? match)
    .replace(/&#(\d+);/g, (match, dec: string) => safeCodePoint(Number(dec)) ?? match)
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      if (name in NAMED) return NAMED[name];
      const lower = name.toLowerCase();
      // 대문자 엔티티(&Iacute;)는 소문자 짝을 찾아 대문자로 돌린다.
      return lower in NAMED && name !== lower ? NAMED[lower].toUpperCase() : match;
    });
}

function safeCodePoint(code: number): string | null {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

export function cleanExhibitionText(value: string | undefined): string {
  if (!value) return "";
  // 두 번 푸는 이유: "&amp;middot;"처럼 이중으로 감싼 엔티티가 실제로 있다.
  const decoded = decodeOnce(decodeOnce(value));
  return decoded
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 카드용 요약: 문장 끝에서 자르고, 문장이 너무 길면 말줄임표를 붙인다. */
export function summarizeExhibitionText(text: string, max = 160): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  let cut = -1;
  for (const match of head.matchAll(/[.!?。](?=\s)/g)) cut = match.index;
  return cut >= max * 0.45 ? head.slice(0, cut + 1).trim() : `${head.replace(/\s+\S*$/, "").trim()}…`;
}
