/**
 * 한국 표준 캔버스 호수(號數). 작가들은 크기를 "10호", "20호 P"처럼 말하는 경우가
 * 많아서, 포털에서는 호수를 고르면 cm가 채워지고 작품 페이지에서는 cm 옆에
 * 호수를 같이 보여준다. 저장은 늘 cm로 한다(공간 미리보기·크기 필터가 cm를 읽는다).
 *
 * 값은 화방에서 널리 쓰는 표준표(긴 변 × 짧은 변, cm)다. 제조사마다 몇 mm씩
 * 다를 수 있어서, cm → 호수 역변환은 양쪽 변이 0.6cm 안으로 맞을 때만 한다.
 * F 인물형, P 풍경형, M 해경형(가장 길쭉함), S 정사각형(F의 긴 변 × 긴 변).
 */

export type CanvasShape = "F" | "P" | "M" | "S";

export const CANVAS_SHAPES: CanvasShape[] = ["F", "P", "M", "S"];

// 호수: [긴 변, F 짧은 변, P 짧은 변, M 짧은 변]
const TABLE: [number, number, number, number, number][] = [
  [1, 22.7, 15.8, 14.0, 12.0],
  [2, 25.8, 17.9, 16.0, 14.0],
  [3, 27.3, 22.0, 19.0, 16.0],
  [4, 33.4, 24.2, 21.2, 19.0],
  [5, 34.8, 27.3, 24.2, 21.2],
  [6, 40.9, 31.8, 27.3, 24.2],
  [8, 45.5, 37.9, 33.4, 27.3],
  [10, 53.0, 45.5, 40.9, 33.4],
  [12, 60.6, 50.0, 45.5, 40.9],
  [15, 65.1, 53.0, 50.0, 45.5],
  [20, 72.7, 60.6, 53.0, 50.0],
  [25, 80.3, 65.1, 60.6, 53.0],
  [30, 90.9, 72.7, 65.1, 60.6],
  [40, 100.0, 80.3, 72.7, 65.1],
  [50, 116.8, 91.0, 80.3, 72.7],
  [60, 130.3, 97.0, 89.4, 80.3],
  [80, 145.5, 112.1, 97.0, 89.4],
  [100, 162.2, 130.3, 112.1, 97.0],
  [120, 193.9, 130.3, 112.1, 97.0],
];

export const CANVAS_HO: number[] = TABLE.map(([ho]) => ho);

/** 호수·형의 [긴 변, 짧은 변] cm. 표에 없으면 null. */
export function canvasSizeCm(ho: number, shape: CanvasShape): [number, number] | null {
  const row = TABLE.find(([value]) => value === ho);
  if (!row) return null;
  const [, long, f, p, m] = row;
  const short = { F: f, P: p, M: m, S: long }[shape];
  return [long, short];
}

const TOLERANCE_CM = 0.6;

/** 가로·세로 cm가 표준 호수와 맞으면 "10호" / "12호 M"처럼 돌려준다. F는 글자를 붙이지 않는다. */
export function canvasHoLabel(widthCm: number, heightCm: number): string | null {
  const long = Math.max(widthCm, heightCm);
  const short = Math.min(widthCm, heightCm);
  for (const [ho] of TABLE) {
    for (const shape of CANVAS_SHAPES) {
      const size = canvasSizeCm(ho, shape);
      if (size && Math.abs(size[0] - long) <= TOLERANCE_CM && Math.abs(size[1] - short) <= TOLERANCE_CM) {
        return shape === "F" ? `${ho}호` : `${ho}호 ${shape}`;
      }
    }
  }
  return null;
}

/**
 * "캔버스에 유채 · 53 × 45.5cm · 2026" → "캔버스에 유채 · 53 × 45.5cm (10호) · 2026".
 * 표준 호수와 맞지 않거나 깊이까지 있는 입체 크기("30 × 40 × 5cm")면 그대로 돌려준다.
 */
export function detailsWithHo(details: string): string {
  return details.replace(/(?<![\d.]|[×x]\s*)(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*cm(?!\s*\()/, (match, w: string, h: string) => {
    const label = canvasHoLabel(Number(w), Number(h));
    return label ? `${match} (${label})` : match;
  });
}
