import type { PlaylistKey } from "@/lib/curator-playlists";

/** What the sky is doing where the visitor is, reduced to what the scenes care about. */
export type Sky = "rain" | "snow" | "clear" | "cloudy";

/** Why this scene was picked — shown as a short line above the playlist. */
export type SceneReason = "rain" | "snow" | "lateNight" | "morning" | "sunday" | "saturday" | "dusk" | "coldNight" | "weekendNight" | "night" | "cloudyDay" | "clearDay";

export type TodayScene = { scene: PlaylistKey; reason: SceneReason };

/** Local hour (0–23) and weekday (0 = Sunday) of `now` in `timeZone`. */
export function localClock(now: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  }
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12) % 24;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((part) => part.type === "weekday")?.value ?? "Mon");
  return { hour, weekday };
}

/**
 * "오늘 같은 날의 그림": the scene that matches the visitor's weather, hour and
 * day. Weather wins (a rainy Sunday is a rainy day first), then the hour, then
 * the day. `sky` is null when the forecast could not be fetched — the pick
 * then falls back to the clock alone, so there is always a scene.
 */
export function pickTodayScene({ sky, temperature, hour, weekday }: { sky: Sky | null; temperature: number | null; hour: number; weekday: number }): TodayScene {
  if (sky === "snow") return { scene: "snow", reason: "snow" };
  if (sky === "rain") return { scene: "rain", reason: "rain" };
  if (hour < 5) return { scene: "midnightSnack", reason: "lateNight" };
  if (hour < 10) return { scene: "coffee", reason: "morning" };
  if (hour < 17) {
    if (weekday === 0) return { scene: "sunday", reason: "sunday" };
    if (weekday === 6) return { scene: "homeCafe", reason: "saturday" };
    return sky === "cloudy" ? { scene: "bookAfternoon", reason: "cloudyDay" } : { scene: "city", reason: "clearDay" };
  }
  if (hour < 20) return { scene: "afterglow", reason: "dusk" };
  if (temperature !== null && temperature < 8) return { scene: "campfire", reason: "coldNight" };
  if (weekday === 5 || weekday === 6) return { scene: "festival", reason: "weekendNight" };
  return { scene: "jazzBar", reason: "night" };
}

/** MET Norway symbol codes ("lightrain_showers_day", "partlycloudy_night", …) → Sky. */
export function skyFromSymbol(symbol: string | undefined): Sky | null {
  if (!symbol) return null;
  if (/snow/.test(symbol)) return "snow";
  if (/rain|sleet|thunder/.test(symbol)) return "rain";
  if (/clearsky|fair/.test(symbol)) return "clear";
  return "cloudy";
}
