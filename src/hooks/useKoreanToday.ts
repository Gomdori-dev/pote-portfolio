"use client";

import { useEffect, useState } from "react";
import { getKoreanDate, millisecondsUntilKoreanMidnight } from "@/lib/korean-date";

export function useKoreanToday(initialDate: string): string {
  const [today, setToday] = useState(initialDate);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (disposed) return;
      clearTimeout(timer);
      const now = new Date();
      setToday(getKoreanDate(now));
      timer = setTimeout(refresh, millisecondsUntilKoreanMidnight(now) + 50);
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    // Keep hydration identical to the static page, then correct an older build date.
    queueMicrotask(refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
