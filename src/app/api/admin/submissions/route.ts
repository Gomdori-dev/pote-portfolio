import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { isAdminAuthorized } from "@/lib/artist-auth";
import { listSubmissionsForAdmin, type SubmissionStatus } from "@/lib/artist-portal-db";

const STATUSES: SubmissionStatus[] = ["pending", "approved", "rejected"];

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const statusParam = request.nextUrl.searchParams.get("status");
  const status = STATUSES.includes(statusParam as SubmissionStatus) ? (statusParam as SubmissionStatus) : undefined;

  try {
    const submissions = await listSubmissionsForAdmin(status);
    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("admin/submissions GET failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
