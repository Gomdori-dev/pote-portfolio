"use client";

import { useSyncExternalStore } from "react";

const key = "pote-favorites";
const eventName = "pote-favorites-change";
const empty: string[] = [];
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

function toggle(slug: string) {
  const current = read();
  snapshot = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
  try {
    const raw = JSON.stringify(snapshot);
    window.localStorage.setItem(key, raw);
    cachedRaw = raw;
  } catch { /* Keep the interaction usable without persistent storage. */ }
  window.dispatchEvent(new Event(eventName));
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => empty);
  return { favorites, toggle };
}
