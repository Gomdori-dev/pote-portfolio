import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { approveSubmission, getSubmissionById } from "@/lib/artist-portal-db";
import { ArtworkTranslationError } from "@/lib/translate";

export const maxDuration = 60;
import { artistName, verifyQuickApproveToken } from "@/lib/artwork-review";

/**
 * The approve link in the review email. The signed token stands in for the
 * admin password, but only for this one submission and only while it is
 * still pending. GET only shows the work; approving needs the POST from the
 * confirmation page, so a mail scanner opening the link can't approve it.
 */

async function load(request: NextRequest, id: string) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  let valid = false;
  try {
    valid = verifyQuickApproveToken(id, token);
  } catch {
    valid = false;
  }
  if (!valid) return { error: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };
  const submission = await getSubmissionById(id);
  if (!submission) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { submission };
}

function failure(error: unknown, where: string) {
  if (error instanceof ArtworkTranslationError) return NextResponse.json({ error: "portalTranslationError" }, { status: 503 });
  if (error instanceof DatabaseNotConfiguredError) {
    return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  }
  console.error(`admin/submissions/[id]/quick-approve ${where} failed`, error);
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await load(request, id);
    if (result.error) return result.error;
    const s = result.submission;
    return NextResponse.json({
      submission: {
        status: s.status,
        artist: artistName(s.artist_slug),
        title_ko: s.title_ko,
        details_ko: s.details_ko,
        description_ko: s.description_ko,
        palette_ko: s.palette_ko,
        price: s.price,
        image_urls: s.image_urls,
        ai_review: s.ai_review,
      },
    });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await load(request, id);
    if (result.error) return result.error;
    if (result.submission.status !== "pending") {
      return NextResponse.json({ error: "not_pending", status: result.submission.status }, { status: 409 });
    }
    await approveSubmission(id);
    // Same reason as the admin approve route: the catalog pages are cached.
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "POST");
  }
}
