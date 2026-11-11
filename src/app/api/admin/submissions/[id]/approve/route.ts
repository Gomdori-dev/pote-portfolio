import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { approveSubmission } from "@/lib/artist-portal-db";
import { ArtworkTranslationError } from "@/lib/translate";

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const submission = await approveSubmission(id);
    if (!submission) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // /artworks, /artists/*, / (home spotlight), and the sitemap all read the
    // DB-merged catalog via getAllArtworks() at request/build time; those
    // pages have no dynamic-function usage so Next statically caches them,
    // meaning a newly approved submission silently wouldn't show up until the
    // next deploy without this. Revalidating the whole tree from the root
    // layout is simplest and correct here since approvals are rare admin
    // actions, not a hot path worth pinpointing path-by-path.
    revalidatePath("/", "layout");
    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof ArtworkTranslationError) return NextResponse.json({ error: "portalTranslationError" }, { status: 503 });
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("admin/submissions/[id]/approve failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
