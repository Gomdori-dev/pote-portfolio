"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { clearInquiryDraft, DRAFT_FIELDS, readInquiryDraft, saveInquiryDraft, type InquiryDraft } from "@/lib/inquiry-draft";
import { EmailFallback } from "@/components/EmailFallback";
import { inquiryAnalytics, sendContact } from "@/lib/contact";
import { newInquiryId, trackInquiryStep } from "@/lib/analytics-client";
import { readVisitSource, visitSourceLine } from "@/lib/visit-source";
import { getArtist, type Artwork } from "@/lib/artists";
import { T, useLanguage, useT, usePrice, type DictKey } from "@/lib/i18n";
import { artworkPrice, formatLocalizedPrice } from "@/lib/catalog";
import { inquiryContext } from "@/lib/inquiry-navigation";
import { clearInquiryReceipt, inquiryReceiptKey, readInquiryReceipt, saveInquiryReceipt, type InquiryReceipt, type ReceiptRowKey } from "@/lib/inquiry-receipt";

const INQUIRY_INBOX = "poteart.gallery@gmail.com";
// 개인 작가 작품은 이 금액 이상일 때만 "나눠서 계좌이체"를 보여 준다.
const SPLIT_MIN_PRICE = 500_000;
const collaborationOptions: { value: string; label: DictKey }[] = [
  { value: "collaboration_exhibition", label: "collaborationExhibition" },
  { value: "collaboration_popup", label: "collaborationPopup" },
  { value: "collaboration_brand", label: "collaborationBrand" },
  { value: "collaboration_content", label: "collaborationContent" },
  { value: "collaboration_space", label: "collaborationSpace" },
  { value: "collaboration_commission", label: "collaborationCommission" },
  { value: "collaboration_education", label: "collaborationEducation" },
  { value: "collaboration", label: "collaborationOther" },
];
const collaborationFields: { name: string; label: ReceiptRowKey; placeholder: DictKey; maxLength: number; inputType?: "url" }[] = [
  { name: "organization", label: "collaborationOrganization", placeholder: "collaborationOrganizationHint", maxLength: 160 },
  { name: "project", label: "collaborationProject", placeholder: "collaborationProjectHint", maxLength: 200 },
  { name: "timeline", label: "collaborationTimeline", placeholder: "collaborationTimelineHint", maxLength: 200 },
  { name: "location", label: "collaborationLocation", placeholder: "collaborationLocationHint", maxLength: 200 },
  { name: "budget", label: "collaborationBudget", placeholder: "collaborationBudgetHint", maxLength: 200 },
  { name: "referenceUrl", label: "collaborationReference", placeholder: "collaborationReferenceHint", maxLength: 1000, inputType: "url" },
];
const isCollaborationType = (value: string) => value === "collaboration" || value.startsWith("collaboration_");

/** The slice of an artwork this form shows; page.tsx sends only these fields. */
export type InquiryArtwork = Pick<Artwork, "slug" | "image" | "artistSlug" | "statusKey" | "price"> & Record<"ko" | "en", Pick<Artwork["ko"], "title" | "status">>;

/** "P0928-7K2Q": 날짜 + 임의 4자리. 제출할 때 한 번만 만든다. */
function receiptRef() {
  const now = new Date();
  return `P${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0")}`;
}

/**
 * `catalog` is the merged static+DB list fetched by the server-rendered
 * `page.tsx` via `getAllArtworks()`, so an inquiry link for a DB-submitted
 * artwork (`?artwork=submission-<uuid>`) resolves to its real artwork card
 * instead of the generic fallback heading.
 */
export function InquiryForm({ catalog }: { catalog: InquiryArtwork[] }) {
  const searchParams = useSearchParams();
  return <InquiryFormSession key={searchParams.toString()} catalog={catalog} storageKey={inquiryReceiptKey(searchParams)} />;
}

function InquiryFormSession({ catalog, storageKey }: { catalog: InquiryArtwork[]; storageKey: string }) {
  const [restored, setRestored] = useState<{ receipt: InquiryReceipt | null; draft: InquiryDraft | null } | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setRestored({ receipt: readInquiryReceipt(storageKey), draft: readInquiryDraft(storageKey) }); });
    return () => { active = false; };
  }, [storageKey]);
  // Never flash a blank send form while checking an already submitted receipt.
  if (!restored) return <InquiryLoading />;
  return <InquiryFormFields catalog={catalog} storageKey={storageKey} initialReceipt={restored.receipt} initialDraft={restored.receipt ? null : restored.draft} />;
}

function InquiryFormFields({ catalog, storageKey, initialReceipt, initialDraft }: { catalog: InquiryArtwork[]; storageKey: string; initialReceipt: InquiryReceipt | null; initialDraft: InquiryDraft | null }) {
  const searchParams = useSearchParams();
  const artwork = catalog.find((item) => item.slug === (searchParams.get("artwork") ?? ""));
  // Several favorited works batched into one inquiry (from /favorites'
  // multi-select) instead of one artwork per submission.
  const multiple = (searchParams.get("artworks") ?? "").split(",").map((slug) => catalog.find((item) => item.slug === slug.trim())).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "limited">(initialReceipt ? "sent" : "idle");
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inquiryIdRef = useRef<string | null>(null);
  // Funnel steps inside the form, each sent once per form: typed, blocked by a required field.
  const startedRef = useRef(false);
  const invalidSentRef = useRef(false);
  // Save only successful submissions; restore the receipt without sending again.
  const [receipt, setReceipt] = useState<InquiryReceipt | null>(initialReceipt);
  const [receiptStored, setReceiptStored] = useState(Boolean(initialReceipt));
  const sold = artwork?.statusKey === "sold";
  // `?intent=buy|offer` comes from the detail page's two purchase buttons.
  // A buyer who already said "I want this" gets a shorter form with no
  // required message, instead of the open-ended question form.
  const intentParam = searchParams.get("intent");
  const allowedIntents = artwork ? ["buy", "offer", "photos", "availability", "details", "delivery", "other"] : multiple.length ? ["buy", "photos", "availability", "details", "delivery", "other"] : ["details", "delivery", "other"];
  const initialType = intentParam === "collaboration" ? "collaboration" : sold ? "details" : intentParam && allowedIntents.includes(intentParam) ? intentParam : artwork || multiple.length > 0 ? "availability" : "other";
  const restoredType = initialDraft?.type;
  const safeRestoredType = restoredType && (isCollaborationType(restoredType) || allowedIntents.includes(restoredType)) && !(sold && ["buy", "offer", "availability", "photos"].includes(restoredType)) ? restoredType : initialType;
  const [type, setType] = useState(safeRestoredType);
  const [defaultFields, setDefaultFields] = useState<Record<string, string>>(initialDraft?.fields ?? {});
  const draftFields = useRef<Record<string, string>>(defaultFields);
  const [draftStored, setDraftStored] = useState<boolean | null>(initialDraft ? true : null);
  const [pendingMessage, setPendingMessage] = useState<{ subject: string; text: string } | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const saveDraft = () => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    for (const name of Object.keys(DRAFT_FIELDS)) {
      if (data.has(name)) draftFields.current[name] = String(data.get(name) ?? "");
    }
    setDefaultFields({ ...draftFields.current });
    // Timestamp is captured only from form events.
    // eslint-disable-next-line react-hooks/purity
    setDraftStored(saveInquiryDraft(storageKey, { at: Date.now(), type: String(data.get("type") ?? initialType), pay: String(data.get("pay") ?? ""), fields: { ...draftFields.current } }));
  };
  const collaboration = isCollaborationType(type);
  const missingArtwork = Boolean(searchParams.get("artwork") || searchParams.get("artworks")) && !artwork && multiple.length === 0;
  const purchase = type === "buy" || type === "offer";
  // 결제 방법: 사업자 작가만 카드 선택지를 보이고(카드 가맹은 사업자만 가능),
  // 개인 작가는 계좌이체만, 50만 원 이상(또는 가격 미정)일 때 분할 입금 희망을 받는다.
  const business = artwork ? getArtist(artwork.artistSlug).sellerType === "business" : false;
  const priceValue = Number((artwork?.price ?? "").replace(/[^0-9]/g, ""));
  const payOptions: DictKey[] = business ? ["payTransfer", "payCard", "payAny"] : !priceValue || priceValue >= SPLIT_MIN_PRICE ? ["payOnce", "paySplit"] : [];
  const showPay = purchase && Boolean(artwork) && multiple.length === 0;
  const [pay, setPay] = useState<DictKey | null>((initialDraft?.pay as DictKey) || null);
  const selectedPay = pay && payOptions.includes(pay) ? pay : payOptions[0];
  const { lang } = useLanguage();
  const t = useT();
  const formatPrice = usePrice();
  const displayPrice = (item: InquiryArtwork) => {
    const price = artworkPrice(item.price);
    return price === null ? item.price ?? t("pricingInquiry") : formatPrice(price);
  };
  // Transaction records retain the KRW basis alongside the same display price.
  const recordPrice = (item: InquiryArtwork) => {
    const price = artworkPrice(item.price);
    return price !== null && lang === "en" ? `${displayPrice(item)} · ${t("priceKrwReference")}: ${formatLocalizedPrice(price, "ko")}` : displayPrice(item);
  };
  const draftToken = searchParams.get("draft");
  useEffect(() => {
    if (!draftToken || !/^[a-zA-Z0-9-]{1,64}$/.test(draftToken)) return;
    try {
      const key = `pote-inquiry-guide:${draftToken}`;
      const raw = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/purity
      if (Date.now() - draft.at > 30 * 60 * 1000 || draft.artwork !== (searchParams.get("artwork") ?? "") || draft.artworks !== (searchParams.get("artworks") ?? "")) return;
      queueMicrotask(() => {
        if (typeof draft.type === "string" && !(sold && ["buy", "offer", "availability", "photos"].includes(draft.type))) setType(draft.type);
        if (typeof draft.pay === "string") setPay(draft.pay as DictKey);
        requestAnimationFrame(() => {
          for (const name of Object.keys(DRAFT_FIELDS)) {
            const field = formRef.current?.elements.namedItem(name);
            if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && typeof draft.fields?.[name] === "string") { field.value = draft.fields[name]; draftFields.current[name] = draft.fields[name]; }
          }
          setDefaultFields({ ...draftFields.current });
        });
      });
    } catch { /* Private browsing may disable tab storage; inquiry links still work. */ }
  }, [draftToken, searchParams, sold]);
  const guideQuery = new URLSearchParams(inquiryContext(searchParams).slice(1));
  guideQuery.set("intent", type);
  // Use one token for this form's guide visit; no personal values enter the URL.
  const guideDraftToken = useId().replace(/[^a-zA-Z0-9-]/g, "");
  guideQuery.set("draft", guideDraftToken);
  const saveGuideDraft = () => {
    if (!formRef.current) return;
    try {
      // Delete expired drafts so abandoned guide visits do not accumulate.
      for (const key of Object.keys(sessionStorage)) {
        if (!key.startsWith("pote-inquiry-guide:")) continue;
        // eslint-disable-next-line react-hooks/purity
        try { if (Date.now() - JSON.parse(sessionStorage.getItem(key) ?? "{}").at > 30 * 60 * 1000) sessionStorage.removeItem(key); } catch { sessionStorage.removeItem(key); }
      }
      saveDraft();
      const fields = { ...draftFields.current };
      // eslint-disable-next-line react-hooks/purity
      sessionStorage.setItem(`pote-inquiry-guide:${guideDraftToken}`, JSON.stringify({ at: Date.now(), artwork: searchParams.get("artwork") ?? "", artworks: searchParams.get("artworks") ?? "", type, pay: selectedPay, fields }));
    } catch { /* Storage is optional; never block the guide. */ }
  };
  const title = collaboration ? t("collaborationHeading") : multiple.length > 0 ? t("inquiryMultipleHeading") : artwork ? artwork[lang].title : t("inquiryFallbackHeading");
  const heading = collaboration ? t("collaborationHeading") : multiple.length > 0 ? t("inquiryMultipleHeading") : type === "buy" ? t("buyRequestHeading") : type === "offer" ? t("offerHeading") : type === "photos" ? t("optionPhotos") : t("inquiryFallbackHeading");
  // 사진 요청은 무엇을 원하는지 이미 분명해서 말씀 칸을 비워도 된다.
  const messageOptional = purchase || type === "photos" || (type === "availability" && Boolean(artwork || multiple.length));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    saveDraft();
    setCopyState("idle");
    setStatus("sending");
    const data = new FormData(event.currentTarget);
    const typeLabels: Record<string, string> = {
      buy: t("optionBuy"),
      offer: t("optionOffer"),
      availability: t("optionAvailability"),
      details: t("optionDetails"),
      photos: t("optionPhotos"),
      delivery: t("optionDelivery"),
      other: t("optionOther"),
      collaboration: t("collaborationLink"),
      ...Object.fromEntries(collaborationOptions.map((option) => [option.value, t(option.label)])),
    };
    const typeValue = String(data.get("type") ?? "availability");
    const offer = String(data.get("offer") ?? "").replace(/[^0-9]/g, "");
    const phone = String(data.get("phone") ?? "").trim();
    const projectRows: [ReceiptRowKey, string][] = collaboration ? collaborationFields.flatMap((field) => {
      const value = String(data.get(field.name) ?? "").trim();
      return value ? [[field.label, value] as [ReceiptRowKey, string]] : [];
    }) : [];
    // 메일 제목·본문과 접수 화면에 같은 번호가 찍혀, 답장이 늦을 때 이 번호로 찾을 수 있다.
    const ref = receiptRef();
    const artworkLines = multiple.length > 0
      ? [`${t("inquiryMultipleCount")}: ${multiple.length}`, ...multiple.map((item) => `- ${item[lang].title} (${item.slug})`)]
      : [`${t(collaboration ? "collaborationLink" : "inquiryEyebrow")}: ${title}`, artwork ? `Artwork ID: ${artwork.slug}` : null];
    const lines = [
      `${t("inquiryReceiptRef")}: ${ref}`,
      ...artworkLines,
      `${t("fieldName")}: ${data.get("name")}`,
      `${t("fieldEmail")}: ${data.get("email")}`,
      `${t("fieldInquiryType")}: ${typeLabels[typeValue] ?? typeValue}`,
      ...projectRows.map(([key, value]) => `${t(key)}: ${value}`),
      artwork?.price && typeValue === "buy" ? `${t("detailPrice")}: ${recordPrice(artwork)}` : null,
      typeValue === "offer" && offer ? `${t("fieldOfferPrice")}: ${formatLocalizedPrice(Number(offer), "ko")}${artwork?.price ? ` (${t("detailPrice")} ${recordPrice(artwork)})` : ""}` : null,
      showPay && selectedPay ? `${t("fieldPayMethod")}: ${t(selectedPay)}` : null,
      phone ? `${t("fieldPhoneOptional")}: ${phone}` : null,
      String(data.get("message") ?? "").trim() ? `${t("fieldMessage")}: ${data.get("message")}` : null,
      ["buy", "offer", "photos"].includes(typeValue) ? `\n${t("registrationOwnerChecklist")}` : null,
      visitSourceLine(),
    ].filter(Boolean).join("\n");
    // Keep "ARTWORK INQUIRY" in every subject so one inbox search still
    // finds all of them; the type label lets a buy request stand out.
    const subject = `[Pote] ${collaboration ? t("collaborationLink") : t("inquiryEyebrow")} · ${typeLabels[typeValue] ?? typeValue} — ${title} (${ref})`;

    setPendingMessage({ subject, text: lines });
    try {
      const { source, medium, campaign, referrer, landing } = readVisitSource();
      const artworkSlugs = multiple.length > 0 ? multiple.map((item) => item.slug) : artwork ? [artwork.slug] : [];
      // Same id on a retry after an error, so the funnel counts this inquiry once.
      inquiryIdRef.current ??= newInquiryId();
      const analytics = inquiryAnalytics({ inquiryId: inquiryIdRef.current, receiptRef: ref, kind: isCollaborationType(typeValue) ? "collaboration" : artworkSlugs.length > 0 ? "artwork" : "general", intent: typeValue, artworks: artworkSlugs });
      await sendContact({ subject, text: lines, replyTo: String(data.get("email") ?? "").trim(), inquiry: { ref, type: typeValue, artworks: artworkSlugs, source, medium, campaign, referrer, landing }, analytics });
      inquiryIdRef.current = null;
      const rows: [ReceiptRowKey, string][] = [
        ["inquiryReceiptArtwork", multiple.length > 0 ? multiple.map((item) => item[lang].title).join(", ") : title],
      ];
      if (artwork?.price && typeValue === "buy") rows.push(["detailPrice", recordPrice(artwork)]);
      if (typeValue === "offer" && offer) rows.push(["fieldOfferPrice", formatLocalizedPrice(Number(offer), "ko")]);
      if (showPay && selectedPay) rows.push(["fieldPayMethod", t(selectedPay)]);
      rows.push(...projectRows);
      rows.push(["fieldName", String(data.get("name") ?? "").trim()]);
      if (phone) rows.push(["fieldPhoneOptional", phone]);
      const message = String(data.get("message") ?? "").trim();
      if (message) rows.push(["fieldMessage", message]);
      // Timestamp is created only in this submit handler, after the successful request.
      // eslint-disable-next-line react-hooks/purity
      const submitted: InquiryReceipt = { ref, type: typeValue, email: String(data.get("email") ?? "").trim(), rows: [...rows, ["fieldInquiryType", typeLabels[typeValue] ?? typeValue]], createdAt: Date.now(), hasArtworks: Boolean(artwork || multiple.length) };
      setReceipt(submitted);
      setReceiptStored(saveInquiryReceipt(storageKey, submitted));
      clearInquiryDraft(storageKey);
      setStatus("sent");
      requestAnimationFrame(() => {
        successRef.current?.focus({ preventScroll: true });
        successRef.current?.scrollIntoView({ block: "start" });
      });
    } catch (error) {
      trackInquiryStep("inquiry_error");
      setStatus((error as Error).message === "rate_limited" ? "limited" : "error");
    }
  };
  const newInquiry = () => {
    clearInquiryReceipt(storageKey);
    clearInquiryDraft(storageKey);
    draftFields.current = {};
    setDefaultFields({});
    setDraftStored(null);
    setPendingMessage(null);
    setReceipt(null);
    setReceiptStored(false);
    setType(initialType);
    setPay(null);
    setStatus("idle");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "start" });
      formRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus({ preventScroll: true });
    });
  };
  const sentAt = receipt ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(receipt.createdAt) : "";
  const downloadReceipt = () => {
    if (!receipt) return;
    const lines = ["Pote Gallery", `${t("inquiryReceiptRef")}: ${receipt.ref}`, `${t("inquiryReceiptSentAt")}: ${sentAt} (KST)`, ...receipt.rows.filter(([key]) => key !== "inquiryReceiptArtwork" || receipt.hasArtworks).map(([key, value]) => `${t(key)}: ${value}`), `${t("inquiryReceiptReplyTo")}: ${receipt.email}`];
    if (["buy", "offer"].includes(receipt.type)) lines.push("", t("inquiryReceiptNotPaid"));
    lines.push("", t("inquiryResponseTime"), INQUIRY_INBOX);
    const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pote-${receipt.ref}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (status === "sent" && receipt) {
    const receiptPurchase = receipt.type === "buy" || receipt.type === "offer";
    const receiptCollaboration = isCollaborationType(receipt.type);
    const steps: DictKey[] = receiptCollaboration ? ["collaborationNext1", "collaborationNext2"] : receiptPurchase ? ["inquiryNextBuy1", "inquiryNextBuy2", "inquiryNextBuy3"] : receipt.type === "photos" ? ["inquiryNextPhotos1", "inquiryNextPhotos2"] : ["inquiryNextAsk1", "inquiryNextAsk2"];
    return <div ref={successRef} tabIndex={-1} className="form-success inquiry-receipt" role="status">
      <span>✓</span>
      <h1><T k={receiptCollaboration ? "collaborationSuccess" : receiptPurchase ? "inquiryReceiptHeadingBuy" : "inquirySuccessHeading"} /></h1>
      <p className="inquiry-receipt-ref"><T k="inquiryReceiptRef" /> <strong>{receipt.ref}</strong></p>
      <p className="inquiry-receipt-save" role={receiptStored ? undefined : "alert"}><T k={receiptStored ? "inquiryReceiptSave" : "inquiryReceiptStorageUnavailable"} /></p>
      <div className="inquiry-receipt-actions inquiry-receipt-tools">
        <button className="primary-button" type="button" onClick={downloadReceipt}><T k="inquiryReceiptDownload" /></button>
        <button className="outline-button" type="button" onClick={newInquiry}><T k="inquiryReceiptNew" /></button>
      </div>
      <dl>
        <div><dt><T k="inquiryReceiptSentAt" /></dt><dd>{sentAt} (KST)</dd></div>
        {receipt.rows.filter(([key]) => key !== "inquiryReceiptArtwork" || receipt.hasArtworks).map(([key, value]) => <div key={key}><dt><T k={key} /></dt><dd>{value}</dd></div>)}
        <div><dt><T k="inquiryReceiptReplyTo" /></dt><dd>{receipt.email}</dd></div>
      </dl>
      {receiptPurchase ? <p className="inquiry-receipt-notpaid"><strong><T k="inquiryReceiptNotPaid" /></strong></p> : null}
      <h2><T k="inquiryReceiptNext" /></h2>
      <ol>{steps.map((key) => <li key={key}><T k={key} /></li>)}</ol>
      <p><strong><T k="inquiryResponseTime" /></strong> <T k="inquiryReceiptNoReply" /> <a href={`mailto:${INQUIRY_INBOX}?subject=${encodeURIComponent(receipt.ref)}`}>{INQUIRY_INBOX}</a></p>
      {receiptPurchase ? <p><T k="registrationBeforePay" /></p> : null}
      <div className="inquiry-receipt-actions">
        {artwork ? <Link className="outline-button" href={`/artworks/${artwork.slug}`}><T k="inquiryReceiptBack" /></Link> : null}
        <Link className="primary-button" href={receiptCollaboration ? "/" : "/artworks"}><T k={receiptCollaboration ? "collaborationBackHome" : "favBrowse"} /></Link>
      </div>
    </div>;
  }
  const fallbackText = pendingMessage ? [pendingMessage.subject, "", pendingMessage.text].join("\n") : "";
  const mailBody = pendingMessage ? encodeURIComponent(pendingMessage.text) : "";
  const fullMailFits = mailBody.length < 1600;
  const mailHref = pendingMessage ? `mailto:${INQUIRY_INBOX}?subject=${encodeURIComponent(pendingMessage.subject)}&body=${fullMailFits ? mailBody : encodeURIComponent(t("inquiryEmailPaste"))}` : "";
  const copyInquiry = async () => {
    try { await navigator.clipboard.writeText(fallbackText); setCopyState("copied"); }
    catch { setCopyState("manual"); fallbackRef.current?.focus(); fallbackRef.current?.select(); }
  };
  const downloadDraft = () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF", fallbackText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "Pote-unsent-inquiry.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <form ref={formRef} className="pote-form inquiry-form" onSubmit={submit} onChange={() => {
    if (!startedRef.current) { startedRef.current = true; trackInquiryStep("inquiry_start"); }
    saveDraft(); if (status === "error" || status === "limited") setStatus("idle");
  }} onInvalidCapture={() => { if (!invalidSentRef.current) { invalidSentRef.current = true; trackInquiryStep("inquiry_invalid"); } }}>
    <fieldset className="inquiry-inputs" disabled={status === "sending"}>
    <p className="eyebrow dark"><T k={collaboration ? "collaborationEyebrow" : "inquiryEyebrow"} /></p>
    <h1>{heading}</h1>
    {multiple.length > 0 ? <div className="inquiry-artwork-list">{multiple.map((item) => <Link className="inquiry-artwork" key={item.slug} href={`/artworks/${item.slug}`}><Image src={item.image} alt={item[lang].title} width={70} height={78} /><div><small>{getArtist(item.artistSlug).name[lang]}</small><strong>{item[lang].title}</strong></div></Link>)}</div>
      : artwork && <Link className="inquiry-artwork" href={`/artworks/${artwork.slug}`}><Image src={artwork.image} alt={title} width={100} height={110} /><div><small>{getArtist(artwork.artistSlug).name[lang]}</small><strong>{title}</strong><span className={artwork.statusKey === "sold" ? undefined : "artwork-price"}>{artwork.statusKey === "sold" ? artwork[lang].status : displayPrice(artwork)}</span>{!sold && lang === "en" && artworkPrice(artwork.price) !== null ? <small>{t("priceKrwReference")} · {formatLocalizedPrice(artworkPrice(artwork.price)!, "ko")}</small> : null}</div></Link>}
    {missingArtwork ? <p className="provisional-note" role="status"><T k="inquiryMissingArtwork" /> <Link href="/artworks"><T k="inquiryBrowseLink" /></Link></p> : null}
    <p><T k={collaboration ? "collaborationBody" : purchase ? "buyRequestBody" : type === "photos" ? "photosRequestBody" : artwork || multiple.length > 0 ? "inquiryBody" : "inquiryGeneralBody"} /></p>
    <p className="form-guide-link"><T k="inquiryResponseTime" /> {collaboration ? <Link href="/apply"><T k="homeArtistApply" /></Link> : !artwork && multiple.length === 0 ? <Link href="/artworks"><T k="inquiryBrowseLink" /></Link> : null}</p>
    <label><T k="fieldName" /><input required name="name" onChange={() => {}} value={defaultFields.name ?? ""} autoComplete="name" maxLength={120} /></label>
    <label><T k="fieldEmail" /><input required type="email" name="email" onChange={() => {}} value={defaultFields.email ?? ""} maxLength={254} autoComplete="email" /></label>
    <label><T k={collaboration ? "collaborationType" : "fieldInquiryType"} /><select name="type" value={type} onChange={(event) => setType(event.target.value)}>{collaboration ? collaborationOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>) : <><option value="buy" disabled={sold || (!artwork && multiple.length === 0)}>{t("optionBuy")}</option><option value="offer" disabled={sold || !artwork}>{t("optionOffer")}</option><option value="availability" disabled={sold}>{t("optionAvailability")}</option><option value="details">{t("optionDetails")}</option><option value="photos" disabled={sold}>{t("optionPhotos")}</option><option value="delivery">{t("optionDelivery")}</option><option value="other">{t("optionOther")}</option><option value="collaboration">{t("collaborationLink")}</option></>}</select></label>
    {collaboration ? <fieldset className="collaboration-fields"><legend><T k="collaborationProjectDetails" /></legend><p className="field-hint"><T k="collaborationOptionalHint" /></p>{collaborationFields.map((field) => <label key={field.name}><T k={field.label} /><input name={field.name} onChange={() => {}} value={defaultFields[field.name] ?? ""} type={field.inputType ?? "text"} maxLength={field.maxLength} placeholder={t(field.placeholder)} /></label>)}</fieldset> : null}
    {type === "offer" ? <label><T k="fieldOfferPrice" /><input required name="offer" onChange={() => {}} value={defaultFields.offer ?? ""} inputMode="numeric" pattern="[0-9,]*" maxLength={15} placeholder={artworkPrice(artwork?.price)?.toLocaleString("ko-KR") ?? ""} /><small className="field-hint"><T k="offerPriceHint" /></small></label> : null}
    <details className="inquiry-optional" >
      <summary><T k={messageOptional ? "inquiryOptionalDetails" : "fieldPhoneOptional"} /></summary>
      <p className="field-hint"><T k="inquiryOptionalHint" /></p>
    {showPay && payOptions.length > 0 ? <fieldset className="pay-options">
      <legend><T k="fieldPayMethod" /></legend>
      {payOptions.map((key) => <label key={key}><input type="radio" name="pay" value={key} checked={selectedPay === key} onChange={() => setPay(key)} /> <T k={key} /></label>)}
      <small className="field-hint"><T k={business ? "payBusinessNote" : "payIndividualNote"} /></small>
      {selectedPay === "paySplit" ? <ul className="pay-split-rules">{(["paySplitRule1", "paySplitRule2", "paySplitRule3", "paySplitRule4", "paySplitRule5"] as const).map((key) => <li key={key}><T k={key} /></li>)}</ul> : null}
    </fieldset> : null}
    <label><T k="fieldPhoneOptional" /><input name="phone" onChange={() => {}} value={defaultFields.phone ?? ""} type="tel" autoComplete="tel" maxLength={40} /></label>
      {messageOptional ? <><label><T k={collaboration ? "collaborationMessage" : messageOptional ? "fieldMessageOptional" : "fieldMessage"} /><textarea required={!messageOptional} name="message" onChange={() => {}} value={defaultFields.message ?? ""} maxLength={6000} rows={messageOptional ? 3 : 6} placeholder={t(collaboration ? "collaborationPlaceholder" : type === "photos" ? "photosMessagePlaceholder" : "fieldMessagePlaceholder")} /></label></> : null}
    </details>
    {!messageOptional ? <><label><T k={collaboration ? "collaborationMessage" : messageOptional ? "fieldMessageOptional" : "fieldMessage"} /><textarea required={!messageOptional} name="message" onChange={() => {}} value={defaultFields.message ?? ""} maxLength={6000} rows={messageOptional ? 3 : 6} placeholder={t(collaboration ? "collaborationPlaceholder" : type === "photos" ? "photosMessagePlaceholder" : "fieldMessagePlaceholder")} /></label></> : null}
    <p className="form-guide-link"><Link href={collaboration ? "/inquiry" : `/guide?${guideQuery}`} onClick={collaboration ? () => setType("other") : saveGuideDraft}><T k={collaboration ? "collaborationArtworkLink" : "inquiryGuideLink"} /></Link></p>
    {/* 신청을 결제로 오해하지 않게 보내기 바로 위에 거래 순서를 보여 준다(고객 임장 P0 #5).
        필수 체크는 개인정보 동의 하나만 둔다: 두 동의를 한 칸에 묶으면 동의 사항 구분(개인정보보호법 제22조)이 흐려진다. */}
    {purchase ? <p className="inquiry-not-payment"><T k="noticeNotPayment" /></p> : null}
    <label className="consent"><input required type="checkbox" /> <T k="consentInquiry" /></label>
    </fieldset>
    {draftStored !== null ? <p className="field-hint" role="status"><T k={draftStored ? "inquiryDraftSaved" : "inquiryDraftUnavailable"} /></p> : null}
    <button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? <T k="formSending" /> : <T k={collaboration ? "collaborationSubmit" : type === "buy" ? "submitBuyRequest" : type === "offer" ? "submitOffer" : "submitInquiry"} />}</button>
    {(status === "error" || status === "limited") && pendingMessage ? <section className="inquiry-send-fallback" aria-labelledby="inquiry-send-error">
      <p id="inquiry-send-error" role="alert"><T k={status === "limited" ? "commentsRateLimited" : "inquirySendUnconfirmed"} /></p>
      <p><T k="inquiryFailureHelp" /></p>
      <div className="inquiry-receipt-actions">
        <button className="outline-button" type="button" onClick={copyInquiry}><T k={copyState === "copied" ? "inquiryCopied" : "inquiryCopy"} /></button>
        <button className="outline-button" type="button" onClick={downloadDraft}><T k="inquiryDownloadDraft" /></button>
        <a className="outline-button" href={mailHref}><T k="inquiryOpenEmail" /></a>
      </div>
      {!fullMailFits ? <p className="field-hint"><T k="inquiryEmailPaste" /></p> : null}
      <p role="status">{copyState === "copied" ? t("inquiryCopied") : copyState === "manual" ? t("inquiryCopyManually") : ""}</p>
      <label><T k="inquiryUnsentContent" /><textarea ref={fallbackRef} readOnly value={fallbackText} rows={6} /></label>
      <EmailFallback address={INQUIRY_INBOX} />
    </section> : null}
    <small><T k="mvpNoteForm" /> <T k="inquiryResponseTime" /></small>
  </form>;
}

export function InquiryLoading() {
  // 자바스크립트가 실행되기 전(검색엔진, 링크 미리보기)에도 이 화면이 그대로
  // 노출되므로, "준비 중"처럼 읽히지 않는 실제 안내 문구를 둔다.
  return (
    <div className="pote-form inquiry-form">
      <p className="eyebrow dark"><T k="inquiryEyebrow" /></p>
      <h1><T k="inquiryFallbackHeading" /></h1>
      <p><T k="inquiryFallbackBody" /></p>
      <p className="form-guide-link"><Link href="/guide"><T k="inquiryGuideLink" /></Link></p>
      <p className="inquiry-loading-contact"><a href={`mailto:${INQUIRY_INBOX}`}>{INQUIRY_INBOX}</a></p>
      <small><T k="loadingInquiry" /></small>
    </div>
  );
}
