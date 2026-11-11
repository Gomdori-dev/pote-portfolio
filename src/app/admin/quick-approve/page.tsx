import type { Metadata } from "next";
import { Suspense } from "react";
import QuickApproveClient from "./QuickApproveClient";

export const metadata: Metadata = { title: "작품 승인", robots: { index: false, follow: false } };

// Opened from the review email's "승인하기" link (src/lib/artwork-review.ts).
export default function QuickApprovePage() {
  return (
    <Suspense>
      <QuickApproveClient />
    </Suspense>
  );
}
