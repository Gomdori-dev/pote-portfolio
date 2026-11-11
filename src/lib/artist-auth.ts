import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminCredential } from "@/lib/artist-portal-db";

/**
 * Password hashing + signed-cookie session helpers for the artist portal and
 * the admin approval screen. Deliberately uses only Node's built-in `crypto`
 * (scrypt for password hashing, HMAC-SHA256 for signed cookies) — no bcrypt/
 * argon2/next-auth, per the project's "no new dependencies" constraint.
 */

const SCRYPT_KEYLEN = 64;

/**
 * Hashes `password` with scrypt. Pass an existing hex `salt` to verify
 * against a stored hash with the same salt; omit it to mint a brand new
 * salt+hash pair (e.g. when setting an artist's initial/reset password).
 */
export function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

/** Constant-time comparison via `crypto.timingSafeEqual`, not `===`. */
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  let expected: Buffer;
  try {
    expected = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/** Generates a random plaintext password for the admin to hand an artist (e.g. "aB3xQ9mK"). */
export function generateInitialPassword(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// --- Signed session cookies -------------------------------------------------
// Cookie payload: `${subject}.${expiryTimestamp}`, HMAC-SHA256 signed with
// the given secret. The payload is base64url-encoded first (so it can safely
// contain dots) and the cookie value is `${base64urlPayload}.${signatureHex}`.

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSignedValue(subject: string, secret: string, ttlMs: number): string {
  const expiry = Date.now() + ttlMs;
  const payload = `${subject}.${expiry}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

function verifySignedValue(value: string | undefined | null, secret: string | undefined): string | null {
  if (!value || !secret) return null;
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex === -1) return null;
  const encoded = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expected = sign(encoded, secret);
  if (!/^[0-9a-f]+$/i.test(signature) || !timingSafeEqualHex(signature, expected)) return null;

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const dot = payload.lastIndexOf(".");
  if (dot === -1) return null;
  const subject = payload.slice(0, dot);
  const expiry = Number(payload.slice(dot + 1));
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  return subject;
}

export const ARTIST_SESSION_COOKIE = "pote_artist_session";
export const ADMIN_SESSION_COOKIE = "pote_admin_session";

const ARTIST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Shared cookie attributes for both session cookies. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

/** Throws if `ARTIST_SESSION_SECRET` is unset — callers should catch and 500/503. */
function requireArtistSecret(): string {
  const secret = process.env.ARTIST_SESSION_SECRET;
  if (!secret) throw new Error("ARTIST_SESSION_SECRET is not configured");
  return secret;
}

export function createSessionCookie(artistSlug: string): string {
  return createSignedValue(artistSlug, requireArtistSecret(), ARTIST_SESSION_TTL_MS);
}

/** Returns the artist slug encoded in a valid, unexpired session cookie, or null. */
export function verifySessionCookie(cookieValue: string | undefined | null): string | null {
  return verifySignedValue(cookieValue, process.env.ARTIST_SESSION_SECRET);
}

export function createAdminSessionCookie(): string {
  return createSignedValue("admin", requireArtistSecret(), ADMIN_SESSION_TTL_MS);
}

export function verifyAdminSessionCookie(cookieValue: string | undefined | null): boolean {
  return verifySignedValue(cookieValue, process.env.ARTIST_SESSION_SECRET) === "admin";
}

/**
 * Checks a candidate admin password against whichever is authoritative right
 * now: once the admin has changed their password via /admin/submissions, a
 * row exists in `admin_credentials` and that hash wins; until then (or if the
 * DB is unreachable/not configured), this falls back to the `ADMIN_PASSWORD`
 * env var, same as before the change-password feature existed.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  try {
    const stored = await getAdminCredential();
    if (stored) return verifyPassword(password, stored.salt, stored.password_hash);
  } catch {
    // DB not configured or query failed — fall through to the env var below.
  }
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && password === expected;
}

/**
 * Server-side admin gate for API routes: authorized either via the
 * `x-admin-password` header (checked with `verifyAdminPassword`, following
 * the same pattern `artist-tools/route.ts` uses for its own password gate) or
 * via a valid admin session cookie set by a prior successful password check.
 * Never trust a client-only check — every admin-gated route calls this.
 */
export async function isAdminAuthorized(request: NextRequest): Promise<boolean> {
  const headerPassword = request.headers.get("x-admin-password");
  if (headerPassword && (await verifyAdminPassword(headerPassword))) return true;
  return verifyAdminSessionCookie(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

/** Returns the logged-in artist's slug from the request's session cookie, or null. */
export function getArtistSlugFromRequest(request: NextRequest): string | null {
  return verifySessionCookie(request.cookies.get(ARTIST_SESSION_COOKIE)?.value);
}
