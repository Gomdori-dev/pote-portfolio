const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar dates in Korea, independent of the server/browser time zone. */
export function getKoreanDate(now = new Date()): string {
  return new Date(now.getTime() + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

export function millisecondsUntilKoreanMidnight(now = new Date()): number {
  return DAY_MS - ((now.getTime() + KOREA_OFFSET_MS) % DAY_MS);
}
