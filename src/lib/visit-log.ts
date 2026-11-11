import type { Lang } from "@/lib/i18n";

/**
 * This visit's record, for the header's REC badge, the "오늘의 관람 기록" panel
 * and the admission ticket: when the visitor came in, which artwork pages they
 * looked at and for how long.
 *
 * It lives in sessionStorage — one tab, one visit, nothing sent anywhere — and
 * keeps the artwork's title, artist and photo alongside each entry, so the
 * panel (in the header, on every page) never needs the catalogue.
 */

export type VisitWork = {
  slug: string;
  image: string;
  title: Record<Lang, string>;
  artist: Record<Lang, string>;
  /** Time the page was actually visible, in ms. */
  ms: number;
  /** Last time the visitor was on the page (epoch ms). */
  last: number;
};

export type Visit = { start: number; no: string; works: VisitWork[] };

const START_KEY = "pote-session-start";
const NO_KEY = "pote-visit-no";
const WORKS_KEY = "pote-visit-works";
const COUNT_KEY = "pote-visit-count";
const CHANGE_EVENT = "pote:visit-change";
/** Opens the visit panel (REC badge, phone menu). */
export const OPEN_VISIT_EVENT = "pote:open-visit";

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

/** The visit's start, created (with its ticket number) on first call. */
function ensureStart(): { start: number; no: string } {
  let start = Number(sessionStorage.getItem(START_KEY));
  let no = sessionStorage.getItem(NO_KEY) ?? "";
  if (!start || Number.isNaN(start)) {
    start = Date.now();
    try { sessionStorage.setItem(START_KEY, String(start)); } catch { /* private mode: the visit restarts per page */ }
  }
  if (!no) {
    // MMDD-NNNN: the date and how many visits this browser has made.
    let count = 1;
    try {
      count = (Number(localStorage.getItem(COUNT_KEY)) || 0) + 1;
      localStorage.setItem(COUNT_KEY, String(count));
    } catch { /* storage blocked: every visit is No. 0001 */ }
    const day = new Date(start);
    no = `${pad(day.getMonth() + 1)}${pad(day.getDate())}-${pad(count % 10000, 4)}`;
    try { sessionStorage.setItem(NO_KEY, no); } catch { /* ignore */ }
  }
  return { start, no };
}

let cachedRaw: string | null | undefined;
let cachedVisit: Visit | null = null;

export function readVisit(): Visit | null {
  if (typeof window === "undefined") return null;
  try {
    const { start, no } = ensureStart();
    const raw = sessionStorage.getItem(WORKS_KEY);
    if (cachedVisit && raw === cachedRaw && cachedVisit.start === start && cachedVisit.no === no) return cachedVisit;
    let works: VisitWork[] = [];
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) works = parsed.filter((item): item is VisitWork => !!item && typeof item.slug === "string" && typeof item.image === "string");
    } catch { works = []; }
    cachedRaw = raw;
    cachedVisit = { start, no, works };
    return cachedVisit;
  } catch {
    return cachedVisit;
  }
}

export function subscribeVisit(notify: () => void) {
  window.addEventListener(CHANGE_EVENT, notify);
  return () => window.removeEventListener(CHANGE_EVENT, notify);
}

/** Adds viewing time to a work, registering it the first time it is seen. */
export function addViewTime(work: Omit<VisitWork, "ms" | "last">, ms: number) {
  const visit = readVisit();
  if (!visit) return;
  const now = Date.now();
  // A laptop lid closed on the page must not count as a long look.
  const add = Math.max(0, Math.min(ms, 60_000));
  const existing = visit.works.find((item) => item.slug === work.slug);
  const works = existing
    ? visit.works.map((item) => (item.slug === work.slug ? { ...item, ...work, ms: item.ms + add, last: now } : item))
    : [...visit.works, { ...work, ms: add, last: now }];
  try { sessionStorage.setItem(WORKS_KEY, JSON.stringify(works)); } catch { return; }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Longest look first. */
export function worksByTime(visit: Visit): VisitWork[] {
  return [...visit.works].sort((a, b) => b.ms - a.ms || b.last - a.last);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const body = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${pad(hours)}:${body}` : body;
}

/** 12분 08초 / 12m 08s (hours folded into minutes). */
export function formatDuration(ms: number, lang: Lang): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = pad(total % 60);
  return lang === "ko" ? `${minutes}분 ${seconds}초` : `${minutes}m ${seconds}s`;
}

export function formatEntry(start: number): string {
  const day = new Date(start);
  return `${pad(day.getHours())}:${pad(day.getMinutes())}`;
}
