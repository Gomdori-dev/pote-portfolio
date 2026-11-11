// 확대·새 탭 보기처럼 작품을 크게 보여 주는 곳은 원본 파일 대신 긴 쪽이 2048px 이하인
// 사본을 쓴다. 화면 감상에는 충분하고, 휴대폰 원본(4000px 이상)이 그대로 새지 않는다.
// 표시 사본의 가로(w)는 사진 비율로 정하고, 서버에서도 긴 쪽의 최대 크기를 제한한다.
// 원본보다 크게 늘리지는 않는다. 아래 가로 값은 모두 next.config.ts의
// deviceSizes에 있어야 하고, 85는 qualities에 있어야 한다.
export const DISPLAY_LONG_EDGE = 2048;
const DISPLAY_WIDTHS = [2048, 1536, 1365, 1200, 1080, 828, 750, 640];

/** ratio = 가로/세로. 긴 쪽이 DISPLAY_LONG_EDGE를 넘지 않는 가장 큰 허용 가로 값. */
export function displayWidth(ratio = 1) {
  const limit = DISPLAY_LONG_EDGE * Math.min(1, ratio);
  return DISPLAY_WIDTHS.find((width) => width <= limit + 1) ?? DISPLAY_WIDTHS[DISPLAY_WIDTHS.length - 1];
}

/**
 * 사진을 받기 전의 비율 짐작. 작품 크기(cm)는 가로·세로가 사진과 반대로 적힌 경우가 있어
 * 늘 "짧은 쪽/긴 쪽"으로 잡는다. 그러면 처음 받는 사본이 커지는 일은 없고, 사진이 뜬 뒤
 * 실제 비율로 한 번 키운다. 크기를 모르면 1:2로 잡는다.
 */
export function guessDisplayRatio(size: { w: number; h: number } | null) {
  return size ? Math.min(size.w, size.h) / Math.max(size.w, size.h) : 0.5;
}

export function displayImageUrl(src: string, ratio?: number) {
  return `/api/display-image?url=${encodeURIComponent(src)}&w=${displayWidth(ratio)}&q=85`;
}
