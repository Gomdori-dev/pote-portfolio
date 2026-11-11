"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { inquiryContext } from "@/lib/inquiry-navigation";
import { T } from "@/lib/i18n";

export function GuideInquiryLinks() {
  const params = useSearchParams();
  const context = inquiryContext(params);
  const artwork = params.get("artwork");
  return <div className="guide-inquiry-links">
    <Link className="primary-button" href={`/inquiry${context}`}><T k={artwork || params.get("artworks") ? "guideReturnInquiry" : context ? "guideReturnForm" : "footerInquiry"} /></Link>
    <Link className="back-link" href={artwork ? `/artworks/${encodeURIComponent(artwork)}` : "/artworks"}>← <T k={artwork ? "inquiryReceiptBack" : "backToList"} /></Link>
  </div>;
}
