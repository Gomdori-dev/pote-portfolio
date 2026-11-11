import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { upsertAdminCredential } from "@/lib/artist-portal-db";
import { hashPassword, isAdminAuthorized, verifyAdminPassword } from "@/lib/artist-auth";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!(await verifyAdminPassword(currentPassword))) {
    return NextResponse.json({ error: "invalid_current_password" }, { status: 401 });
  }

  try {
    const { hash, salt } = hashPassword(newPassword);
    await upsertAdminCredential(hash, salt);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("admin/change-password failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
