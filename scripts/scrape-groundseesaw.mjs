// What this takes, and why that is defensible: only the facts a listing states —
// title, venue, dates — which are not copyrightable, plus a bookingUrl that
// sends the reader back to Ground Seesaw's own page. This is their own six
// exhibitions, not a compiled database of other people's (저작권법 제93조), and
// linking through makes us a source of their traffic rather than a substitute
// for it (부정경쟁방지법 (파)목). One request a night.
//
// It deliberately does NOT take the poster image. A poster is a real work, and
// on a show like 브래드 월스 사진전 it carries the photographer's own copyright
// on top of the venue's — nothing like a date or a title. It used to be
// scraped and stored while no page ever rendered it: pure exposure for no
// benefit, and a trap for whoever next added a thumbnail to the exhibition card.
//
// Ground Seesaw (그라운드시소) has no public API — it's a Cafe24 storefront, not a
// government open-data feed like KCISA. This scrapes its public "Now Showing"
// exhibition listing page instead. Confirmed against public/robots.txt
// (2026-09-06): /product/list.html is not disallowed.
import { requestExhibitionData } from "./exhibition-request.mjs";

const LIST_URL = "https://groundseesaw.co.kr/product/list.html?cate_no=47";
const DETAIL_BASE = "https://groundseesaw.co.kr/product/detail.html";

// Every branch confirmed against groundseesaw.co.kr/shopinfo/visit.html
// (센트럴/이스트/한남, all 서울) plus a public search confirming a 부산
// (기장군) branch. "용산" is treated the same as 한남 for region purposes —
// both are 용산-gu addresses either way, so the exact venue-name mapping
// doesn't change the region bucket.
function locationFor(venue) {
  return venue.includes("부산") ? venue : `서울 ${venue}`;
}

function firstMatch(pattern, text) {
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function splitIntoProductBlocks(html) {
  const markerPattern = /<li id="anchorBoxId_(\d+)" class="xans-record-">/g;
  const starts = [];
  let match;
  while ((match = markerPattern.exec(html))) {
    starts.push({ productNo: match[1], index: match.index });
  }
  return starts.map(({ productNo, index }, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : html.indexOf("</ul>", index);
    return { productNo, html: html.slice(index, end === -1 ? html.length : end) };
  });
}

/** "26.07.17(금) ~ 26.11.29(일)" -> { startDate: "2026-07-17", endDate: "2026-11-29" } */
function parsePeriod(period) {
  const dates = [...period.matchAll(/(\d{2})\.(\d{2})\.(\d{2})/g)].map(([, y, m, d]) => `20${y}-${m}-${d}`);
  const [startDate = "", endDate = startDate] = dates;
  return { startDate, endDate };
}

function toExhibition(block) {
  const rawTitle = firstMatch(/shop-item-title"[^>]*><a[^>]*><h4><span[^>]*>([^<]+)<\/span>/, block.html);
  const title = rawTitle.replace(/^\[[^\]]*\]\s*/, "");
  const venue = firstMatch(/custom_option2 xans-record-">[\s\S]*?<\/strong>\s*<span[^>]*>([^<]+)<\/span>/, block.html);
  const period = firstMatch(/custom_option1 xans-record-">[\s\S]*?<\/strong>\s*<span[^>]*>([^<]+)<\/span>/, block.html);
  if (!title || !venue) return null;

  const { startDate, endDate } = parsePeriod(period);
  const institution = `그라운드시소 ${venue}`;

  return {
    id: `groundseesaw-${block.productNo}`,
    title,
    institution,
    genre: "",
    startDate,
    endDate,
    location: locationFor(venue),
    fee: "정보 없음",
    bookingUrl: `${DETAIL_BASE}?product_no=${block.productNo}&cate_no=47&display_group=1`,
    description: `그라운드시소가 운영하는 전시관 '${venue}'에서 진행 중인 전시입니다. 정확한 관람 시간과 가격은 예매 페이지에서 확인할 수 있습니다.`,
  };
}

export async function fetchGroundSeesawExhibitions() {
  const html = await requestExhibitionData(LIST_URL, {
    source: "Ground Seesaw",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PoteExhibitionBot/1.0; +https://potegallery.com)" },
  });
  return splitIntoProductBlocks(html)
    .map(toExhibition)
    .filter((item) => item !== null);
}
