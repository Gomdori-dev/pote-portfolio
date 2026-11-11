"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { T, type DictKey } from "@/lib/i18n";
import { hasInAppHistory } from "@/lib/nav-history";

/**
 * "◀ 작품 목록" — the tailless triangle agreed for Pote's arrows (same shape as
 * ScrollRow's .arrow-triangle). When the visitor came from another Pote page
 * it simply goes back, so the list keeps its filters and scroll position;
 * arriving from outside (a shared link) it opens `fallback` instead.
 */
export function BackButton({ fallback, label, className = "" }: { fallback: string; label: DictKey; className?: string }) {
  const router = useRouter();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (!hasInAppHistory()) return;
    event.preventDefault();
    router.back();
  };
  return (
    <Link className={`back-button ${className}`} href={fallback} onClick={onClick}>
      <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M11 1 2 8l9 7Z" /></svg>
      <T k={label} />
    </Link>
  );
}
