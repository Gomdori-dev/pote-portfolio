/**
 * The canonical address, in one place. robots.txt, the sitemap and every
 * canonical/og URL are built from it.
 *
 * The fallback is the real domain, not localhost: these values are only ever
 * consumed by crawlers and share cards, so a missing env var should degrade to
 * "correct in production" rather than publishing a robots.txt that points
 * search engines at http://localhost:3000 — which is what it did before.
 * NEXT_PUBLIC_SITE_URL still overrides, for a preview deployment that wants to
 * describe itself.
 */
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
// Old deployment settings can still contain an alias that now redirects.
// Canonical URLs must identify the final public address in that case too.
const legacyUrl = /^https?:\/\/(?:www\.potegallery\.com|pote-gallery\.vercel\.app)$/i;
export const SITE_URL = !configuredUrl || legacyUrl.test(configuredUrl)
  ? "https://potegallery.com"
  : configuredUrl;

/** 운영자 문의 창구. 포트는 사업자 등록이 없어 사업자 정보 대신 이것만 공개한다. */
export const OPERATOR_EMAIL = "poteart.gallery@gmail.com";
