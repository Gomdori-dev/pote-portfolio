import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { ArtworkTranslationError } from "@/lib/translate";

export const maxDuration = 60;
import { isAdminAuthorized } from "@/lib/artist-auth";
import { listManagedWorks, performWorkAction, type WorkAction } from "@/lib/artwork-controls";

/** 관리자 "사이트 작품 관리": 모든 작가의 작품을 내리기·다시 걸기·판매완료·삭제. */

function failure(error: unknown, where: string) {
  if (error instanceof ArtworkTranslationError) return NextResponse.json({ error: "portalTranslationError" }, { status: 503 });
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  console.error(`admin/works ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ works: await listManagedWorks(null) });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const action = typeof body?.action === "string" ? (body.action as WorkAction) : ("" as WorkAction);
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  try {
    const result = await performWorkAction(slug, action, "admin");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "POST");
  }
}
