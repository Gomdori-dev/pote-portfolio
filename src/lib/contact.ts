import { acceptedWorkType } from "./participation";
import type { InquiryMeta } from "./analytics-store";
import { currentAnalyticsIds, isInternalBrowser } from "./analytics-client";
import type { ApplicationTracking } from "./application-tracking";

export type ArtistApplication = {
  artistName: string;
  lang: "ko" | "en";
  workType: "original" | "edition" | "craft" | "photo";
  profilePhotoUrl: string;
  eligible: true;
  consent: true;
  termsAccepted: true;
};
/**
 * What an inquiry is about and where the visitor came from, sent beside the
 * mail text so the server can tag the accepted mail. No name, email, phone or
 * message goes in here: these values end up as Resend tags and log lines.
 */
export type InquiryRecord = {
  ref: string;
  type: string;
  artworks: string[];
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing?: string;
};
// `analytics` holds ids, kind, intent and artwork slugs only; the server ignores it when malformed.
export type ContactMessage = { subject: string; text: string; replyTo: string; type?: "artist_application"; application?: ArtistApplication; inquiry?: InquiryRecord; analytics?: InquiryMeta; applicationTracking?: ApplicationTracking; /** Sent by a team test browser: mail goes out, funnel records are skipped. */ internal?: true };

export const INQUIRY_REF = /^P\d{4}-[A-Z0-9]{4}$/;

export function validInquiryRecord(value: unknown): value is InquiryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const optional = (field: unknown, max: number) => field === undefined || (typeof field === "string" && field.length <= max);
  return typeof r.ref === "string" && INQUIRY_REF.test(r.ref)
    && typeof r.type === "string" && /^[a-z_]{1,40}$/.test(r.type)
    && Array.isArray(r.artworks) && r.artworks.length <= 30 && r.artworks.every((slug) => typeof slug === "string" && /^[a-z0-9-]{1,80}$/.test(slug))
    && optional(r.source, 60) && optional(r.medium, 60) && optional(r.campaign, 60) && optional(r.referrer, 200) && optional(r.landing, 200);
}

// Resend tag values may only hold ASCII letters, digits, "_" and "-".
const tagValue = (value: string | undefined, fallback: string) => (value ?? "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 120) || fallback;

/** Tags for the accepted inquiry mail: the receipt number links it to the inbox and the sales ledger. */
export function inquiryTags(record: InquiryRecord) {
  return [
    { name: "kind", value: "artwork_inquiry" },
    { name: "ref", value: record.ref },
    { name: "inquiry_type", value: tagValue(record.type, "unknown") },
    { name: "artwork", value: record.artworks.length === 1 ? tagValue(record.artworks[0], "none") : record.artworks.length > 1 ? "multiple" : "none" },
    { name: "artwork_count", value: String(record.artworks.length) },
    { name: "source", value: tagValue(record.source ?? record.referrer, "direct_or_unknown") },
    { name: "medium", value: tagValue(record.medium, "none") },
    { name: "campaign", value: tagValue(record.campaign, "none") },
    { name: "landing", value: tagValue(record.landing, "unknown") },
  ];
}

export function validApplication(value: unknown): value is ArtistApplication {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  if (typeof a.artistName !== "string" || !a.artistName.trim() || a.artistName.length > 120 || /[\r\n<>]/.test(a.artistName)
    || (a.lang !== "ko" && a.lang !== "en") || !acceptedWorkType(a.workType)
    || a.eligible !== true || a.consent !== true || a.termsAccepted !== true || typeof a.profilePhotoUrl !== "string") return false;
  try {
    const url = new URL(a.profilePhotoUrl);
    return a.profilePhotoUrl.length <= 600 && url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.startsWith("/applications/");
  } catch { return false; }
}

export function validContact(value: unknown): value is ContactMessage {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (body.type !== undefined && body.type !== "artist_application") return false;
  if (body.type === "artist_application" ? !validApplication(body.application) : body.application !== undefined) return false;
  return typeof body.subject === "string" && body.subject.trim().length > 0 && body.subject.length <= 300 && !/[\r\n]/.test(body.subject)
    && typeof body.text === "string" && body.text.trim().length > 0 && body.text.length <= 20_000
    && typeof body.replyTo === "string" && body.replyTo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.replyTo);
}

// A stalled network request must not leave the form permanently disabled.
export async function sendContact(message: ContactMessage) {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Team test sends still deliver mail but stay out of the funnel counts.
    body: JSON.stringify(isInternalBrowser() ? { ...message, analytics: undefined, internal: true } : message),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error("send_failed");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) throw new Error("invalid_response");
  return result as { ok: true; confirmation?: "queued" | "unavailable"; mail?: "accepted" };
}

/** Funnel block for a contact form: anonymous browser ids are added here. */
export function inquiryAnalytics(meta: Omit<InquiryMeta, "sessionId" | "visitorId">): InquiryMeta {
  return { ...currentAnalyticsIds(), ...meta };
}
