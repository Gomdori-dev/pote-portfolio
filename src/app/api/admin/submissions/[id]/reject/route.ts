import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { rejectSubmission } from "@/lib/artist-portal-db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

  try {
    const submission = await rejectSubmission(id, note);
    if (!submission) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Rejecting is also how an already-approved work is taken down from the
    // site (/admin/submissions "사이트에서 내리기"), so the cached catalog
    // pages must refresh here too, same as the approve route.
    revalidatePath("/", "layout");
    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("admin/submissions/[id]/reject failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
