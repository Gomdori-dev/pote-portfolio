import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { listForAdmin, moderateComment } from "@/lib/artwork-comments";

/** 관리자 "한 줄 감상" 검토: 목록 보기, 승인·숨김·삭제. */

function failure(error: unknown, where: string) {
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  console.error(`admin/comments ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ comments: await listForAdmin() });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action;
  if (!/^[0-9a-f-]{36}$/.test(id) || (action !== "approve" && action !== "reject" && action !== "delete")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    await moderateComment(id, action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "POST");
  }
}
