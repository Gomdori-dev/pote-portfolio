import { createHash } from "node:crypto";
import type { ArtistApplication, ContactMessage } from "./contact";
import { MAIL_FROM, MAIL_INBOX, getResend } from "./mail";

export function applicationKey(message: ContactMessage) {
  return createHash("sha256").update(JSON.stringify([message.replyTo.toLowerCase(), message.subject, message.text, message.application])).digest("hex");
}

export function applicationConfirmation(a: ArtistApplication) {
  const name = a.artistName.trim();
  return a.lang === "en" ? {
    subject: "[Pote Gallery] We have received your artist application",
    text: `Hello ${name},\n\nThank you for applying to Pote Gallery. We have received your application and will usually reply to your application email within two weeks.\n\nIf we need more material to review your practice, we will ask by email. Once your participation is confirmed, we will share your artist page and access to the artwork upload portal. This email confirms receipt of your application; it does not confirm acceptance.\n\nTo update your application, or if you have not heard from us after two weeks, reply to this email with your artist name and application email. Please also check your spam folder.\n\nPote Gallery\n${MAIL_INBOX}\nhttps://potegallery.com`,
  } : {
    subject: "[포트 갤러리] 작가 참여 신청이 접수되었습니다",
    text: `${name} 작가님, 안녕하세요.\n\n포트 갤러리 참여 신청을 받았습니다. 보내주신 내용을 확인하고 보통 2주 안에 신청하신 이메일로 답장드립니다.\n\n작업을 확인할 자료가 더 필요하면 이메일로 요청드리겠습니다. 참여가 확정되면 작가 소개 페이지와 작품 등록용 포털을 안내드립니다. 이 메일은 신청 접수 안내이며 참여 확정 안내는 아닙니다.\n\n신청 내용을 고치거나 2주가 지나도 답변을 받지 못하셨다면 이 메일에 답장해 주세요. 작가명과 신청 이메일을 함께 알려주시면 확인이 빠릅니다. 스팸함도 확인해 주세요.\n\n포트 갤러리\n${MAIL_INBOX}\nhttps://potegallery.com`,
  };
}

export function confirmationEnabled() {
  return process.env.APPLICATION_CONFIRMATION_ENABLED === "true" && !/@resend\.dev>?$/i.test(MAIL_FROM);
}

/** Retrying a received application uses the same provider key for 24 hours. */
export async function sendApplicationConfirmation(message: ContactMessage, key: string) {
  if (!message.application || !confirmationEnabled()) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await getResend().emails.send({ from: MAIL_FROM, to: message.replyTo, replyTo: MAIL_INBOX, ...applicationConfirmation(message.application) }, { idempotencyKey: `application-confirmation/${key}` });
      if (!result.error) return true;
      if (result.error.name !== "rate_limit_exceeded" && !["internal_server_error", "application_error"].includes(result.error.name)) break;
    } catch { /* Retry an uncertain network result with the same key. */ }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  console.error("application confirmation failed", { key });
  return false;
}
