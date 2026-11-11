"use client";

import { useEffect, useState } from "react";
import { type Artwork } from "@/lib/artists";
import { koreanDaySeed, orderedArtworks } from "@/lib/artwork-order";

/**
 * The gallery in a different order each day, so a regular visitor is not met
 * by the same six pictures in the same six places every time.
 *
 * The shuffle is applied after mount rather than during render. These pages are
 * prerendered, so the HTML is built on whatever day the deploy happened, and
 * seeding the order from the reader's clock during render would hydrate one
 * day's order onto another day's markup. Starting from the server's order and
 * reordering on mount is the same shape as the homepage artist rotation.
 *
 * It re-seeds at Korean midnight for anyone who leaves the page open.
 *
 * `catalog` is the full artwork list (static + admin-approved DB submissions,
 * from `getAllArtworks()`) fetched by the server-rendered parent page and
 * passed down as a prop, so a newly approved submission takes part in the
 * daily shuffle too.
 */
export function useDailyArtworkOrder(catalog: Artwork[]): Artwork[] {
  const [works, setWorks] = useState<Artwork[]>(() => orderedArtworks(undefined, catalog));

  useEffect(() => {
    let timeoutId: number;
    const applyToday = () => {
      const now = new Date();
      setWorks(orderedArtworks(koreanDaySeed(now), catalog));
      // Next Korean midnight, plus a moment so the date has certainly turned.
      const msIntoKoreanDay = (now.getTime() + 9 * 60 * 60 * 1000) % 86_400_000;
      timeoutId = window.setTimeout(applyToday, 86_400_000 - msIntoKoreanDay + 1_000);
    };
    applyToday();
    return () => window.clearTimeout(timeoutId);
  }, [catalog]);

  return works;
}
