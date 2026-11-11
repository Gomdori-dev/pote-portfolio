// Admin funnel report over analytics_* tables (see scripts/analytics-schema.sql).
// No path-alias imports so scripts can run it against an isolated test DB.
import { FORM_EVENTS, SESSION_TIMEOUT_MS, type Sql } from "./analytics-store";

export const MAX_RANGE_DAYS = 92;
const FIRST_DAY = "2026-09-01";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const STEPS = ["visit", "view", "open", "done"] as const;
export type Step = (typeof STEPS)[number];
export const DIRECT_LABEL = "직접 방문 또는 확인 불가";

export type CatalogEntry = { slug: string; title: string; artistSlug: string; artistName: string };
export type ReportQuery = {
  from: string; to: string; artist: string | null; artwork: string | null; source: string | null;
  mode: "overview" | "journeys"; step: Step; outcome: "reached" | "dropped" | "progress"; day: string | null; offset: number;
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const kstStart = (day: string) => new Date(`${day}T00:00:00+09:00`).toISOString();
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const n = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : null);

/** Validates the admin query string; returns an error message in Korean on bad input. */
export function parseReportQuery(params: URLSearchParams, today = kstToday()): ReportQuery | { error: string } {
  const from = params.get("from") ?? addDays(today, -6);
  const to = params.get("to") ?? today;
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return { error: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)." };
  if (from > to) return { error: "시작일이 종료일보다 늦습니다." };
  if (from < FIRST_DAY || to > today) return { error: `조회 가능 기간은 ${FIRST_DAY}부터 오늘(${today})까지입니다.` };
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return { error: `한 번에 최대 ${MAX_RANGE_DAYS}일까지 조회할 수 있습니다.` };
  const pick = (key: string, re: RegExp) => { const v = params.get(key); return v && re.test(v) ? v : null; };
  const artist = pick("artist", /^[a-z0-9-]{1,60}$/);
  const artwork = pick("artwork", /^[A-Za-z0-9_-]{1,160}$/);
  const source = params.get("source")?.slice(0, 120) || null;
  const step = (STEPS as readonly string[]).includes(params.get("step") ?? "") ? (params.get("step") as Step) : "visit";
  const outcome = params.get("outcome") === "dropped" ? "dropped" : params.get("outcome") === "progress" ? "progress" : "reached";
  const day = pick("day", DAY);
  if (day && (day < from || day > to)) return { error: "선택한 날짜가 조회 기간 밖입니다." };
  const offset = Math.min(Math.max(Number.parseInt(params.get("offset") ?? "0", 10) || 0, 0), 100_000);
  return { from, to, artist, artwork, source, mode: params.get("mode") === "journeys" ? "journeys" : "overview", step, outcome, day, offset };
}

/** Same label rule for every table: UTM source first, then a known referrer host. */
export function sourceLabel(source: unknown, referrerHost: unknown) {
  if (typeof source === "string" && source) return source.toLowerCase();
  const host = typeof referrerHost === "string" ? referrerHost.toLowerCase() : "";
  if (!host) return DIRECT_LABEL;
  for (const [re, label] of [[/instagram/, "instagram"], [/threads/, "threads"], [/facebook|(^|\.)fb\./, "facebook"], [/naver/, "naver"], [/google/, "google"], [/kakao|daum/, "kakao·daum"], [/bing/, "bing"]] as const) if (re.test(host)) return label;
  return host.replace(/^www\./, "");
}

type SessionRow = {
  id: string; visitorId: string; day: string; device: string; source: string; landing: string;
  pageViews: number; view: boolean; open: boolean; done: boolean; inProgress: boolean; startedAt: string;
};

function scopeSlugs(q: ReportQuery, catalog: CatalogEntry[]) {
  if (q.artwork) return [q.artwork];
  if (q.artist) return catalog.filter((item) => item.artistSlug === q.artist).map((item) => item.slug);
  return null;
}

/**
 * One row per session started in the range. Steps must happen in order inside
 * the session: view, then inquiry page for an artwork, then an accepted
 * artwork inquiry. With an artist/artwork filter, steps only count those works.
 */
async function sessionRows(sql: Sql, q: ReportQuery, slugs: string[] | null, now: number): Promise<SessionRow[]> {
  const rows = await sql`
    SELECT s.session_id, s.visitor_id, s.device, s.source, s.referrer_host, s.landing_path, s.started_at, s.last_seen_at,
      (s.started_at AT TIME ZONE 'Asia/Seoul')::date::text AS day,
      (SELECT count(*) FROM analytics_events e WHERE e.session_id = s.session_id) AS page_views,
      v.first_view, o.first_open, c.done_at
    FROM analytics_sessions s
    LEFT JOIN LATERAL (
      SELECT min(e.created_at) AS first_view FROM analytics_events e
      WHERE e.session_id = s.session_id AND e.event_type = 'artwork_view' AND (${slugs}::text[] IS NULL OR e.artwork_slug = ANY(${slugs}::text[]))
    ) v ON true
    LEFT JOIN LATERAL (
      SELECT min(e.created_at) AS first_open FROM analytics_events e
      WHERE e.session_id = s.session_id AND e.event_type = 'inquiry_open' AND cardinality(e.artworks) > 0 AND e.created_at >= v.first_view
        AND (${slugs}::text[] IS NULL OR e.artworks && ${slugs}::text[])
    ) o ON true
    LEFT JOIN LATERAL (
      SELECT min(i.created_at) AS done_at FROM analytics_inquiries i
      WHERE i.session_id = s.session_id AND i.kind = 'artwork' AND i.created_at >= o.first_open
        AND (${slugs}::text[] IS NULL OR i.artworks && ${slugs}::text[])
    ) c ON true
    WHERE s.started_at >= ${kstStart(q.from)} AND s.started_at < ${kstStart(addDays(q.to, 1))}`;
  return rows.map((r) => {
    const done = r.done_at != null;
    return {
      id: String(r.session_id), visitorId: String(r.visitor_id), day: String(r.day), device: String(r.device),
      source: sourceLabel(r.source, r.referrer_host), landing: String(r.landing_path), pageViews: n(r.page_views),
      view: r.first_view != null, open: r.first_open != null, done,
      inProgress: !done && now - Date.parse(iso(r.last_seen_at) ?? "") < SESSION_TIMEOUT_MS,
      startedAt: iso(r.started_at) ?? "",
    };
  }).filter((r) => !q.source || r.source === q.source);
}

const reached = (row: SessionRow, step: Step) => step === "visit" || (step === "view" ? row.view : step === "open" ? row.open : row.done);

function funnel(rows: SessionRow[]) {
  return STEPS.map((step, index) => {
    const at = rows.filter((row) => reached(row, step));
    const next = STEPS[index + 1];
    const stopped = next ? at.filter((row) => !reached(row, next)) : [];
    return { step, sessions: at.length, dropped: stopped.filter((row) => !row.inProgress).length, inProgress: stopped.filter((row) => row.inProgress).length };
  });
}

function group<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}

export async function overviewReport(sql: Sql, q: ReportQuery, catalog: CatalogEntry[], now = Date.now()) {
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const slugs = scopeSlugs(q, catalog);
  const [startRow] = await sql`SELECT min(started_at) AS started FROM analytics_sessions`;
  const collectionStart = iso(startRow?.started);
  const collectionStartDay = collectionStart ? kstToday(Date.parse(collectionStart)) : null;
  const rows = await sessionRows(sql, q, slugs, now);
  const ids = rows.map((row) => row.id);

  const artworkRows = ids.length === 0 ? [] : await sql`
    SELECT slug, sum(views)::int AS views, (count(DISTINCT session_id) FILTER (WHERE views > 0))::int AS view_sessions,
      (count(DISTINCT session_id) FILTER (WHERE opens > 0))::int AS open_sessions
    FROM (
      SELECT e.artwork_slug AS slug, e.session_id, 1 AS views, 0 AS opens FROM analytics_events e
      WHERE e.session_id = ANY(${ids}::uuid[]) AND e.event_type = 'artwork_view'
      UNION ALL
      SELECT unnest(e.artworks), e.session_id, 0, 1 FROM analytics_events e
      WHERE e.session_id = ANY(${ids}::uuid[]) AND e.event_type = 'inquiry_open'
    ) x GROUP BY slug`;

  // Steps inside the inquiry form (collected from 2026-10-30), as sessions.
  const formRows = ids.length === 0 ? [] : await sql`
    SELECT event_type, count(DISTINCT session_id)::int AS sessions FROM analytics_events
    WHERE session_id = ANY(${ids}::uuid[]) AND event_type = ANY(${[...FORM_EVENTS]}::text[])
      AND (${slugs}::text[] IS NULL OR artworks && ${slugs}::text[])
    GROUP BY event_type`;
  const formSteps = Object.fromEntries(FORM_EVENTS.map((type) => [type, n(formRows.find((r) => r.event_type === type)?.sessions)]));

  // Accepted inquiries by completion date (KST), whichever session they belong to.
  const inquiryRows = (await sql`
    SELECT i.kind, i.intent, i.artworks, i.session_id, (i.created_at AT TIME ZONE 'Asia/Seoul')::date::text AS day, s.source, s.referrer_host
    FROM analytics_inquiries i LEFT JOIN analytics_sessions s ON s.session_id = i.session_id
    WHERE i.created_at >= ${kstStart(q.from)} AND i.created_at < ${kstStart(addDays(q.to, 1))}`)
    .map((r) => ({ kind: String(r.kind), intent: r.intent ? String(r.intent) : null, artworks: (r.artworks as string[]) ?? [], day: String(r.day), source: r.session_id ? sourceLabel(r.source, r.referrer_host) : DIRECT_LABEL }))
    .filter((r) => (!q.source || r.source === q.source) && (!slugs || r.kind !== "artwork" || r.artworks.some((slug) => slugs.includes(slug))))
    .filter((r) => !slugs || r.kind === "artwork");

  let legacy: { day: string; views: number }[] | null = null;
  try {
    legacy = (await sql`
      SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date::text AS day, count(*)::int AS views FROM visits
      WHERE created_at >= ${kstStart(q.from)} AND created_at < ${kstStart(addDays(q.to, 1))} GROUP BY 1`).map((r) => ({ day: String(r.day), views: n(r.views) }));
  } catch { legacy = null; }

  const sessionsByDay = group(rows, (row) => row.day);
  const inquiriesByDay = group(inquiryRows, (row) => row.day);
  const days: string[] = [];
  for (let day = q.from; day <= q.to; day = addDays(day, 1)) days.push(day);
  const daily = days.map((day) => {
    const collected = collectionStartDay !== null && day >= collectionStartDay;
    const list = sessionsByDay.get(day) ?? [];
    const inquiries = inquiriesByDay.get(day) ?? [];
    return {
      day,
      status: !collected ? "uncollected" : day === collectionStartDay ? "partial_start" : day === kstToday(now) ? "today" : "collected",
      legacyViews: legacy ? legacy.find((row) => row.day === day)?.views ?? 0 : null,
      ...(collected ? {
        sessions: list.length, visitors: new Set(list.map((row) => row.visitorId)).size, pageViews: list.reduce((sum, row) => sum + row.pageViews, 0),
        view: list.filter((row) => row.view).length, open: list.filter((row) => row.open).length, done: list.filter((row) => row.done).length,
        inquiries: inquiries.length, artworkInquiries: inquiries.filter((row) => row.kind === "artwork").length,
      } : {}),
    };
  });

  const artworks = artworkRows.map((r) => {
    const slug = String(r.slug);
    const meta = bySlug.get(slug);
    const related = inquiryRows.filter((row) => row.kind === "artwork" && row.artworks.includes(slug));
    return {
      slug, title: meta?.title ?? null, artistSlug: meta?.artistSlug ?? null, artistName: meta?.artistName ?? null,
      views: n(r.views), viewSessions: n(r.view_sessions), openSessions: n(r.open_sessions),
      inquiries: related.length, singleInquiries: related.filter((row) => row.artworks.length === 1).length,
    };
  }).filter((row) => !slugs || slugs.includes(row.slug)).sort((a, b) => b.viewSessions - a.viewSessions || b.inquiries - a.inquiries);

  const artistMap = new Map<string, { artistSlug: string | null; artistName: string; works: number; views: number; inquiryIds: Set<number> }>();
  artworks.forEach((row) => {
    const key = row.artistSlug ?? "";
    const entry = artistMap.get(key) ?? { artistSlug: row.artistSlug, artistName: row.artistName ?? "매칭 불가(삭제·비공개·잘못된 주소)", works: 0, views: 0, inquiryIds: new Set<number>() };
    entry.works += 1;
    entry.views += row.views;
    inquiryRows.forEach((inq, index) => { if (inq.kind === "artwork" && inq.artworks.includes(row.slug)) entry.inquiryIds.add(index); });
    artistMap.set(key, entry);
  });

  const sources = [...group(rows, (row) => row.source)].map(([source, list]) => ({ source, funnel: funnel(list), inquiries: inquiryRows.filter((row) => row.source === source && row.kind === "artwork").length }))
    .sort((a, b) => b.funnel[0].sessions - a.funnel[0].sessions);

  let prevPaths: { path: string; label: string | null; views: number }[] = [];
  if (q.artwork && ids.length) {
    prevPaths = (await sql`
      SELECT COALESCE(prev_path, '') AS path, count(*)::int AS views FROM (
        SELECT e.event_type, e.artwork_slug, lag(e.path) OVER (PARTITION BY e.session_id ORDER BY e.id) AS prev_path
        FROM analytics_events e WHERE e.session_id = ANY(${ids}::uuid[])
      ) t WHERE t.event_type = 'artwork_view' AND t.artwork_slug = ${q.artwork} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`)
      .map((r) => { const path = String(r.path); const slug = /^\/artworks\/([^/]+)$/.exec(path)?.[1]; return { path, label: path ? (slug && bySlug.get(slug)?.title) || null : "세션 첫 페이지(외부에서 바로 도착)", views: n(r.views) }; });
  }

  return {
    collectionStart, collectionStartDay, range: { from: q.from, to: q.to },
    totals: rows.length ? { sessions: rows.length, visitors: new Set(rows.map((row) => row.visitorId)).size, pageViews: rows.reduce((sum, row) => sum + row.pageViews, 0) } : null,
    funnel: funnel(rows),
    formSteps,
    inquiries: { total: inquiryRows.length, byKind: Object.fromEntries([...group(inquiryRows, (row) => row.kind)].map(([kind, list]) => [kind, list.length])), multiArtwork: inquiryRows.filter((row) => row.kind === "artwork" && row.artworks.length > 1).length },
    daily, artworks,
    artists: [...artistMap.values()].map(({ inquiryIds, ...rest }) => ({ ...rest, inquiries: inquiryIds.size })).sort((a, b) => b.views - a.views),
    sources,
    devices: [...group(rows, (row) => row.device)].map(([device, list]) => ({ device, sessions: list.length, done: list.filter((row) => row.done).length })),
    prevPaths,
    legacyError: legacy === null,
  };
}

export async function journeysReport(sql: Sql, q: ReportQuery, catalog: CatalogEntry[], now = Date.now()) {
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const rows = (await sessionRows(sql, q, scopeSlugs(q, catalog), now)).filter((row) => {
    if (q.day && row.day !== q.day) return false;
    if (!reached(row, q.step)) return false;
    const next = STEPS[STEPS.indexOf(q.step) + 1];
    if (q.outcome === "reached") return true;
    if (!next || reached(row, next)) return false;
    return q.outcome === "progress" ? row.inProgress : !row.inProgress;
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const page = rows.slice(q.offset, q.offset + 30);
  const ids = page.map((row) => row.id);
  const events = ids.length === 0 ? [] : await sql`
    SELECT session_id, event_type, path, artwork_slug, artworks, intent, created_at FROM analytics_events
    WHERE session_id = ANY(${ids}::uuid[]) ORDER BY session_id, id`;
  const inquiries = ids.length === 0 ? [] : await sql`
    SELECT session_id, receipt_ref, kind, intent, artworks, created_at FROM analytics_inquiries WHERE session_id = ANY(${ids}::uuid[]) ORDER BY created_at`;
  const title = (slug: string) => bySlug.get(slug)?.title ?? `매칭 불가(${slug.slice(0, 24)})`;
  return {
    total: rows.length, offset: q.offset, pageSize: 30,
    items: page.map((row) => ({
      // Short anonymous label only; never IP or personal data.
      label: row.id.slice(0, 6), day: row.day, startedAt: row.startedAt, device: row.device, source: row.source, landing: row.landing,
      steps: { view: row.view, open: row.open, done: row.done }, inProgress: row.inProgress,
      events: events.filter((e) => String(e.session_id) === row.id).map((e) => ({
        at: iso(e.created_at), type: String(e.event_type), path: String(e.path),
        artwork: e.artwork_slug ? title(String(e.artwork_slug)) : null,
        artworks: ((e.artworks as string[]) ?? []).map(title), intent: e.intent ? String(e.intent) : null,
      })),
      inquiries: inquiries.filter((i) => String(i.session_id) === row.id).map((i) => ({
        at: iso(i.created_at), ref: i.receipt_ref ? String(i.receipt_ref) : null, kind: String(i.kind), intent: i.intent ? String(i.intent) : null,
        artworks: ((i.artworks as string[]) ?? []).map(title),
      })),
    })),
  };
}
