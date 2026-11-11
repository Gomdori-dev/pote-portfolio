import type { Artwork, ArtistSlug } from "./artists";

/**
 * `artworks` is declared one artist at a time, so browsing it in that raw
 * order clumps every artist's works together — burying whoever comes later
 * in the file (see PRODUCT_BRIEF.md: "신규 작가가 인기 순위에 묻히지 않도록
 * 탐색 노출을 보장한다"). This round-robins across artists (in registry
 * order, preserving each artist's own internal ordering) so browsing pages
 * naturally mix artists instead of showing them in solid blocks.
 */
/** Deterministic PRNG, so the same day produces the same order everywhere. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The Korean calendar date as a number — the seed changes at midnight KST. */
export function koreanDaySeed(now: Date = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCFullYear() * 10000 + (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Round-robin across artists, so no artist is buried behind another's whole
 * body of work (PRODUCT_BRIEF.md: "신규 작가가 인기 순위에 묻히지 않도록 탐색
 * 노출을 보장한다"). With a seed, each artist's own works are shuffled and the
 * artists take turns in a different order — the browsing order changes daily
 * without ever letting one artist take the top of the page.
 *
 * A plain shuffle of everything would have been simpler and would have broken
 * that guarantee: on any given day it can deal one artist the first six slots.
 */
function roundRobinByArtist(works: Artwork[], random?: () => number): Artwork[] {
  const queues = new Map<ArtistSlug, Artwork[]>();
  for (const artwork of works) {
    const queue = queues.get(artwork.artistSlug);
    if (queue) queue.push(artwork); else queues.set(artwork.artistSlug, [artwork]);
  }
  let order = [...queues.values()];
  if (random) order = shuffled(order.map((queue) => shuffled(queue, random)), random);
  const mixed: Artwork[] = [];
  for (let i = 0; mixed.length < works.length; i++) {
    const queue = order[i % order.length];
    if (queue.length) mixed.push(queue.shift()!);
  }
  return mixed;
}

/**
 * `seed` omitted gives the fixed order the server renders; pass
 * `koreanDaySeed()` on the client for the day's shuffle. Keeping the two apart
 * is deliberate: these pages are prerendered, so the build's idea of "today"
 * is not the reader's, and computing the shuffle during render would hydrate
 * against a different day's order.
 *
 * Callers supply the server-loaded catalog, including approved submissions.
 */
export function orderedArtworks(seed: number | undefined, source: Artwork[]): Artwork[] {
  const random = seed === undefined ? undefined : seededRandom(seed);
  return roundRobinByArtist(source.filter((artwork) => artwork.statusKey === "available"), random);
}

/**
 * Browsing shows work that can actually be bought. Sold pieces used to trail
 * the same grid, which meant a visitor scrolling the gallery kept meeting
 * paintings they could not have — and the very first piece in it was one.
 * They are not deleted: they are an artist's record and the evidence that work
 * here sells, and they keep their own page, their place on the artist's page
 * and in anyone's favourites. They are gathered at /artworks/sold instead.
 *
 * Pass the merged `getAllArtworks()` list to include approved DB submissions.
 */
export function soldArtworksFrom(source: Artwork[]): Artwork[] {
  return roundRobinByArtist(source.filter((artwork) => artwork.statusKey !== "available"));
}
