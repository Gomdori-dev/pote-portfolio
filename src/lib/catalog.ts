import type { Artwork } from "./artworks";
import type { Lang } from "./i18n";

// A half-open (min, max] range, except the first bucket in a list which
// also includes 0 — so every boundary value belongs to exactly one bucket
// (e.g. exactly 1,000,000 falls in "~1,000,000", not the next range up).
export type RangeBucket = { min: number; max: number | null };

// Preset range options for the price/size selects — a single source of
// truth so the homepage's lightweight filters and the full catalog page's
// filters always offer the same choices. Boundaries are picked from the
// actual catalog's spread (42 works, 400,000~30,000,000원 / 40~193cm) so
// each bucket holds a reasonable, non-empty slice rather than round numbers
// picked blind.
// 2026-09-23: the old single "~1,000,000" bucket held 69 of 120 works (57%),
// so it barely filtered anything; it is split at 500,000 — the band where
// first-time 20s–30s buyers mostly buy (docs/market-research-2026-09.md).
export const PRICE_BUCKETS: RangeBucket[] = [
  { min: 0, max: 500_000 },
  { min: 500_000, max: 1_000_000 },
  { min: 1_000_000, max: 3_000_000 },
  { min: 3_000_000, max: 10_000_000 },
  { min: 10_000_000, max: null },
];
export const SIZE_BUCKETS_CM: RangeBucket[] = [
  { min: 0, max: 60 },
  { min: 60, max: 100 },
  { min: 100, max: 150 },
  { min: 150, max: null },
];

export function inRangeBucket(value: number, bucket: RangeBucket): boolean {
  return value > bucket.min && (bucket.max === null || value <= bucket.max);
}

// "~1,000,000" / "1,000,000~3,000,000" / "10,000,000~" — numeric ranges
// read the same way in every language, so no per-locale bucket copy is
// needed beyond the currency formatting itself.
export const CURRENCY_BY_LANG: Record<Lang, string> = {
  ko: "KRW", en: "USD",
};

export const FALLBACK_RATES_FROM_KRW: Record<string, number> = {
  KRW: 1, USD: 0.00073,
};

export function formatLocalizedPrice(valueKrw: number, lang: Lang, rates: Record<string, number> = FALLBACK_RATES_FROM_KRW): string {
  const currency = CURRENCY_BY_LANG[lang];
  const converted = valueKrw * (rates[currency] ?? FALLBACK_RATES_FROM_KRW[currency] ?? 1);
  return new Intl.NumberFormat(lang, { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 0 }).format(converted);
}

export function formatPriceBucket(bucket: RangeBucket, lang: Lang, rates?: Record<string, number>): string {
  const fmt = (value: number) => formatLocalizedPrice(value, lang, rates);
  if (bucket.min === 0) return `~${fmt(bucket.max!)}`;
  if (bucket.max === null) return `${fmt(bucket.min)}~`;
  return `${fmt(bucket.min)}~${fmt(bucket.max)}`;
}

export function formatSizeBucket(bucket: RangeBucket): string {
  if (bucket.min === 0) return `~${bucket.max}cm`;
  if (bucket.max === null) return `${bucket.min}cm~`;
  return `${bucket.min}~${bucket.max}cm`;
}

// Unknown price formats remain unknown, rather than becoming zero. The
// trailing "원" is optional: the static catalog always includes it, but the
// artist-portal price field is free text, and an artist who types just
// "600000" (skipping the "예: 400,000원" placeholder's suffix) still means a
// KRW amount, not a formatting error.
export function artworkPrice(price?: string): number | null {
  if (!price || !/^(?:\d+|\d{1,3}(?:,\d{3})+)원?$/.test(price.trim())) return null;
  const value = Number(price.replace(/[,원]/g, ""));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// `details` reads "material · A × Bcm · date" (see artworks.ts), with
// the Korean copy as the source of truth. A third number, where a work has
// one, is its depth — ignored, since only the face hangs on the wall.
// Returns null when the segment can't be parsed, rather than guessing. The
// catalogue is often height-first, so anything drawn or published should use
// artworkSizeForDisplay() (artwork-size.ts), which orients the pair by photo.
export function artworkDimensionsCm(details: string): { w: number; h: number } | null {
  const segment = details.split("·").find((part) => /cm/.test(part));
  const match = segment?.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

// The material alone, for structured data. The static catalogue and the
// current portal form write "material · size · year", but some older portal
// works hold one free-text line ("아크릴+모래+캔버스   58x48   2017",
// "캔버스에 아크릴, 48x59cm, 2014"). For those the material is only taken when
// a size pattern clearly marks where it ends; anything else returns null
// rather than passing size or year off as the material. The artist's line
// itself is shown unchanged on the page.
export function artworkMedium(details: string): string | null {
  const DIMENSIONS = /\d+(?:\.\d+)?\s*[×xX]\s*\d/;
  const parts = details.split("·");
  const first = parts[0].replace(/\s+/g, " ").trim();
  if (parts.length > 1 && !DIMENSIONS.test(first)) return first || null;
  const at = first.search(DIMENSIONS);
  const material = (at === -1 ? first : first.slice(0, at)).replace(/[\s,]+$/, "").trim();
  if (!material || /\d/.test(material)) return null;
  return material;
}

// The longer side — what actually decides whether a piece fits a given wall.
export function artworkSizeCm(details: string): number | null {
  const size = artworkDimensionsCm(details);
  return size && Math.max(size.w, size.h);
}

const CHOSUNG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

// Extracts each Hangul syllable's leading consonant ("내 마음" -> "ㄴㅁㅇ"),
// leaving anything that isn't a complete syllable (English, digits, spaces,
// jamo itself) untouched.
function toChosung(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= 0xac00 && code <= 0xd7a3 ? CHOSUNG[Math.floor((code - 0xac00) / 588)] : ch;
  }
  return out;
}

// A query made entirely of consonant jamo ("ㄴㅁㅇ") is a request to search by
// syllable-initial consonants, the shorthand Korean search boxes commonly
// support so people don't have to spell out full syllables.
function isChosungOnly(text: string): boolean {
  return text.length > 0 && [...text].every((ch) => CHOSUNG.includes(ch));
}

// `budget`/`size` select which preset bucket (an index into PRICE_BUCKETS /
// SIZE_BUCKETS_CM) to require, or null for no restriction.
export type CatalogFilters = { mood: string; artist: string; query: string; budget: number | null; size: number | null; sort: string };

export function filterCatalog(works: Artwork[], filters: CatalogFilters, lang: Lang, artistNames: Record<string, string>) {
  // Whitespace is stripped from both sides so "내마음" finds "내 마음" without
  // requiring the visitor to match the exact spacing artists happened to use.
  const rawQuery = filters.query.trim();
  const query = rawQuery.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
  const chosungQuery = isChosungOnly(rawQuery) ? rawQuery.replace(/\s+/g, "") : null;
  const budgetBucket = filters.budget !== null ? PRICE_BUCKETS[filters.budget] : null;
  const sizeBucket = filters.size !== null ? SIZE_BUCKETS_CM[filters.size] : null;
  const visible = works.filter((artwork) => {
    const copy = artwork[lang];
    const haystackRaw = [copy.title, artwork.ko.title, artwork.en.title, artistNames[artwork.artistSlug], copy.details, copy.mood, ...copy.palette].join(" ");
    const haystack = haystackRaw.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
    const matchesQuery = haystack.includes(query) || (chosungQuery !== null && toChosung(haystackRaw).replace(/\s+/g, "").includes(chosungQuery));
    const price = artworkPrice(artwork.price);
    const size = artworkSizeCm(artwork.ko.details);
    return (filters.mood === "all" || artwork.moodKey === filters.mood)
      && (filters.artist === "all" || artwork.artistSlug === filters.artist)
      && (budgetBucket === null || (price !== null && inRangeBucket(price, budgetBucket)))
      && (sizeBucket === null || (size !== null && inRangeBucket(size, sizeBucket)))
      && matchesQuery;
  });
  if (filters.sort === "price-asc" || filters.sort === "price-desc") {
    visible.sort((a, b) => {
      const left = artworkPrice(a.price);
      const right = artworkPrice(b.price);
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return filters.sort === "price-asc" ? left - right : right - left;
    });
  }
  return visible;
}
