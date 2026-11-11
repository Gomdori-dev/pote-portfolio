import type { Artwork } from "./artworks";
import { COLOR_FAMILIES, type ColorFamily } from "./discovery";

/**
 * The seasonal exhibition behind the header's "이벤트" link (2026-09-25).
 * Four a year, on the Korea Meteorological Administration's months, each
 * named after the sound of its season, with that sound as optional
 * background audio (public/audio, made by scripts/make-season-audio.py).
 * The season is worked out from today's date in Korea, and the works are
 * picked by colour, so nothing needs editing when a season turns or an
 * artist adds work.
 */
export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

export type Season = {
  key: SeasonKey;
  /** Months (1–12) the season covers, in order. */
  months: number[];
  title: Record<"ko" | "en", string>;
  label: Record<"ko" | "en", string>;
  intro: Record<"ko" | "en", string>;
  colors: ColorFamily[];
  audio: string;
  /** Every recording in the season's audio, and how it was changed. */
  credits: Credit[];
  edit: Record<"ko" | "en", string>;
};

/**
 * Wikimedia Commons recordings in public/audio (scripts/make-season-audio.py).
 * The CC BY ones must be credited with author, source, licence and a note of
 * the changes; CC0 and public-domain ones are credited too, as a courtesy.
 * Licences re-checked on Commons, 2026-09-25.
 */
export type Credit = { title: string; author: string; url: string; license: string; licenseUrl?: string };

const COMMONS = "https://commons.wikimedia.org/wiki/File:";
const CC0 = { license: "CC0 1.0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
const BY4 = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };
const BY3 = { license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/" };
const EDIT_STEPS = {
  ko: "발걸음을 하나씩 잘라 간격을 늘리고, 다른 녹음과 섞고, 음량을 조절해 64초 반복음으로 편집했습니다.",
  en: "Edited: individual footsteps cut out and re-spaced, mixed with the other recordings, level-adjusted into a 64-second loop.",
};
const EDIT_LOOP = {
  ko: "녹음 중 64초 구간을 골라 음량을 조절하고 끊김 없이 반복되도록 이었습니다.",
  en: "Edited: a 64-second section chosen, level-adjusted and joined into a seamless loop.",
};

export const SEASONS: Record<SeasonKey, Season> = {
  spring: {
    key: "spring", months: [3, 4, 5],
    title: { ko: "새들 지저귀는 소리", en: "Birdsong" },
    label: { ko: "봄 기획전", en: "Spring exhibition" },
    intro: { ko: "창문을 열어 두고 싶은 계절, 분홍과 연두, 노랑이 도는 작품을 모았습니다.", en: "Windows-open weather: works in pink, fresh green and yellow." },
    colors: ["pink", "green", "yellow"],
    audio: "/audio/season-spring.mp3",
    credits: [{ title: "20090610 0 ambience.ogg", author: "nille", url: `${COMMONS}20090610_0_ambience.ogg`, license: "Public domain" }],
    edit: EDIT_LOOP,
  },
  summer: {
    key: "summer", months: [6, 7, 8],
    title: { ko: "파도 치는 소리", en: "The Sound of Waves" },
    label: { ko: "여름 기획전", en: "Summer exhibition" },
    intro: { ko: "보기만 해도 시원해지는 파랑과 청록, 흰색의 작품을 모았습니다.", en: "Blues, teals and whites that cool a room down." },
    colors: ["blue", "white"],
    audio: "/audio/season-summer.mp3",
    credits: [{ title: "Ocean Waves on a Tropical Beach.ogg", author: "Jarrod Stanley", url: `${COMMONS}Ocean_Waves_on_a_Tropical_Beach.ogg`, ...CC0 }],
    edit: EDIT_LOOP,
  },
  autumn: {
    key: "autumn", months: [9, 10, 11],
    title: { ko: "낙엽 밟는 소리", en: "Footsteps on Fallen Leaves" },
    label: { ko: "가을 기획전", en: "Autumn exhibition" },
    intro: { ko: "주황과 갈색, 붉은 기운이 도는 작품을 모았습니다. 걷다가 멈춰 서게 되는 가을빛입니다.", en: "Works in orange, brown and red: the colours that make you stop mid-walk." },
    colors: ["orange", "brown", "red"],
    audio: "/audio/season-autumn.mp3",
    credits: [
      { title: "Walking through leaves (Gravity Sound).wav", author: "Gravity Sound", url: `${COMMONS}Walking_through_leaves_(Gravity_Sound).wav`, ...BY4 },
      { title: "Walking through leaves and sticks (Gravity Sound).wav", author: "Gravity Sound", url: `${COMMONS}Walking_through_leaves_and_sticks_(Gravity_Sound).wav`, ...BY4 },
      { title: "Leaves falling from the trees during autumn in the forest.wav", author: "Wilfredor", url: `${COMMONS}Leaves_falling_from_the_trees_during_autumn_in_the_forest.wav`, ...CC0 },
    ],
    edit: EDIT_STEPS,
  },
  winter: {
    key: "winter", months: [12, 1, 2],
    title: { ko: "눈 밟는 소리", en: "Footsteps in Snow" },
    label: { ko: "겨울 기획전", en: "Winter exhibition" },
    intro: { ko: "흰색과 회색, 깊은 남색이 도는 작품을 모았습니다. 조용히 오래 보게 되는 겨울빛입니다.", en: "Whites, greys and deep blues: quiet works for long looking." },
    colors: ["white", "black", "blue"],
    audio: "/audio/season-winter.mp3",
    credits: [
      { title: "Walking through snow.mp3", author: "Lukas Beck", url: `${COMMONS}Walking_through_snow.mp3`, ...BY4 },
      { title: "Crunchy Snow Walking Sound Effect - Human Sounds.opus", author: "Spanac (Free Sounds Library)", url: `${COMMONS}Crunchy_Snow_Walking_Sound_Effect_-_Human_Sounds.opus`, ...BY3 },
      { title: "Killiney Hill Storm Floris 20250804 1537.ogg", author: "Karlunun", url: `${COMMONS}Killiney_Hill_Storm_Floris_20250804_1537.ogg`, ...CC0 },
    ],
    edit: EDIT_STEPS,
  },
};

const ORDER: SeasonKey[] = ["winter", "spring", "summer", "autumn"];

/** Today's date in Korea as { year, month (1–12), day }. */
export function koreanDate(now = new Date()) {
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { year: korea.getUTCFullYear(), month: korea.getUTCMonth() + 1, day: korea.getUTCDate() };
}

export function seasonFor(month: number): Season {
  return SEASONS[ORDER.find((key) => SEASONS[key].months.includes(month)) ?? "autumn"];
}

/**
 * The last day of the season that contains `date`, and the days left
 * counting today (so the final day reads D-DAY, never D-0 after it ends).
 */
export function seasonEnd(date: { year: number; month: number; day: number }) {
  const season = seasonFor(date.month);
  const lastMonth = season.months[season.months.length - 1];
  const endYear = lastMonth < date.month ? date.year + 1 : date.year; // winter runs into the next year
  const lastDay = new Date(Date.UTC(endYear, lastMonth, 0)).getUTCDate();
  const today = Date.UTC(date.year, date.month - 1, date.day);
  const end = Date.UTC(endYear, lastMonth - 1, lastDay);
  return { month: lastMonth, day: lastDay, daysLeft: Math.round((end - today) / 86_400_000) };
}

/**
 * Works whose leading 주요 색 (the palette is listed most-prominent first)
 * is one of the season's colours. "Any of its colours" took in half the
 * catalogue — red or white turns up somewhere in most works — and an
 * exhibition of everything isn't one.
 */
export function seasonWorks(season: Season, works: Artwork[]): Artwork[] {
  return works.filter((artwork) => {
    const lead = artwork.ko.palette[0];
    return artwork.statusKey !== "sold" && lead !== undefined && COLOR_FAMILIES.some((family) => season.colors.includes(family.key) && family.match.test(lead));
  });
}
