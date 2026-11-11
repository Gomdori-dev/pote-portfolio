import { NextRequest, NextResponse } from "next/server";
import { getArtworkFromAll } from "@/lib/all-artworks";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { addComment, hashIp, listApproved } from "@/lib/artwork-comments";
import { clientIp } from "@/lib/rate-limit";

function failure(error: unknown, where: string) {
  if (error instanceof DatabaseNotConfiguredError) return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  console.error(`artwork-comments ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ comments: [] });
  try {
    const comments = (await listApproved(slug)).map(({ id, nickname, body, createdAt }) => ({ id, nickname, body, createdAt }));
    return NextResponse.json({ comments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  // 사람 눈에 안 보이는 칸. 채워져 있으면 자동 등록 봇이다. 성공한 척만 한다.
  if (typeof body?.website === "string" && body.website) return NextResponse.json({ ok: true });
  const slug = typeof body?.slug === "string" ? body.slug : "";
  try {
    // A made-up slug would still send the operator an alert mail.
    if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(slug) ||!(await getArtworkFromAll(slug))) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const result = await addComment({
      slug,
      nickname: typeof body?.nickname === "string" ? body.nickname : "",
      body: typeof body?.body === "string" ? body.body : "",
      ipHash: hashIp(clientIp(request)),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "rate_limited" ? 429 : 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "POST");
  }
}
