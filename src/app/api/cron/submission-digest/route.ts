import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { listSubmissionsForAdmin, listUnreviewedPending } from "@/lib/artist-portal-db";
import { emailDigest, reviewSubmission } from "@/lib/artwork-review";

export const maxDuration = 60;

/**
 * Daily at 09:00 KST (vercel.json). Reviews any pending work the upload-time
 * review missed, then sends one email listing every work still waiting, each
 * with its approve link. Sends nothing when the queue is empty.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const deadline = Date.now() + 40_000;
    const results = await Promise.allSettled((await listUnreviewedPending()).map((submission) => reviewSubmission(submission, deadline)));
    const reviewedNow = results.filter((result) => result.status === "fulfilled" && result.value).length;
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) console.error("submission-digest review storage failures", { failed });
    const pending = await listSubmissionsForAdmin("pending");
    const items = pending.flatMap((submission) => {
      const review = submission.ai_review;
      return review && review.phase !== "running" ? [{ submission, review }] : [];
    });
    if (items.length > 0) await emailDigest(items);
    return NextResponse.json({ pending: pending.length, reviewedNow, failed, emailed: items.length });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
    }
    console.error("cron/submission-digest failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
