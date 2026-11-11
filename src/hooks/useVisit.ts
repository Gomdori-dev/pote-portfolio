"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getArtist, type Artwork } from "@/lib/artists";
import { addViewTime, readVisit, subscribeVisit, type Visit } from "@/lib/visit-log";

/** This visit (see visit-log.ts); null on the server and before mount. */
export function useVisit(): Visit | null {
  return useSyncExternalStore(subscribeVisit, readVisit, () => null);
}

/** Milliseconds since the visit began, ticking once a second while `active`. */
export function useElapsed(start: number | undefined, active = true): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!start || !active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [start, active]);
  return start && now ? now - start : null;
}

/**
 * Counts how long an artwork page is actually on screen (hidden tabs and
 * backgrounded phones don't count) into this visit's record.
 */
export function useArtworkViewTime(artwork: Artwork) {
  useEffect(() => {
    const artist = getArtist(artwork.artistSlug).name;
    const info = { slug: artwork.slug, image: artwork.image, title: { ko: artwork.ko.title, en: artwork.en.title }, artist: { ko: artist.ko, en: artist.en } };
    let since = Date.now();
    const flush = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") addViewTime(info, now - since);
      since = now;
    };
    addViewTime(info, 0);
    const id = window.setInterval(flush, 5000);
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); else since = Date.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [artwork]);
}
