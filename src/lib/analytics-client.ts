// Anonymous funnel ids kept in this browser: a random visitor id and a
// session id that rolls over after 30 idle minutes (shared across tabs).
// Nothing personal is stored or sent; see src/lib/analytics-store.ts.
import { SESSION_TIMEOUT_MS } from "./analytics-store";

const KEY = "pote-analytics";
type Ids = { visitorId: string; sessionId: string; lastActive: number };
let memory: Ids | null = null;

function randomUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const newInquiryId = randomUuid;

/** Returns this browser's ids, starting a new session after 30 idle minutes. */
export function touchAnalyticsIds(): Ids & { isNewSession: boolean } {
  const now = Date.now();
  let saved: Ids | null = memory;
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? "null") ?? memory; } catch {}
  const valid = saved && typeof saved.visitorId === "string" && typeof saved.sessionId === "string" && typeof saved.lastActive === "number";
  const visitorId = valid ? saved!.visitorId : randomUuid();
  const isNewSession = !valid || now - saved!.lastActive > SESSION_TIMEOUT_MS;
  const ids = { visitorId, sessionId: isNewSession ? randomUuid() : saved!.sessionId, lastActive: now };
  memory = ids;
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  return { ...ids, isNewSession };
}

/**
 * Ids for the inquiry record. No timeout check: filling a long form sends no
 * page events, and the inquiry still belongs to the session that opened it.
 */
export function currentAnalyticsIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Ids | null;
    if (saved?.sessionId && saved.visitorId) return { sessionId: saved.sessionId, visitorId: saved.visitorId };
  } catch {}
  return memory ? { sessionId: memory.sessionId, visitorId: memory.visitorId } : { sessionId: null, visitorId: null };
}

const INTERNAL_KEY = "pote-internal";
let internalMemory = false;

/**
 * True for automated browsers and for browsers the team marked with
 * `?pote_internal=1` (undo with `?pote_internal=0`). QA browsers that start with
 * fresh storage and report navigator.webdriver = false (10/26 and 10/30 checks)
 * otherwise show up as dozens of one-page visits.
 */
export function isInternalBrowser() {
  if (typeof window === "undefined") return false;
  if (navigator.webdriver) return true;
  const flag = new URLSearchParams(window.location.search).get("pote_internal");
  if (flag === "1" || flag === "0") {
    internalMemory = flag === "1";
    try { if (internalMemory) localStorage.setItem(INTERNAL_KEY, "1"); else localStorage.removeItem(INTERNAL_KEY); } catch {}
  }
  if (internalMemory) return true;
  try { return localStorage.getItem(INTERNAL_KEY) === "1"; } catch { return false; }
}

/** Sends one page event. Internal browsers are skipped; failures are silent. */
export function trackPage(path: string, search: string) {
  if (isInternalBrowser()) return;
  const ids = touchAnalyticsIds();
  let landing: Record<string, string | null> | undefined;
  if (ids.isNewSession) {
    const params = new URLSearchParams(window.location.search);
    let referrerHost: string | null = null;
    try {
      const host = document.referrer ? new URL(document.referrer).host : "";
      if (host && host !== window.location.host) referrerHost = host;
    } catch {}
    landing = { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign"), referrerHost };
  }
  fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Only the inquiry page's artwork/intent query is used; UTM is read above.
    body: JSON.stringify({ visitorId: ids.visitorId, sessionId: ids.sessionId, path, search: path === "/inquiry" ? search : "", landing }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Records how far a visitor got inside the inquiry form: typed something
 * (inquiry_start), was stopped by a required field (inquiry_invalid), or the
 * send itself failed (inquiry_error). Reuses the open session; skipped when
 * there is none, so these never start a session of their own.
 */
export function trackInquiryStep(event: "inquiry_start" | "inquiry_invalid" | "inquiry_error") {
  if (isInternalBrowser()) return;
  const { sessionId, visitorId } = currentAnalyticsIds();
  if (!sessionId || !visitorId) return;
  fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId, sessionId, path: "/inquiry", search: window.location.search, event }),
    keepalive: true,
  }).catch(() => {});
}
