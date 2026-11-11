import type { Artwork, MoodKey } from "./artworks";
import { artworkSizeCm } from "./catalog";

/**
 * "색으로 찾기" and "어디에 걸까요" — the two browse axes added next to the
 * four moods (2026-09-25). Neither needs anyone to tag anything: colour reads
 * the 주요 색 every work already carries, and room is worked out from size
 * and mood. That is the point — a new portal submission shows up under both
 * the moment it is approved.
 */

export type ColorFamily = "blue" | "red" | "pink" | "yellow" | "orange" | "green" | "purple" | "brown" | "white" | "black";

// Order is the order the swatches appear in. `swatch` is only the dot's fill.
// `match` is tested against each Korean palette name, the source of truth
// (portal input is normalised to Korean by korean-labels.ts). A name can land
// in two families (청록 is both blue and green) — a teal work should turn up
// whichever of the two the visitor picks.
export const COLOR_FAMILIES: { key: ColorFamily; swatch: string; label: Record<"ko" | "en", string>; match: RegExp }[] = [
  { key: "blue", swatch: "#2f5f9e", label: { ko: "파랑", en: "Blue" }, match: /파랑|청색|남색|남청|하늘|청록|푸른|코발트|군청/ },
  { key: "green", swatch: "#4f7a4a", label: { ko: "초록", en: "Green" }, match: /초록|녹색|연두|청록|옥색|회녹|황록|올리브|민트/ },
  { key: "yellow", swatch: "#e2b43f", label: { ko: "노랑·금색", en: "Yellow & gold" }, match: /노랑|노란|금색|겨자|레몬/ },
  { key: "orange", swatch: "#d9772b", label: { ko: "주황", en: "Orange" }, match: /주황|주홍|귤|테라코타/ },
  { key: "red", swatch: "#b8322e", label: { ko: "빨강", en: "Red" }, match: /빨강|빨간|붉은|검붉|석류|진홍|다홍|버건디/ },
  { key: "pink", swatch: "#e39ab0", label: { ko: "분홍", en: "Pink" }, match: /분홍|자홍|산호|핑크/ },
  { key: "purple", swatch: "#7b5aa6", label: { ko: "보라", en: "Purple" }, match: /보라|자주|라벤더|자색/ },
  { key: "brown", swatch: "#9a6a3e", label: { ko: "갈색·황토", en: "Brown & ochre" }, match: /갈색|황토|적갈|밤색|고동|베이지/ },
  { key: "white", swatch: "#efe8da", label: { ko: "흰색·미색", en: "White & cream" }, match: /흰색|하얀|미색|상아|진주|은색|아이보리/ },
  { key: "black", swatch: "#1b1b1b", label: { ko: "검정·회색", en: "Black & grey" }, match: /검정|검은|먹색|회색|은회/ },
];

export function artworkColorFamilies(artwork: Artwork): Set<ColorFamily> {
  const families = new Set<ColorFamily>();
  for (const name of artwork.ko.palette) {
    for (const family of COLOR_FAMILIES) if (family.match.test(name)) families.add(family.key);
  }
  return families;
}

export type RoomKey = "living" | "bedroom" | "study" | "entrance" | "shop";

// A suggestion, not a rule — the wall preview on each work is where a buyer
// actually checks the fit. Every work goes to exactly one room: the first
// version let a work fit several, so 거실 and 가게·카페 opened on the same
// dozen works in the same order and switching chips looked like nothing
// happened (2026-09-25). Size decides first (longer side, cm), then mood
// splits the middle band. A work whose size can't be read goes by mood alone.
export function roomOf(artwork: Artwork): RoomKey {
  const size = artworkSizeCm(artwork.ko.details);
  if (size !== null && size <= 35) return "entrance";
  if (size !== null && size > 80) return "living";
  const byMood: Record<MoodKey, RoomKey> = { vivid: "shop", quiet: "study", warm: "bedroom", delicate: "bedroom" };
  return byMood[artwork.moodKey];
}

export const ROOMS: { key: RoomKey; label: Record<"ko" | "en", string> }[] = [
  { key: "living", label: { ko: "거실", en: "Living room" } },
  { key: "bedroom", label: { ko: "침실", en: "Bedroom" } },
  { key: "study", label: { ko: "서재·작업실", en: "Study" } },
  { key: "entrance", label: { ko: "현관·복도", en: "Hallway" } },
  { key: "shop", label: { ko: "가게·카페", en: "Shop or café" } },
];

export function fitsRoom(artwork: Artwork, room: RoomKey): boolean {
  return roomOf(artwork) === room;
}

export function isColorFamily(value: string | null): value is ColorFamily {
  return COLOR_FAMILIES.some((family) => family.key === value);
}

export function isRoomKey(value: string | null): value is RoomKey {
  return ROOMS.some((room) => room.key === value);
}
