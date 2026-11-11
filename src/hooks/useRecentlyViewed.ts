"use client";

import { useSyncExternalStore } from "react";

const key = "pote-recently-viewed";
const eventName = "pote-recently-viewed-change";
const empty: string[] = [];
const MAX_ENTRIES = 12;
let snapshot: string[] = empty;
let cachedRaw: string | null | undefined;

function read() {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        snapshot = Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === "string"))] : [];
      } catch { snapshot = []; }
    }
  } catch { /* Storage may be blocked in an in-app browser. Keep session state. */ }
  return snapshot;
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, notify);
  };
}

/** Most-recent-first, capped, with the newest visit of a slug replacing any
 *  earlier one instead of duplicating it. */
function record(slug: string) {
  const current = read();
  snapshot = [slug, ...current.filter((item) => item !== slug)].slice(0, MAX_ENTRIES);
  try {
    const raw = JSON.stringify(snapshot);
    window.localStorage.setItem(key, raw);
    cachedRaw = raw;
  } catch { /* Keep the interaction usable without persistent storage. */ }
  window.dispatchEvent(new Event(eventName));
}

export function useRecentlyViewed() {
  const recentlyViewed = useSyncExternalStore(subscribe, read, () => empty);
  return { recentlyViewed, record };
}
