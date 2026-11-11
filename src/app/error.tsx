"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { T } from "@/lib/i18n";

// Error boundaries must be client components. `retry` (stable since Next 16.3)
// re-fetches and re-renders the segment, which is what clears a failed DB read.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <><SiteHeader /><main className="inner-page">
    <header className="page-intro compact"><h1><T k="errorHeading" /></h1><p><T k="errorBody" /></p></header>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 36 }}>
      <button className="outline-button" type="button" onClick={() => retry()}><T k="errorRetry" /></button>
      <Link className="outline-button" href="/artworks"><T k="menuArtworks" /></Link>
    </div>
  </main></>;
}
