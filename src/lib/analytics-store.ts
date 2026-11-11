// Funnel analytics shared by the collector, /api/contact and the admin report.
// No path-alias imports: scripts can load this file directly against a test DB.
// Rows hold random browser ids only — never IP, name, email, phone or message.

export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_EVENTS_PER_SESSION = 300;
export const INQUIRY_KINDS = ["artwork", "general", "collaboration", "artist_application", "feedback", "other"] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];
const INTENTS = ["buy", "offer", "photos", "availability", "details", "delivery", "other", "collaboration"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[A-Za-z0-9_-]{1,160}$/;
// /artworks/sold is the sold list, not an artwork page.
const ARTWORK_LIST_SEGMENTS = new Set(["sold"]);
const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|pagespeed|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|java\//i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
export const isBotUserAgent = (ua: string) => !ua.trim() || BOT_UA.test(ua);

export function deviceFromUserAgent(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function slugList(value: unknown) {
  if (typeof value !== "string" || !value) return [];
  return [...new Set(value.split(",").map((slug) => slug.trim()).filter((slug) => SLUG.test(slug)))].slice(0, 20);
}

export const FORM_EVENTS = ["inquiry_start", "inquiry_invalid", "inquiry_error"] as const;
export type FormEvent = (typeof FORM_EVENTS)[number];

export type CollectInput = {
  visitorId: string;
  sessionId: string;
  path: string;
  search: string;
  landing?: { source?: string | null; medium?: string | null; campaign?: string | null; referrerHost?: string | null };
  /** A step inside the inquiry form instead of a page view (path is then /inquiry). */
  event?: FormEvent;
};

/** Validates the browser beacon; returns null for anything malformed. */
export function parseCollectBody(body: unknown): CollectInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (!isUuid(b.visitorId) || !isUuid(b.sessionId)) return null;
  if (typeof b.path !== "string" || !b.path.startsWith("/") || b.path.length > 300) return null;
  const search = typeof b.search === "string" && b.search.length <= 1000 ? b.search : "";
  const l = b.landing && typeof b.landing === "object" ? (b.landing as Record<string, unknown>) : null;
  const referrerHost = text(l?.referrerHost, 120);
  const event = FORM_EVENTS.find((name) => name === b.event);
  if (b.event !== undefined && (!event || b.path !== "/inquiry")) return null;
  return {
    visitorId: b.visitorId,
    sessionId: b.sessionId,
    path: b.path,
    search,
    ...(event ? { event } : {}),
    landing: l ? { source: text(l.source, 60), medium: text(l.medium, 60), campaign: text(l.campaign, 60), referrerHost: referrerHost && /^[a-z0-9.-]+(:\d+)?$/i.test(referrerHost) ? referrerHost.toLowerCase() : null } : undefined,
  };
}

/** Turns a page path into the funnel event it represents. */
export function classifyPath(path: string, search: string) {
  const artwork = /^\/artworks\/([^/]+)\/?$/.exec(path);
  if (artwork) {
    let slug = artwork[1];
    try { slug = decodeURIComponent(slug); } catch {}
    if (!ARTWORK_LIST_SEGMENTS.has(slug) && SLUG.test(slug)) return { eventType: "artwork_view" as const, artworkSlug: slug, artworks: [] as string[], intent: null };
  }
  if (path === "/inquiry" || path === "/inquiry/") {
    const params = new URLSearchParams(search);
    const single = slugList(params.get("artwork"))[0] ?? null;
    const intent = params.get("intent");
    return { eventType: "inquiry_open" as const, artworkSlug: single, artworks: single ? [single] : slugList(params.get("artworks")), intent: intent && INTENTS.includes(intent) ? intent : null };
  }
  return { eventType: "page_view" as const, artworkSlug: null, artworks: [] as string[], intent: null };
}

/**
 * One round trip: upserts the session (first event fixes landing/source) and
 * stores the event unless the session already sent MAX_EVENTS_PER_SESSION.
 */
export async function recordEvent(sql: Sql, input: CollectInput, userAgent: string) {
  if (input.event) {
    // Form steps keep the inquiry's artworks/intent but never open a session:
    // a step for an unknown or expired session is dropped.
    const page = classifyPath(input.path, input.search);
    const rows = await sql`
      WITH s AS (
        UPDATE analytics_sessions SET last_seen_at = now(), event_count = event_count + 1
        WHERE session_id = ${input.sessionId} AND visitor_id = ${input.visitorId}
        RETURNING session_id, event_count
      )
      INSERT INTO analytics_events (session_id, event_type, path, artwork_slug, artworks, intent)
      SELECT session_id, ${input.event}, ${input.path}, ${page.artworkSlug}, ${page.artworks}, ${page.intent}
      FROM s WHERE s.event_count <= ${MAX_EVENTS_PER_SESSION}
      RETURNING id`;
    return { stored: rows.length > 0, eventType: input.event };
  }
  const event = classifyPath(input.path, input.search);
  const landing = input.landing ?? {};
  const rows = await sql`
    WITH s AS (
      INSERT INTO analytics_sessions (session_id, visitor_id, landing_path, source, medium, campaign, referrer_host, device)
      VALUES (${input.sessionId}, ${input.visitorId}, ${input.path}, ${landing.source ?? null}, ${landing.medium ?? null}, ${landing.campaign ?? null}, ${landing.referrerHost ?? null}, ${deviceFromUserAgent(userAgent)})
      ON CONFLICT (session_id) DO UPDATE SET last_seen_at = now(), event_count = analytics_sessions.event_count + 1
      RETURNING session_id, event_count
    )
    INSERT INTO analytics_events (session_id, event_type, path, artwork_slug, artworks, intent)
    SELECT session_id, ${event.eventType}, ${input.path}, ${event.artworkSlug}, ${event.artworks}, ${event.intent}
    FROM s WHERE s.event_count <= ${MAX_EVENTS_PER_SESSION}
    RETURNING id`;
  return { stored: rows.length > 0, eventType: event.eventType };
}

export type InquiryMeta = { inquiryId: string; receiptRef?: string | null; kind: InquiryKind; intent?: string | null; artworks?: string[]; sessionId?: string | null; visitorId?: string | null };

/** Validates the optional `analytics` block a contact form sends. */
export function validInquiryMeta(value: unknown): value is InquiryMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  return isUuid(m.inquiryId)
    && (m.receiptRef === undefined || m.receiptRef === null || (typeof m.receiptRef === "string" && /^P\d{4}-[A-Z0-9]{4}$/.test(m.receiptRef)))
    && INQUIRY_KINDS.includes(m.kind as InquiryKind)
    && (m.intent === undefined || m.intent === null || (typeof m.intent === "string" && m.intent.length <= 40 && /^[a-z_]+$/.test(m.intent)))
    && (m.artworks === undefined || (Array.isArray(m.artworks) && m.artworks.length <= 20 && m.artworks.every((slug) => typeof slug === "string" && SLUG.test(slug))))
    && (m.sessionId === undefined || m.sessionId === null || isUuid(m.sessionId))
    && (m.visitorId === undefined || m.visitorId === null || isUuid(m.visitorId));
}

/** Idempotent on inquiry_id, so a retried form never counts twice. */
export async function recordInquiry(sql: Sql, meta: InquiryMeta) {
  const rows = await sql`
    INSERT INTO analytics_inquiries (inquiry_id, receipt_ref, kind, intent, artworks, session_id, visitor_id)
    VALUES (${meta.inquiryId}, ${meta.receiptRef ?? null}, ${meta.kind}, ${meta.intent ?? null}, ${[...new Set(meta.artworks ?? [])]}, ${meta.sessionId ?? null}, ${meta.visitorId ?? null})
    ON CONFLICT (inquiry_id) DO NOTHING
    RETURNING inquiry_id`;
  return rows.length > 0;
}
