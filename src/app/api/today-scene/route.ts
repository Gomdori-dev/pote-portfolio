import { NextResponse, type NextRequest } from "next/server";
import { localClock, pickTodayScene, skyFromSymbol, type Sky } from "@/lib/today-scene";

// Seoul when Vercel cannot place the visitor (local dev, or a missing header).
const FALLBACK = { lat: 37.57, lon: 126.98, timeZone: "Asia/Seoul" };

/**
 * The scene for "오늘 같은 날의 그림", from the visitor's weather, hour and day.
 *
 * Location is Vercel's own IP geolocation headers (city-level, nothing is
 * stored or asked of the visitor). Weather is MET Norway's free forecast API:
 * free for commercial use with attribution (in the homepage footer's fine print), and it
 * asks for an identifying User-Agent and coordinates rounded to few decimals
 * so its cache is shared. A failed forecast still returns a clock-only scene.
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.headers.get("x-vercel-ip-latitude")) || FALLBACK.lat;
  const lon = Number(request.headers.get("x-vercel-ip-longitude")) || FALLBACK.lon;
  const timeZone = request.headers.get("x-vercel-ip-timezone") || FALLBACK.timeZone;

  let sky: Sky | null = null;
  let temperature: number | null = null;
  try {
    const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(1)}&lon=${lon.toFixed(1)}`, {
      headers: { "User-Agent": "PoteGallery/1.0 https://potegallery.com" },
      next: { revalidate: 1800 },
    });
    if (response.ok) {
      const data = await response.json();
      const now = data?.properties?.timeseries?.[0]?.data;
      sky = skyFromSymbol(now?.next_1_hours?.summary?.symbol_code ?? now?.next_6_hours?.summary?.symbol_code);
      const t = now?.instant?.details?.air_temperature;
      temperature = typeof t === "number" ? t : null;
    }
  } catch {}

  const { hour, weekday } = localClock(new Date(), timeZone);
  return NextResponse.json({ ...pickTodayScene({ sky, temperature, hour, weekday }), weather: sky !== null }, { headers: { "Cache-Control": "private, no-store" } });
}
