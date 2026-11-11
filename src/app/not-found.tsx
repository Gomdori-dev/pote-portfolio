import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { T } from "@/lib/i18n";

// Unmatched URLs and notFound() both land here: a work that was taken down,
// or an old link from an Instagram post. Next's default page was an English
// line with no header and nowhere to go, so a buyer arriving from a shared
// link simply left. Next adds the noindex tag to 404 responses itself.
export default function NotFound() {
  return <><SiteHeader /><main className="inner-page">
    <header className="page-intro compact"><h1><T k="notFoundHeading" /></h1><p><T k="notFoundBody" /></p></header>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 36 }}>
      <Link className="outline-button" href="/artworks"><T k="menuArtworks" /></Link>
      <Link className="outline-button" href="/taste"><T k="menuTaste" /></Link>
      <Link className="outline-button" href="/artists"><T k="menuArtists" /></Link>
    </div>
  </main></>;
}
