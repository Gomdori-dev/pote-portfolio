import { after } from "next/server";
import { getSubmissionById } from "@/lib/artist-portal-db";
import { emailReview, reviewSubmission } from "@/lib/artwork-review";

/** Only pending portal submissions need a new automatic review after editing. */
export function schedulePendingReview(slug: string, deadline: number) {
  const id = slug.match(/^submission-([0-9a-f-]{36})$/i)?.[1];
  if (!id) return;
  after(async () => {
    const submission = await getSubmissionById(id);
    if (submission?.status !== "pending") return;
    const review = await reviewSubmission(submission, Math.min(deadline, Date.now() + 40_000));
    if (review) await emailReview(submission, review);
  });
}
