import { NextRequest, NextResponse } from "next/server";
import { getSql, DatabaseNotConfiguredError } from "@/lib/db";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("cf-connecting-ip") || "unknown";
}

function isAdminIp(ip: string): boolean {
  const adminIps = (process.env.ADMIN_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIps.includes(ip);
}

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const ip = getClientIp(req);

    // 관리자 IP 제외
    if (isAdminIp(ip)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const sql = getSql();

    await sql`INSERT INTO visits (ip, path, user_agent) VALUES (${ip}, ${path}, ${userAgent})`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      // DB not configured yet — silently skip
      return NextResponse.json({ ok: true });
    }
    console.error("Failed to log visit:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
