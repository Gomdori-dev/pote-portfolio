import { Resend } from "resend";

// All site mail uses the verified gallery domain; MAIL_FROM can override it.
export const MAIL_FROM = process.env.MAIL_FROM ?? "Pote Gallery <applications@potegallery.com>";
export const MAIL_INBOX = "poteart.gallery@gmail.com";

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}
