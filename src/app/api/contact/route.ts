import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { validInquiryMeta, type InquiryMeta } from "@/lib/analytics-store";
import { recordInquirySafely } from "@/lib/analytics-server";
import { inquiryTags, validContact, validInquiryRecord } from "@/lib/contact";
import { MAIL_FROM, MAIL_INBOX, getResend } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";
import { applicationKey, confirmationEnabled, sendApplicationConfirmation } from "@/lib/application-mail";
import { applicationSource, applicationSourceText, parseApplicationTracking, recordApplicationEvent } from "@/lib/application-tracking";
import { analyticsCollectionEnabled, analyticsSql } from "@/lib/analytics-server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length")) > 100_000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  // Contact mail and comment alerts share the free Resend quota (100 a day),
  // so one bot must not be able to use it up.
  if (!allow(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!validContact(body)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const { subject, text, replyTo } = body;
  const key = body.type === "artist_application" ? applicationKey(body) : undefined;
  const applicationTracking = key ? parseApplicationTracking(body.applicationTracking) : null;
  // A malformed record only loses the tags, never the customer's mail.
  const inquiry = body.type === undefined && validInquiryRecord(body.inquiry) ? body.inquiry : undefined;
  const idempotencyKey = key ? `application-owner/${key}` : inquiry ? `inquiry/${inquiry.ref}` : undefined;
  // Funnel record, stored after Resend accepts the mail. Like the tags, a
  // malformed block is dropped instead of failing the customer's mail.
  const sentMeta = validInquiryMeta(body.analytics) ? body.analytics : undefined;
  const analytics: InquiryMeta = {
    ...sentMeta,
    inquiryId: sentMeta?.inquiryId ?? randomUUID(),
    receiptRef: sentMeta?.receiptRef ?? inquiry?.ref ?? null,
    kind: key ? "artist_application" : sentMeta && sentMeta.kind !== "artist_application" ? sentMeta.kind : "other",
    artworks: sentMeta?.artworks ?? inquiry?.artworks ?? [],
  };

  try {
    const result = await getResend().emails.send({
      from: MAIL_FROM,
      to: MAIL_INBOX,
      replyTo,
      subject,
      text: body.application ? `${text}\n\n신청 언어: ${body.application.lang}\n작품 형태: ${body.application.workType}\n참여 기준·정보 사용·참여 조건 동의: 확인\n신청 식별값: ${key}\n\n${applicationSourceText(applicationSource(applicationTracking?.attribution))}` : text,
      ...(inquiry ? { tags: inquiryTags(inquiry) } : {}),
    }, idempotencyKey ? { idempotencyKey } : undefined);
    if (result.error) throw result.error;
    // "Accepted" means Resend took the mail, not that it reached the inbox or
    // that anything was sold. Delivery is Resend's status for this mail id;
    // sales and commission are tracked by receipt number outside the site.
    if (inquiry) console.info(JSON.stringify({ event: "inquiry_mail_accepted", ref: inquiry.ref, type: inquiry.type, artworks: inquiry.artworks, source: inquiry.source ?? inquiry.referrer ?? null, medium: inquiry.medium ?? null, campaign: inquiry.campaign ?? null, landing: inquiry.landing ?? null, mailId: result.data?.id ?? null }));
    if (key && confirmationEnabled()) after(async () => { await sendApplicationConfirmation(body, key); });
    // After the response: a failed analytics write never turns a sent mail into an error or a resend.
    const internal = body.internal === true;
    if (!internal) after(() => recordInquirySafely(analytics));
    if (key && !internal && analyticsCollectionEnabled()) after(async () => {
      try { await recordApplicationEvent(analyticsSql(), "accepted", applicationTracking, key); }
      catch { console.error("application accepted analytics failed"); }
    });
    return NextResponse.json({ ok: true, ...(key ? { confirmation: confirmationEnabled() ? "queued" : "unavailable" } : {}), ...(inquiry ? { mail: "accepted" } : {}) });
  } catch {
    console.error(inquiry ? `contact email send failed (inquiry ${inquiry.ref})` : "contact email send failed");
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
