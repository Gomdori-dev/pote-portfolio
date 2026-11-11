// Server component: fetches the merged (static + admin-approved DB) catalog
// so an inquiry link for a DB-submitted artwork resolves to its real artwork
// card. See InquiryFormClient.tsx for the actual markup (kept as "use client"
// since it reads `useSearchParams()` and submits the form).
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllArtworks } from "@/lib/all-artworks";
import { InquiryForm, InquiryLoading, type InquiryArtwork } from "./InquiryFormClient";

export default async function InquiryPage() {
  // Only the fields the inquiry card and form read. The full catalog (descriptions,
  // extras, every photo) made this page ~270KB of RSC payload on mobile.
  const catalog: InquiryArtwork[] = (await getAllArtworks()).map(({ slug, image, artistSlug, statusKey, price, ko, en }) => ({
    slug, image, artistSlug, statusKey, price, ko: { title: ko.title, status: ko.status }, en: { title: en.title, status: en.status },
  }));
  return <><SiteHeader /><main className="form-page"><Suspense fallback={<InquiryLoading />}><InquiryForm catalog={catalog} /></Suspense></main></>;
}
