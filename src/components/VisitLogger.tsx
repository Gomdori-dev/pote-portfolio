"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPage } from "@/lib/analytics-client";

/**
 * Logs page visits to /api/visits/log for analytics. Tracks one visit per
 * unique pathname (skips admin/artist tools and API routes).
 */
export function VisitLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastLoggedRef = useRef("");

  useEffect(() => {
    // Skip internal routes (admin, artist tools, API)
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/artist-portal") ||
      pathname.startsWith("/artist-studio") ||
      pathname.startsWith("/api/")
    ) {
      return;
    }

    // Log only on pathname change, not on search param updates
    if (pathname !== lastLoggedRef.current) {
      lastLoggedRef.current = pathname;

      fetch("/api/visits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {
        /* silently fail — don't impact page load */
      });
    }
  }, [pathname]);

  // Funnel events: one per page, plus a new one when /inquiry switches artwork.
  const inquiryKey = pathname === "/inquiry"
    ? ["artwork", "artworks", "intent"].map((key) => `${key}=${searchParams.get(key) ?? ""}`).join("&")
    : "";
  useEffect(() => {
    if (/^\/(admin|artist-portal|artist-studio|api)(\/|$)/.test(pathname)) return;
    trackPage(pathname, inquiryKey ? `?${inquiryKey}` : "");
  }, [pathname, inquiryKey]);

  return null;
}
