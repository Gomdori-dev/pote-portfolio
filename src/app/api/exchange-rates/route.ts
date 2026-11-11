import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/KRW", {
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`);
    const data = await response.json();
    const rates = data?.rates;
    if (!rates || typeof rates.USD !== "number") throw new Error("Invalid exchange rate response");
    return NextResponse.json({ base: "KRW", rates: { KRW: 1, USD: rates.USD, JPY: rates.JPY, CNY: rates.CNY, EUR: rates.EUR, AED: rates.AED, IDR: rates.IDR }, updatedAt: data.time_last_update_utc ?? null }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ base: "KRW", rates: null, updatedAt: null }, { status: 200 });
  }
}
