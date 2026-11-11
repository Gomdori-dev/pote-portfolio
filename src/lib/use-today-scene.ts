"use client";

import { useEffect, useState } from "react";
import { localClock, pickTodayScene, type TodayScene } from "@/lib/today-scene";

// One request per page view, shared by the homepage card and the playlist.
let pending: Promise<TodayScene & { weather: boolean }> | null = null;

function load() {
  pending ??= fetch("/api/today-scene")
    .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
    .catch(() => {
      // Offline or the route failed: the visitor's own clock still picks a scene.
      const { hour, weekday } = localClock(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      return { ...pickTodayScene({ sky: null, temperature: null, hour, weekday }), weather: false };
    });
  return pending;
}

/** Today's scene for this visitor, or null until it has loaded. */
export function useTodayScene() {
  const [scene, setScene] = useState<(TodayScene & { weather: boolean }) | null>(null);
  useEffect(() => {
    let live = true;
    load().then((result) => { if (live) setScene(result); });
    return () => { live = false; };
  }, []);
  return scene;
}
