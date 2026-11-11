"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * A horizontal row with arrow buttons for pointers that cannot swipe.
 *
 * A pair of .arrow-triangle buttons in a rail under the row — literally the
 * same class the homepage carousel draws, so the two never drift apart. The buttons keep a
 * 44px hit area while only the triangle is drawn, and they dim at the ends of
 * the track rather than disappearing.
 *
 * The rows already scrolled fine by touch, and by trackpad or shift+wheel — but
 * on a desktop with a mouse there was nothing to do: dragging a native
 * overflow container does nothing, and the only thing a click reaches is the
 * artwork underneath, so the row looked like a dead end with work hidden past
 * its edge.
 *
 * The scroller itself is untouched, so every input that already worked still
 * does; the buttons only call scrollBy. They appear only where a mouse is the
 * likely pointer (see .scroll-row-controls in globals.css) and only when the row
 * actually overflows.
 */
export function ScrollRow({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ start: boolean; end: boolean; overflows: boolean; page: number; pages: number }>({ start: true, end: true, overflows: false, page: 1, pages: 1 });
  const t = useT();

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    // A couple of pixels of slack: fractional widths mean scrollLeft rarely
    // lands exactly on 0 or on the maximum.
    const max = el.scrollWidth - el.clientWidth;
    // Where you are, in screenfuls — the same "01 / 06" the homepage carousel
    // shows between its arrows, so the gap between the triangles says something
    // instead of being decorated.
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    const offset = Math.max(0, Math.min(max, el.scrollLeft));
    const page = max > 0 ? Math.round(offset / max * (pages - 1)) + 1 : 1;
    setAt({ start: offset <= 2, end: offset >= max - 2, overflows: max > 8, page, pages });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => { el.removeEventListener("scroll", measure); observer.disconnect(); };
  }, [measure, children]);

  /**
   * A screenful at a time, less a sliver so the card at the edge stays partly
   * visible and the row reads as continuous rather than paginated.
   *
   * No `behavior: "smooth"` here: these rows carry scroll-snap, and passing it
   * left scrollLeft at 0 where the identical call without it moved the row
   * 338px. The easing is done in CSS instead (scroll-behavior on .scroll-row
   * .result-artworks), which the snap engine does not fight.
   */
  const page = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.85 });

  return (
    <div className="scroll-row" data-overflows={at.overflows}>
      <div className={className} ref={ref}>{children}</div>
      {/* Below the row, centred. Circles floating over the pictures were both
          hard to see against a dark hairline and in the way of the work. */}
      <div className="scroll-row-controls">
        <button className="arrow-triangle" type="button" aria-label={t("scrollRowPrev")} disabled={at.start} onClick={() => page(-1)}>
          <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M11 1 2 8l9 7Z" /></svg>
        </button>
        <span className="scroll-row-count" aria-hidden="true">{String(at.page).padStart(2, "0")} / {String(at.pages).padStart(2, "0")}</span>
        <button className="arrow-triangle" type="button" aria-label={t("scrollRowNext")} disabled={at.end} onClick={() => page(1)}>
          <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M1 1l9 7-9 7Z" /></svg>
        </button>
      </div>
    </div>
  );
}
