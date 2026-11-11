"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { EmailFallback } from "@/components/EmailFallback";
import { SiteHeader } from "@/components/SiteHeader";
import { inquiryAnalytics, sendContact } from "@/lib/contact";
import { newInquiryId } from "@/lib/analytics-client";
import { T, useT } from "@/lib/i18n";

const FEEDBACK_INBOX = "poteart.gallery@gmail.com";

export default function FeedbackPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const t = useT();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    const data = new FormData(event.currentTarget);
    const typeLabels: Record<string, string> = {
      bug: t("optionBugReport"),
      idea: t("optionFeatureIdea"),
      other: t("optionFeedbackOther"),
    };
    const typeValue = String(data.get("type") ?? "bug");
    const lines = [
      `${t("fieldFeedbackType")}: ${typeLabels[typeValue] ?? typeValue}`,
      `${t("fieldName")}: ${data.get("name")}`,
      `${t("fieldEmail")}: ${data.get("email")}`,
      `${t("feedbackMessage")}: ${data.get("message")}`,
    ].join("\n");
    const subject = `[Pote] ${t("footerFeedback")} — ${typeLabels[typeValue] ?? typeValue}`;

    try {
      await sendContact({ subject, text: lines, replyTo: String(data.get("email") ?? "").trim(), analytics: inquiryAnalytics({ inquiryId: newInquiryId(), kind: "feedback" }) });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="form-page">
        {status === "sent" ? (
          <div className="form-success" role="status"><span>✓</span><h1><T k="feedbackSuccessHeading" /></h1><p><T k="feedbackSuccessBody" /></p><Link className="primary-button" href="/artworks"><T k="favBrowse" /></Link></div>
        ) : (
          <form className="pote-form" onSubmit={submit}>
            <p className="eyebrow dark"><T k="feedbackEyebrow" /></p>
            <h1><T k="feedbackHeading" /></h1>
            <p><T k="feedbackBody" /></p>
            <label><T k="fieldName" /><input required name="name" autoComplete="name" maxLength={120} /></label>
            <label><T k="fieldEmail" /><input required type="email" name="email" maxLength={254} autoComplete="email" /></label>
            <label><T k="fieldFeedbackType" /><select name="type" defaultValue="bug"><option value="bug">{t("optionBugReport")}</option><option value="idea">{t("optionFeatureIdea")}</option><option value="other">{t("optionFeedbackOther")}</option></select></label>
            <label><T k="feedbackMessage" /><textarea required name="message" maxLength={6000} rows={6} placeholder={t("feedbackMessagePlaceholder")} /></label>
            <label className="consent"><input required type="checkbox" /> <T k="consentFeedback" /></label>
            <button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? <T k="formSending" /> : <T k="submitFeedback" />}</button>
            {status === "error" ? <p className="provisional-note" role="alert"><T k="formSendError" /> <EmailFallback address={FEEDBACK_INBOX} /></p> : null}
            <small><T k="mvpNoteForm" /></small>
          </form>
        )}
      </main>
    </>
  );
}
