import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchCulturePortalExhibitions } from "./fetch-culture-portal.mjs";
import { fetchGroundSeesawExhibitions } from "./scrape-groundseesaw.mjs";
import { logExhibitionError, requestExhibitionData } from "./exhibition-request.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(projectRoot, ".env.local");
const snapshotPath = join(projectRoot, "public", "data", "exhibitions.json");
const endpoint = "https://api.kcisa.kr/openapi/API_CCA_145/request";

/**
 * Real environment first, then .env.local. On a developer's machine only the
 * file exists; in CI (see .github/workflows/refresh-exhibitions.yml) only the
 * environment does, because secrets never get written to disk there.
 */
function readEnvValue(source, name) {
  if (process.env[name]) return process.env[name];
  const match = source.match(new RegExp(`^${name}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!match) return undefined;
  const value = match[1].trim();
  return value.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
}

// Named entities actually observed in the live KCISA feed (scanned across
// every current DESCRIPTION/TITLE), plus a few common look-alikes. Not a
// full HTML5 entity table — this only needs to cover what this one feed uses.
const NAMED_ENTITIES = {
  nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  mdash: "—", ndash: "–", middot: "·", times: "×", hellip: "…",
  eacute: "é", egrave: "è", ccedil: "ç", agrave: "à", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ouml: "ö", uuml: "ü",
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function plainText(value) {
  // Some KCISA records HTML-entity-encode their markup (e.g. "&lt;p&gt;"
  // instead of a literal "<p>") instead of embedding it directly — confirmed
  // live on a 국립대구박물관 record whose DESCRIPTION was "&lt;p ...&gt;".
  // Others double-escape a literal entity (e.g. "&amp;ldquo;" for what was
  // meant to be a literal "&ldquo;") — confirmed live on a 한국예술종합학교
  // K-Arts space record. Decoding twice, with &amp; unescaped in between,
  // resolves both: a single-escaped tag/entity decodes on the first pass;
  // a double-escaped one only becomes decodable once &amp; turns
  // "&amp;ldquo;" into "&ldquo;", so it needs the second pass. Tags are
  // stripped last, after every decode pass, so an entity-encoded tag isn't
  // missed just because it decoded back into a literal tag too late.
  let text = decodeEntities(String(value ?? ""));
  text = text.replace(/&amp;/gi, "&");
  text = decodeEntities(text);
  return text
    // A bare tag-strip only removes the <style>/<script> delimiters, not the
    // CSS/JS text between them — confirmed live on a 대한민국역사박물관
    // record ("바람의 길목 DMZ") whose DESCRIPTION opened with a full
    // <style> block that rendered as visible CSS rules on the page. Drop
    // the whole element (tags + content) before the generic tag-strip.
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    // WordPress block markers ("<!-- wp:paragraph -->") and real tags only —
    // a Korean title in angle brackets ("<미틸라 회화>") is content, not markup.
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePeriod(period) {
  const [start = "", end = start] = String(period ?? "").split("~").map((value) => value.trim());
  return { startDate: start, endDate: end };
}

function normalizeFee(charge) {
  const value = plainText(charge);
  if (!value) return "정보 없음";
  return value === "0" ? "무료" : value;
}

function toImageUrl(value) {
  const url = plainText(value);
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function toExhibition(item) {
  const { startDate, endDate } = parsePeriod(item.PERIOD);
  const title = plainText(item.TITLE);
  const institution = plainText(item.CNTC_INSTT_NM);
  return {
    id: plainText(item.LOCAL_ID) || `${title}-${institution}-${startDate}`,
    title,
    institution,
    genre: plainText(item.GENRE),
    startDate,
    endDate,
    location: plainText(item.EVENT_SITE),
    fee: normalizeFee(item.CHARGE),
    ...(plainText(item.URL) ? { bookingUrl: plainText(item.URL) } : {}),
    description: plainText(item.DESCRIPTION),
    ...(toImageUrl(item.IMAGE_OBJECT) ? { image: toImageUrl(item.IMAGE_OBJECT) } : {}),
  };
}

/**
 * Sources overlap: 국립현대미술관's shows arrive from both KCISA and the
 * culture portal, under institution names that don't match ("국립현대미술관"
 * vs "국립현대미술관 서울관"), so keying on the venue would show them twice.
 * Title plus start date identifies an exhibition across feeds; a touring show
 * that genuinely runs at two venues has two start dates and stays two rows.
 */
function mergeKey(item) {
  return `${item.title.replace(/[\s·,.:;!?()[\]{}'"\-–—~]/g, "").toLowerCase()}__${item.startDate}`;
}

/**
 * The KCISA feed itself has, on at least one date, listed the exact same
 * exhibition twice in a single response — same LOCAL_ID and booking URL,
 * but a shorter title on one row ("도서원화전" vs "〈책의 얼굴들〉 도서원화전"),
 * which made two different mergeKey() values and so survived as two rows.
 * A source's own id is unique within that source (institution is included
 * since raw ids like "182" are only unique per institution, not globally),
 * so collapsing on it first — before the cross-feed title+date pass below —
 * catches this without weakening that pass's job of matching the same show
 * across KCISA and the culture portal, which never share an id at all.
 */
function sourceKey(item) {
  return `${item.institution}__${item.id}`;
}

/**
 * Neither feed is strictly richer, so keep the better half of each rather
 * than letting arrival order decide. KCISA writes real exhibition copy; the
 * portal knows the region (KCISA's EVENT_SITE is as often a room name as a
 * place) and links to the venue's own page.
 */
function mergeExhibition(existing, incoming) {
  if (!existing) return incoming;
  const longer = (a, b) => ((b ?? "").length > (a ?? "").length ? b : a);
  const region = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/;
  return {
    ...existing,
    description: longer(existing.description, incoming.description),
    // "서울 종로구" beats "3층 기획전시실" — prefer whichever actually names a region.
    location: region.test(incoming.location) && !region.test(existing.location) ? incoming.location : existing.location,
    genre: existing.genre || incoming.genre,
    fee: existing.fee && existing.fee !== "정보 없음" ? existing.fee : incoming.fee,
    bookingUrl: existing.bookingUrl || incoming.bookingUrl,
    image: existing.image || incoming.image,
  };
}

export async function refreshExhibitions({ outputPath = snapshotPath, environmentPath = envPath } = {}) {
  // Missing .env.local is normal in CI — the keys come from the environment.
  const env = await readFile(environmentPath, "utf8").catch(() => "");
  const apiKey = readEnvValue(env, "DATA_GO_KR_API_KEY");
  if (!apiKey) throw new Error("DATA_GO_KR_API_KEY is missing from .env.local.");

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("numOfRows", "200");
  url.searchParams.set("pageNo", "1");

  const payload = await requestExhibitionData(url, { source: "KCISA", format: "json", headers: { Accept: "application/json" } });
  const header = payload?.response?.header;
  if (header?.resultCode !== "0000") {
    throw new Error(`KCISA responded with ${header?.resultCode ?? "an invalid response"}.`);
  }

  const sourceItems = payload?.response?.body?.items?.item;
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
    throw new Error("KCISA returned no exhibition items; existing snapshot was left unchanged.");
  }

  const bySourceId = new Map();
  for (const item of sourceItems.map(toExhibition)) {
    if (!item.title || !item.institution) continue;
    const key = sourceKey(item);
    bySourceId.set(key, mergeExhibition(bySourceId.get(key), item));
  }

  const unique = new Map();
  for (const item of bySourceId.values()) {
    unique.set(mergeKey(item), mergeExhibition(unique.get(mergeKey(item)), item));
  }
  if (unique.size === 0) throw new Error("KCISA returned no usable exhibition items; existing snapshot was left unchanged.");

  // 한눈에보는문화정보 (공공데이터포털). This is where every 시립·도립·군립
  // museum comes from — the KCISA feed above has none. Additive like the
  // scrape below: a failure here must not cost us the national museums.
  try {
    const portalItems = await fetchCulturePortalExhibitions(readEnvValue(env, "DATA_GO_KR_PORTAL_KEY"));
    let added = 0;
    for (const item of portalItems) {
      const key = mergeKey(item);
      if (!unique.has(key)) added++;
      unique.set(key, mergeExhibition(unique.get(key), item));
    }
    console.log(`Culture portal: ${portalItems.length} exhibitions (${added} new, ${portalItems.length - added} merged into KCISA rows).`);
  } catch (error) {
    logExhibitionError("Culture portal fetch failed; continuing without it", error, [apiKey, readEnvValue(env, "DATA_GO_KR_PORTAL_KEY")]);
  }

  // Ground Seesaw (사설 전시 티켓몰, 공공 API 아님) is a nice-to-have second
  // source scraped from its public listing page — see scrape-groundseesaw.mjs.
  // A break there (site redesign, network hiccup) must not block the whole
  // daily refresh, so it only ever adds to the KCISA set, never blocks it.
  try {
    const groundSeesawItems = await fetchGroundSeesawExhibitions();
    for (const item of groundSeesawItems) {
      unique.set(mergeKey(item), mergeExhibition(unique.get(mergeKey(item)), item));
    }
    console.log(`Ground Seesaw: ${groundSeesawItems.length} items merged.`);
  } catch (error) {
    logExhibitionError("Ground Seesaw scrape failed; continuing with other sources", error, [apiKey]);
  }

  const items = [...unique.values()];

  // A source that goes down must not quietly shrink the site. When the
  // culture-portal feed was unreachable from a CI runner, the refresh
  // "succeeded" with 177 items instead of 429 and deployed that — the
  // exhibition list lost three quarters of itself and nothing said so.
  // Exhibitions do end, so some shrinkage is normal; losing a quarter of them
  // in a day is a broken source, not churn.
  const previous = await readFile(outputPath, "utf8").then((raw) => JSON.parse(raw).items?.length ?? 0).catch(() => 0);
  if (previous > 0 && items.length < previous * 0.75) {
    throw new Error(`Refusing to shrink the snapshot from ${previous} to ${items.length} items — a source is probably down. Existing snapshot left unchanged.`);
  }

  const snapshot = { updatedAt: new Date().toISOString(), items };
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.next`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await rename(temporaryPath, outputPath);
  console.log(`Exhibition snapshot refreshed: ${items.length} items.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  refreshExhibitions().catch((error) => {
    logExhibitionError("Exhibition refresh failed; existing snapshot left unchanged", error);
    process.exitCode = 1;
  });
}
