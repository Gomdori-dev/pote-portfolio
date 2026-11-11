import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { allow, clientIp } from "@/lib/rate-limit";
import { isBotUserAgent } from "@/lib/analytics-store";
import { analyticsCollectionEnabled, analyticsSql } from "@/lib/analytics-server";
import { parseApplicationTracking, recordApplicationEvent } from "@/lib/application-tracking";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body = await request.json().catch(() => null);
  const tracking = parseApplicationTracking(body?.tracking);
  if (!tracking || !["visit", "start"].includes(body?.event)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const ip = clientIp(request);
  if (!allow(`application-events:${ip}`, 60, 600_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!analyticsCollectionEnabled() || isBotUserAgent(request.headers.get("user-agent") ?? "") || (process.env.ADMIN_IPS ?? "").split(",").map(v => v.trim()).includes(ip) || await isAdminAuthorized(request)) return NextResponse.json({ ok: true, skipped: true });
  try { await recordApplicationEvent(analyticsSql(), body.event, tracking); return NextResponse.json({ ok: true }); }
  catch { console.error("application analytics collect failed"); return NextResponse.json({ error: "record_failed" }, { status: 500 }); }
}
