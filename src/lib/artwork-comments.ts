import crypto from "node:crypto";
import { getSql } from "@/lib/db";
import { MAIL_FROM, MAIL_INBOX, getResend } from "@/lib/mail";
import { SITE_URL } from "@/lib/site";

// 작품별 "한 줄 감상". 누구나 남길 수 있지만 운영자가 승인한 글만 보인다.
// 표는 처음 쓰일 때 만든다(마이그레이션 스크립트를 따로 돌리지 않아도 되게).

export type CommentStatus = "pending" | "approved" | "rejected";
export type ArtworkComment = { id: string; slug: string; nickname: string | null; body: string; status: CommentStatus; createdAt: string };

export const COMMENT_MAX = 80;
export const NICKNAME_MAX = 12;
const RATE_WINDOW_MINUTES = 10;
const RATE_MAX = 3;

let ready: Promise<void> | null = null;
function ensureTable() {
  ready ??= (async () => {
    const sql = getSql();
    await sql`CREATE TABLE IF NOT EXISTS artwork_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      artwork_slug text NOT NULL,
      nickname text,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      ip_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz
    )`;
    await sql`CREATE INDEX IF NOT EXISTS artwork_comments_slug_status ON artwork_comments (artwork_slug, status, created_at DESC)`;
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

type Row = { id: string; artwork_slug: string; nickname: string | null; body: string; status: CommentStatus; created_at: string | Date };
const toComment = (row: Row): ArtworkComment => ({
  id: row.id, slug: row.artwork_slug, nickname: row.nickname, body: row.body, status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
});

/** IP는 저장하지 않고, 도배 막기용으로 되돌릴 수 없는 값만 남긴다. */
export function hashIp(ip: string) {
  const salt = process.env.ARTIST_SESSION_SECRET ?? "pote-comments";
  return crypto.createHmac("sha256", salt).update(`comment-ip:${ip}`).digest("hex").slice(0, 32);
}

const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
// 광고 글은 대부분 주소를 단다. 감상에는 주소가 필요 없으니 아예 받지 않는다.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|kr|co|io|me|shop|xyz|org)\b)/i;

export type AddResult = { ok: true } | { ok: false; error: "invalid" | "has_link" | "rate_limited" };

export async function addComment(input: { slug: string; nickname: string; body: string; ipHash: string }): Promise<AddResult> {
  const slug = input.slug.trim();
  const body = clean(input.body);
  const nickname = clean(input.nickname).slice(0, NICKNAME_MAX) || null;
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || body.length < 2 || body.length > COMMENT_MAX) return { ok: false, error: "invalid" };
  if (LINK.test(body) || (nickname && LINK.test(nickname))) return { ok: false, error: "has_link" };
  await ensureTable();
  const sql = getSql();
  const recent = await sql`SELECT count(*)::int AS n FROM artwork_comments WHERE ip_hash = ${input.ipHash} AND created_at > now() - make_interval(mins => ${RATE_WINDOW_MINUTES})` as { n: number }[];
  if ((recent[0]?.n ?? 0) >= RATE_MAX) return { ok: false, error: "rate_limited" };
  await sql`INSERT INTO artwork_comments (artwork_slug, nickname, body, ip_hash) VALUES (${slug}, ${nickname}, ${body}, ${input.ipHash})`;
  await notifyOperator(slug, nickname, body).catch((error) => console.error("comment notify failed", error));
  return { ok: true };
}

export async function listApproved(slug: string): Promise<ArtworkComment[]> {
  await ensureTable();
  const rows = await getSql()`SELECT id, artwork_slug, nickname, body, status, created_at FROM artwork_comments WHERE artwork_slug = ${slug} AND status = 'approved' ORDER BY created_at DESC LIMIT 30` as Row[];
  return rows.map(toComment);
}

export async function listForAdmin(): Promise<ArtworkComment[]> {
  await ensureTable();
  const rows = await getSql()`SELECT id, artwork_slug, nickname, body, status, created_at FROM artwork_comments ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200` as Row[];
  return rows.map(toComment);
}

export async function moderateComment(id: string, action: "approve" | "reject" | "delete") {
  await ensureTable();
  const sql = getSql();
  if (action === "delete") await sql`DELETE FROM artwork_comments WHERE id = ${id}::uuid`;
  else await sql`UPDATE artwork_comments SET status = ${action === "approve" ? "approved" : "rejected"}, reviewed_at = now() WHERE id = ${id}::uuid`;
}

async function notifyOperator(slug: string, nickname: string | null, body: string) {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send({
    from: MAIL_FROM, to: MAIL_INBOX,
    subject: `[포트 갤러리] 새 한 줄 감상 — ${slug}`,
    text: `작품: ${SITE_URL}/artworks/${slug}\n쓴 사람: ${nickname ?? "익명"}\n\n${body}\n\n승인하거나 지우기: ${SITE_URL}/admin/comments`,
  });
}
