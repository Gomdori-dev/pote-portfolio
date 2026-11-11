import { newInquiryId } from "./analytics-client";
import { SESSION_TIMEOUT_MS } from "./analytics-store";
import { applicationSource, type ApplicationTracking } from "./application-tracking";

const KEY = "pote-application-source";
type Saved = { lastActive: number; tracking: ApplicationTracking };
let memory: Saved | null = null;

/** Attribution belongs to the current anonymous 30-minute session. An explicit new ad starts a new cohort. */
export function captureApplicationSource(): ApplicationTracking {
  const params = new URLSearchParams(window.location.search);
  const now = Date.now();
  let previous = memory;
  try { previous = JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? memory; } catch {}
  if (!previous?.tracking?.attribution || typeof previous.lastActive !== "number" || now - previous.lastActive > SESSION_TIMEOUT_MS) previous = null;
  const tagged = params.has("utm_source") || params.has("utm_campaign");
  const attribution = tagged ? applicationSource({ source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign"), content: params.get("utm_content"), term: params.get("utm_term"), landing: window.location.pathname }) : previous ? applicationSource(previous.tracking.attribution) : applicationSource({ landing: window.location.pathname });
  const priorTracking = previous?.tracking;
  const sameSource = priorTracking && ["source", "medium", "campaign", "content", "term"].every(field => priorTracking.attribution[field as keyof typeof attribution] === attribution[field as keyof typeof attribution]);
  memory = { lastActive: now, tracking: { sessionId: sameSource ? priorTracking.sessionId : newInquiryId(), attribution: sameSource ? priorTracking.attribution : attribution } };
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch {}
  return memory.tracking;
}

/** Keep the page's cohort during long forms; no idle timeout during submission. */
export function readApplicationTracking(): ApplicationTracking | null {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); if (value?.tracking) return value.tracking; } catch {}
  return memory?.tracking ?? captureApplicationSource();
}

export function trackApplication(event: "visit" | "start") {
  if (navigator.webdriver) return;
  const tracking = event === "visit" ? captureApplicationSource() : readApplicationTracking() ?? captureApplicationSource();
  fetch("/api/analytics/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, tracking }), keepalive: true }).catch(() => {});
}
