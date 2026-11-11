"use client";

import { useEffect } from "react";
import { captureVisitSource } from "@/lib/visit-source";
import { captureApplicationSource } from "@/lib/application-tracking-client";
import { usePathname } from "next/navigation";

// Records the first page and utm_* tags of this tab's visit. Renders nothing.
export function SourceCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureVisitSource();
    if (!/^\/(admin|artist-portal|artist-studio)(\/|$)/.test(pathname)) captureApplicationSource();
  }, [pathname]);
  return null;
}
