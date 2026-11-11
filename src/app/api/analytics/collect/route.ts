import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { allow, clientIp } from "@/lib/rate-limit";
import { isBotUserAgent, parseCollectBody, recordEvent } from "@/lib/analytics-store";
import { analyticsCollectionEnabled, analyticsSql } from "@/lib/analytics-server";

const skipped = (reason: string) => NextResponse.json({ ok: true, skipped: reason });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const input = parseCollectBody(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (/^\/(admin|artist-portal|artist-studio|api)(\/|$)/.test(input.path)) return skipped("internal_path");

  const ip = clientIp(request);
  if (!allow(`analytics:${ip}`, 120, 10 * 60 * 1000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isBotUserAgent(userAgent)) return skipped("bot");
  const adminIps = (process.env.ADMIN_IPS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (adminIps.includes(ip) || (await isAdminAuthorized(request))) return skipped("admin");
  if (!analyticsCollectionEnabled()) return skipped("not_production");

  try {
    const result = await recordEvent(analyticsSql(), input, userAgent);
    return NextResponse.json({ ok: true, ...(result.stored ? {} : { skipped: input.event ? "no_session_or_cap" : "session_cap" }) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return skipped("no_database");
    // Form-step types need scripts/analytics-schema.sql applied; until then drop them quietly.
    if (input.event && (error as { code?: string }).code === "23514") return skipped("schema_pending");
    console.error("analytics collect failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
