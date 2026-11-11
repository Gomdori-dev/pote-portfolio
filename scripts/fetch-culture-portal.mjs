/**
 * 공공데이터포털 · 한국문화정보원 「한눈에보는문화정보조회서비스」
 * https://www.data.go.kr/data/15138937/openapi.do  (활용신청 승인 2026-09-14)
 *
 * Why this exists alongside the older API_CCA_145 feed: that one is almost
 * entirely 국립 (central-government) institutions — 국립중앙박물관, MMCA,
 * 국립아시아문화전당 and so on — and carried not a single 시립 or 도립 museum.
 * This feed does: 서울시립·대전시립·대구·울산시립·경기도·전북도립·양평군립·
 * 제주도립김창열, and private houses like 사비나미술관. It also tags a real
 * region on every record, which the old feed does not — its EVENT_SITE is a
 * room name ("복합전시 1관") as often as a place.
 *
 * Two calls per exhibition: /period2 lists them (title, venue, dates, region)
 * and /detail2 adds price, the venue's own page, and the address. ~270 detail
 * calls a day against a 10,000/day allowance.
 *
 * The paging parameter is `numOfrows` — lower-case r, unlike the `numOfRows`
 * every other data.go.kr service uses and unlike this service's own docs.
 * Spelled the documented way it is ignored and you silently get 10 rows.
 */
import { requestExhibitionData } from "./exhibition-request.mjs";

const LIST_URL = "https://apis.data.go.kr/B553457/cultureinfo/period2";
const DETAIL_URL = "https://apis.data.go.kr/B553457/cultureinfo/detail2";
const PAGE_SIZE = 500;
/** How far ahead to look. Exhibitions announced further out than this are rare
 *  and go stale before they matter. */
const MONTHS_AHEAD = 15;

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? match[1].trim() : "";
}

function decode(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function plain(value) {
  // Titles in this feed are double-escaped: "ON &amp;amp; OFF" and
  // "&amp;lt;눈동자 속의 계절&amp;gt;" both showed up rendered literally.
  // One decode pass turns &amp;amp; into &amp;, so it takes a second to reach
  // the character that was meant.
  let text = decode(decode(String(value ?? "")));
  // Strip real markup only. The generic /<[^>]*>/ used elsewhere would eat
  // "<눈동자 속의 계절>" whole — Korean exhibition titles use angle brackets
  // constantly, and a tag needs an ASCII letter or a slash after the "<".
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "20261231" -> "2026-12-31"; anything else through unchanged. */
function isoDate(compact) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(compact.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : compact.trim();
}

function ymd(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * data.go.kr is reachable from a GitHub runner most of the time, and not
 * always: two manual runs went through on 2026-09-14 and the first scheduled
 * one died the next morning on UND_ERR_CONNECT_TIMEOUT — a connect timeout, no
 * answer at all. One such blip used to drop the whole source for the day, which
 * left 177 items instead of 428 and made the shrink guard refuse the write. So
 * a connect failure or a 5xx is asked again, with a widening gap.
 *
 * The retry count is a parameter, not a constant, because the two callers want
 * different things: the list is the source (four tries), while a detail row is
 * per-exhibition garnish whose failure is already swallowed — retrying several
 * hundred of those through a dead network would take longer than the run.
 */
async function readXml(url, { attempts = 1 } = {}) {
  const xml = await requestExhibitionData(url, { source: "Culture portal", attempts, headers: { Accept: "application/xml" } });
  const code = tag(xml, "resultCode");
  // "00" is this service's success code — not the "0000" the older KCISA feed
  // returns. A portal-level failure (bad key, unregistered service) comes back
  // as OpenAPI_ServiceResponse with no resultCode at all, so treat a missing
  // one as a failure too rather than reading zero items and calling it a day.
  if (code !== "00") throw new Error(`culture portal returned ${code || tag(xml, "errMsg") || "an unreadable response"}`);
  return xml;
}

function items(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => block);
}

async function fetchDetail(key, seq) {
  const url = new URL(DETAIL_URL);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("seq", seq);
  const [block] = items(await readXml(url));
  if (!block) return {};
  return {
    price: plain(tag(block, "price")),
    url: plain(tag(block, "url")),
    contents: plain(tag(block, "contents1")),
    address: plain(tag(block, "placeAddr")),
  };
}

export async function fetchCulturePortalExhibitions(key) {
  if (!key) throw new Error("DATA_GO_KR_PORTAL_KEY is missing from .env.local.");

  const today = new Date();
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + MONTHS_AHEAD);

  const listed = [];
  for (let page = 1; ; page++) {
    const url = new URL(LIST_URL);
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("numOfrows", String(PAGE_SIZE));
    url.searchParams.set("PageNo", String(page));
    url.searchParams.set("from", ymd(today));
    url.searchParams.set("to", ymd(horizon));
    const xml = await readXml(url, { attempts: 4 });
    const blocks = items(xml);
    listed.push(...blocks);
    const total = Number(tag(xml, "totalCount")) || 0;
    if (listed.length >= total || blocks.length === 0) break;
  }

  // The feed carries 공연 / 교육·체험 / 행사·축제 too. Pote is a gallery; only
  // the exhibitions belong here.
  const exhibitions = listed.filter((block) => plain(tag(block, "serviceName")) === "전시");

  const results = [];
  for (const block of exhibitions) {
    const seq = plain(tag(block, "seq"));
    const title = plain(tag(block, "title"));
    const place = plain(tag(block, "place"));
    if (!seq || !title || !place) continue;

    const area = plain(tag(block, "area"));
    const sigungu = plain(tag(block, "sigungu"));
    // A detail call failing must not drop the exhibition — the list row alone
    // is already a usable record.
    let detail = {};
    try { detail = await fetchDetail(key, seq); } catch { /* keep the list row */ }

    results.push({
      id: `cultureinfo-${seq}`,
      title,
      institution: place,
      genre: "전시",
      startDate: isoDate(plain(tag(block, "startDate"))),
      endDate: isoDate(plain(tag(block, "endDate"))),
      location: [area, sigungu].filter(Boolean).join(" "),
      fee: detail.price || "정보 없음",
      ...(detail.url ? { bookingUrl: detail.url } : {}),
      // No invented copy: contents1 when the record has it, otherwise a line
      // that only restates the venue and region the record already gives.
      description: detail.contents
        || `${place}${detail.address ? ` (${detail.address})` : ""}에서 진행하는 전시입니다. 관람 시간과 요금은 기관 안내를 확인해 주세요.`,
      ...(plain(tag(block, "thumbnail")) ? { image: plain(tag(block, "thumbnail")) } : {}),
    });
  }

  return results;
}
