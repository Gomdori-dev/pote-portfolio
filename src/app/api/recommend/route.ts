import { NextResponse } from "next/server";
import { MAIL_FROM, MAIL_INBOX, getResend } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";

const MAX_PHOTOS = 3;
// The browser downsizes each photo to ~1600px JPEG before sending, so a real
// submission is well under this; the cap only stops abuse. Vercel functions
// reject bodies over 4.5MB anyway.
const MAX_PHOTO_BYTES = 1_400_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Room photos are private (the inside of someone's home), so unlike /apply's
// portfolio they are never put in public Blob storage — they only travel as
// attachments on the email to the inbox.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  if (!allow(`recommend:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const field = (name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);
  const name = field("name", 120);
  const email = field("email", 254);
  const summary = field("summary", 6000);
  if (!name || !EMAIL.test(email) || !summary) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const photos = form.getAll("photo").filter((item): item is File => item instanceof File && item.size > 0);
  if (photos.length > MAX_PHOTOS || photos.some((photo) => photo.type !== "image/jpeg" || photo.size > MAX_PHOTO_BYTES)) {
    return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
  }
  const attachments = await Promise.all(photos.map(async (photo, index) => ({
    filename: `room-${index + 1}.jpg`,
    content: Buffer.from(await photo.arrayBuffer()),
  })));

  try {
    const result = await getResend().emails.send({
      from: MAIL_FROM,
      to: MAIL_INBOX,
      replyTo: email,
      // "ROOM RECOMMENDATION" is the inbox search term for these requests.
      subject: `[Pote] ROOM RECOMMENDATION — ${name.replace(/[\r\n]/g, " ")}`,
      text: `${summary}\n\n사진 ${attachments.length}장 첨부`,
      attachments,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true });
  } catch {
    console.error("recommend email send failed");
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
