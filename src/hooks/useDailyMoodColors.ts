"use client";

import { useMemo } from "react";
import { useKoreanToday } from "@/hooks/useKoreanToday";
import type { MoodKey } from "@/lib/artworks";

/**
 * A different colour on the selected mood each day — but always a colour that
 * belongs to that mood.
 *
 * The first version dealt from one flat pool of eight without replacement, and
 * the pool was six browns and two greens: whichever mood you picked, you got
 * another brown, and clicking 고요한 → 따뜻한 → 선명한 barely changed the
 * chip. Only one chip is lit at a time, so "different from each other" is
 * something you experience by clicking between them, and the deal was
 * defeating it.
 *
 * So each mood owns a hue and the day picks the shade. 고요한 is cool, 따뜻한
 * is amber, 선명한 is red, 섬세한 is plum, and 모든 작품 — the unfiltered
 * state — is the site's own forest, which is also what keeps the warm family
 * free for the mood that is actually named 따뜻한. The families sit far enough
 * apart in hue that the change is unmistakable, and every shade is dark enough
 * to carry the cream label: measured against #fdeddd the fifteen run 4.55:1
 * (#a8562a) to 8.74:1 (#35463e), all above AA.
 *
 * Applied after mount, like the daily artwork order: these pages are
 * prerendered, so the build's idea of "today" is not the reader's, and
 * colouring during render would hydrate one day's accent onto another day's
 * markup.
 */
const FAMILIES: Record<MoodKey | "all", readonly string[]> = {
  // Deep forest — the site's own ground, for the state that filters nothing.
  all: ["#35463e", "#2f4a3f", "#3b4a41"],
  // Petrol, slate blue, deep teal.
  quiet: ["#2f5f63", "#35566b", "#3f6459"],
  // The house warm: burgundy, brick, amber bronze.
  warm: ["#985216", "#a8562a", "#8f5a20"],
  // Carmine, claret, red earth.
  vivid: ["#9c2b33", "#8f2f3a", "#a5303a"],
  // Plum, mauve, violet.
  delicate: ["#5b3a5e", "#6b3f55", "#56405f"],
};

const MOODS: (MoodKey | "all")[] = ["all", "quiet", "warm", "vivid", "delicate"];

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useDailyMoodColors(): Partial<Record<MoodKey | "all", string>> {
  const today = useKoreanToday("");
  return useMemo(() => {
    if (!today) return {};
    const random = seeded(Number(today.replaceAll("-", "")));
    const next: Partial<Record<MoodKey | "all", string>> = {};
    // One draw per family rather than one deal across all of them: a mood may
    // never borrow another mood's hue, which is the whole point.
    for (const mood of MOODS) {
      const family = FAMILIES[mood];
      next[mood] = family[Math.floor(random() * family.length)];
    }
    return next;
  }, [today]);
}
