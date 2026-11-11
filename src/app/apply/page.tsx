"use client";

import { type CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EmailFallback } from "@/components/EmailFallback";
import { PortfolioUpload } from "@/components/PortfolioUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { sendContact } from "@/lib/contact";
import { T, type DictKey, useLanguage, useT } from "@/lib/i18n";
import { WORK_TYPE_LABEL, acceptedWorkType, type WorkType } from "@/lib/participation";
import { readApplicationTracking, trackApplication } from "@/lib/application-tracking-client";
import { inquiryAnalytics } from "@/lib/contact";
import { newInquiryId } from "@/lib/analytics-client";

const APPLY_INBOX = "poteart.gallery@gmail.com";

const TERMS: { label: DictKey; value: DictKey }[] = [
  { label: "termsLabelFee", value: "termsValueFee" },
  { label: "termsLabelIntake", value: "termsValueIntake" },
  { label: "termsLabelPayout", value: "termsValuePayout" },
  { label: "termsLabelTerm", value: "termsValueTerm" },
  { label: "termsLabelExclusive", value: "termsValueExclusive" },
  { label: "termsLabelPhotos", value: "termsValuePhotos" },
  { label: "termsLabelShipping", value: "termsValueShipping" },
  { label: "termsLabelReturns", value: "termsValueReturns" },
  { label: "termsLabelUnsold", value: "termsValueUnsold" },
  { label: "termsLabelTax", value: "termsValueTax" },
  { label: "termsLabelImages", value: "termsValueImages" },
];

export default function ApplyPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [allOpen, setAllOpen] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sellerType, setSellerType] = useState<"individual" | "business">("individual");
  // 신청서와 서버가 같은 참여 기준을 사용한다.
  const [workType, setWorkType] = useState<WorkType>("original");
  const [missingFiles, setMissingFiles] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [confirmation, setConfirmation] = useState<"queued" | "unavailable">("unavailable");
  const successRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const inquiryIdRef = useRef<string | null>(null);
  useEffect(() => { trackApplication("visit"); }, []);
  const markStarted = () => { if (!startedRef.current) { startedRef.current = true; trackApplication("start"); } };
  const workTypeAllowed = acceptedWorkType(workType);
  const uploading = portfolioBusy || photoBusy;
  const t = useT();
  const { lang } = useLanguage();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || !acceptedWorkType(workType)) return;
    // 프로필 사진만 필수(작가 페이지에 쓴다). 포트폴리오는 선택으로 둔다(2026-09-25 사용자 결정).
    if (!photoUrl) {
      setMissingFiles(true);
      const photoButton = document.querySelector<HTMLButtonElement>("#apply-profile-photo .portfolio-file-button");
      photoButton?.focus({ preventScroll: true });
      photoButton?.scrollIntoView({ block: "center" });
      return;
    }
    setStatus("sending");
    const data = new FormData(event.currentTarget);
    const overseas = data.get("overseas");
    const isBusiness = sellerType === "business";
    const lines = [
      `${t("fieldArtistName")}: ${data.get("artistName")}`,
      `${t("fieldEmailPlain")}: ${data.get("email")}`,
      `${t("fieldPhone")}: ${data.get("phone")}`,
      `${t("fieldSellerType")}: ${isBusiness ? t("optionSellerBusiness") : t("optionSellerIndividual")}`,
      isBusiness ? `${t("fieldBusinessName")}: ${data.get("businessName")}` : null,
      isBusiness ? `${t("fieldBusinessOwner")}: ${data.get("businessOwner")}` : null,
      isBusiness ? `${t("fieldBusinessNumber")}: ${data.get("businessNumber")}` : null,
      isBusiness ? `${t("fieldBusinessAddress")}: ${data.get("businessAddress")}` : null,
      data.get("instagram") ? `${t("fieldInstagram")}: ${data.get("instagram")}` : null,
      `${t("fieldWorkType")}: ${t(WORK_TYPE_LABEL[workType])}`,
      `${t("fieldFocus")}: ${data.get("focus")}`,
      `${t("fieldPractice")}: ${data.get("practice")}`,
      data.get("career") ? `${t("fieldCareer")}:\n${data.get("career")}` : null,
      `${t("fieldOverseas")}: ${t(overseas === "yes" ? "optionOverseasYes" : overseas === "no" ? "optionOverseasNo" : "optionOverseasUnknown")}`,
      portfolioUrl ? `${t("fieldPortfolio")}: ${portfolioUrl}` : null,
      photoUrl ? `${t("fieldProfilePhoto")}: ${photoUrl}` : null,
    ].filter(Boolean).join("\n");
    const subject = `[Pote] ${t("applyFormHeading")} — ${data.get("artistName")}`;

    try {
      if (data.get("eligible") !== "on" || data.get("consent") !== "on" || data.get("termsAccepted") !== "on") throw new Error("missing_consent");
      markStarted();
      inquiryIdRef.current ??= newInquiryId();
      const result = await sendContact({ subject, text: lines, replyTo: String(data.get("email") ?? "").trim(), type: "artist_application", applicationTracking: readApplicationTracking() ?? undefined, analytics: inquiryAnalytics({ inquiryId: inquiryIdRef.current, kind: "artist_application" }), application: { artistName: String(data.get("artistName") ?? "").trim(), lang, workType, profilePhotoUrl: photoUrl, eligible: true, consent: true, termsAccepted: true } });
      setConfirmation(result.confirmation ?? "unavailable");
      setSubmittedEmail(String(data.get("email") ?? "").trim());
      setStatus("sent");
      requestAnimationFrame(() => {
        successRef.current?.focus({ preventScroll: true });
        successRef.current?.scrollIntoView({ block: "start" });
      });
    } catch {
      setStatus("error");
    }
  };

  return <><SiteHeader /><main className="apply-page">
    <section className="apply-intro">
      <p className="eyebrow"><T k="applyEyebrow" /></p><h1><T k="applyHeading" /></h1><p><T k="applyBody" /></p>
      <p className="provisional-note"><T k="applyWelcomeNote" /></p>
      <p className="apply-eligibility"><T k="applyEligibility" /></p>
      <p className="provisional-note"><T k="applyPhotoCriteria" /></p>
      <p className="provisional-note"><T k="applyCraftCriteria" /></p>
      <div className="apply-shortcut"><a className="primary-button" href="#application"><T k="applyJumpToForm" /></a></div>
      <p className="provisional-note"><T k="applyCommissionNote" /></p>
      <div className="apply-fee-compare">
        <strong><T k="applyFeeCompareTitle" /></strong>
        <dl>
          <div className="is-pote" style={{ "--fee-keep": "90%" } as CSSProperties}><dt><T k="applyFeeComparePote" /></dt><dd><T k="applyFeeComparePoteAmount" /></dd></div>
        </dl>
        <small><T k="applyFeeCompareNote" /></small>
      </div>
      <div className="apply-roles">
        <h2><T k="applyRolesHeading" /></h2>
        <dl>
          <div><dt><T k="applyRolesArtist" /></dt><dd><T k="applyRolesArtistBody" /></dd></div>
          <div><dt><T k="applyRolesGallery" /></dt><dd><T k="applyRolesGalleryBody" /></dd></div>
          <div><dt><T k="applyRolesBuyer" /></dt><dd><T k="applyRolesBuyerBody" /></dd></div>
        </dl>
      </div>
      <ol>
        <li><span>01</span> <T k="applyStep1" /></li>
        <li><span>02</span> <T k="applyStep2" /></li>
        <li><span>03</span> <T k="applyStep3" /></li>
      </ol>
    </section>
    <section className="apply-terms" id="terms">
      <div className="apply-terms-head">
        <h2><T k="termsHeading" /></h2>
        <button className="text-button terms-toggle" type="button" onClick={() => setAllOpen((v) => !v)}>
          <T k={allOpen ? "termsCollapseAll" : "termsExpandAll"} />
        </button>
      </div>
      <p><T k="termsIntro" /></p>
      {/* 항목이 열한 개라 전부 펼쳐두면 왼쪽 열이 지나치게 길어진다. 제목만
          보여주고 필요한 항목만 열도록 <details>를 쓴다 — 자바스크립트 없이도
          열리고, 내용은 HTML에 그대로 있어 검색·법적 고지 모두 문제없다. */}
      <div className="apply-terms-list" key={allOpen ? "open" : "closed"}>
        {TERMS.map(({ label, value }) => (
          <details key={label} open={allOpen}>
            <summary><T k={label} /></summary>
            <p><T k={value} /></p>
          </details>
        ))}
      </div>
      <p className="form-guide-link"><Link href="/tax-guide"><T k="termsTaxGuideLink" /></Link></p>
    </section>
    {status === "sent" ? <div id="application" ref={successRef} tabIndex={-1} className="form-success artist-form" role="status"><span>✓</span><h2><T k="applyEmailSuccessHeading" /></h2><p><T k="applyEmailSuccessBody" /></p><p><T k="applyReplyEmail" /> <strong className="apply-reply-email">{submittedEmail}</strong></p><p><T k={confirmation === "queued" ? "applyConfirmationQueued" : "applyConfirmationUnavailable"} /></p><p><T k="applySuccessNext" /></p><p><T k="applySuccessContact" /> <EmailFallback address={APPLY_INBOX} /></p><Link className="primary-button" href="/artworks"><T k="favBrowse" /></Link></div> : <form id="application" tabIndex={-1} className="pote-form artist-form" onChangeCapture={markStarted} onSubmit={submit}>
      <h2><T k="applyFormHeading" /></h2>
      <div className="apply-preparation"><h3><T k="applyPrepareHeading" /></h3><p><T k="applyPrepareRequired" /></p><p><T k="applyPrepareOptional" /></p><p><T k="applyPriceAfterAcceptance" /></p><p><T k="applyPreparePortfolio" /></p></div>
      <label><span><T k="fieldArtistName" /> <T k="applyRequired" /></span><input name="artistName" autoComplete="name" required maxLength={120} /></label>
      <label><span><T k="fieldEmailPlain" /> <T k="applyRequired" /></span><input name="email" autoComplete="email" required type="email" maxLength={254} /></label>
      <label><span><T k="fieldPhone" /> <T k="applyRequired" /></span><input name="phone" autoComplete="tel" required type="tel" placeholder={t("fieldPhonePlaceholder")} /><small className="field-note"><T k="fieldPhoneNote" /></small></label>
      <label><T k="fieldSellerType" /><select name="sellerType" value={sellerType} onChange={(event) => setSellerType(event.target.value as "individual" | "business")}><option value="individual">{t("optionSellerIndividual")}</option><option value="business">{t("optionSellerBusiness")}</option></select><small className="field-note"><T k="fieldSellerTypeNote" /></small></label>
      {sellerType === "business" ? <>
        <small className="field-note"><T k="fieldBusinessNote" /></small>
        <label><T k="fieldBusinessName" /><input name="businessName" required maxLength={120} /></label>
        <label><T k="fieldBusinessOwner" /><input name="businessOwner" required maxLength={60} /></label>
        <label><T k="fieldBusinessNumber" /><input name="businessNumber" required inputMode="numeric" placeholder="000-00-00000" maxLength={20} /></label>
        <label><T k="fieldBusinessAddress" /><input name="businessAddress" required maxLength={200} /></label>
      </> : null}
      <label><T k="fieldInstagram" /><input name="instagram" placeholder={t("fieldInstagramPlaceholder")} /></label>
      <label><T k="fieldWorkType" /><select name="workType" value={workType} onChange={(event) => setWorkType(event.target.value as WorkType)}>{(Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((key) => <option key={key} value={key}>{t(WORK_TYPE_LABEL[key])}{acceptedWorkType(key) ? "" : ` ${t("applyNotAccepted")}`}</option>)}</select>{workType === "photo" ? <small className="field-note"><T k="applyPhotoCriteria" /></small> : workType === "craft" ? <small className="field-note"><T k="applyCraftCriteria" /></small> : null}{workTypeAllowed ? null : <small className="field-note" role="alert"><T k="fieldWorkTypeBlocked" /></small>}</label>
      <label><span><T k="fieldFocus" /> <T k="applyRequired" /></span><input name="focus" required placeholder={t("fieldFocusPlaceholder")} /></label>
      <label><span><T k="fieldPractice" /> <T k="applyRequired" /></span><textarea name="practice" required maxLength={6000} rows={6} placeholder={t("fieldPracticePlaceholder")} /><small className="field-note"><T k="fieldPracticeNote" /></small></label>
      <label><T k="fieldCareer" /><textarea name="career" maxLength={4000} rows={4} placeholder={t("fieldCareerPlaceholder")} /><small className="field-note"><T k="fieldCareerNote" /></small></label>
      <label><T k="fieldOverseas" /><select name="overseas" defaultValue="unknown"><option value="unknown">{t("optionOverseasUnknown")}</option><option value="yes">{t("optionOverseasYes")}</option><option value="no">{t("optionOverseasNo")}</option></select></label>
      <PortfolioUpload onUrlChange={setPortfolioUrl} onBusyChange={setPortfolioBusy} />
      <PortfolioUpload id="apply-profile-photo" onUrlChange={(url) => { setPhotoUrl(url); setMissingFiles(false); }} onBusyChange={setPhotoBusy} labelKey="fieldProfilePhoto" noteKey="fieldProfilePhotoNote" hintKey="fieldProfilePhotoDropHint" imageOnly required missing={missingFiles} />
      <label className="consent"><input name="eligible" required type="checkbox" /> <T k="consentOriginal" /></label>
      <label className="consent"><input name="consent" required type="checkbox" /> <T k="consentApply" /></label>
      <label className="consent"><input name="termsAccepted" required type="checkbox" /> <span><T k="consentTermsRead" /> <a href="#terms"><T k="termsReadLink" /></a></span></label>
      <button className="primary-button" type="submit" disabled={status === "sending" || uploading || !workTypeAllowed}>{status === "sending" ? <T k="formSending" /> : <T k="submitApply" />}</button>
      {status === "error" ? <p className="provisional-note" role="alert"><T k="formSendError" /> <EmailFallback address={APPLY_INBOX} /></p> : null}
      <small><T k="applyMvpNote" /></small>
    </form>}
  </main></>;
}
