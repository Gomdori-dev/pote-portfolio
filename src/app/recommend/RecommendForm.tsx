"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { EmailFallback } from "@/components/EmailFallback";
import { CANVAS_HO, canvasSizeCm } from "@/lib/canvas-size";
import { formatPriceBucket, PRICE_BUCKETS } from "@/lib/catalog";
import { T, useLanguage, useT } from "@/lib/i18n";
import { visitSourceLine } from "@/lib/visit-source";

const INBOX = "poteart.gallery@gmail.com";
const MAX_PHOTOS = 3;
const MAX_EDGE_PX = 1600;

// Phone photos are 3–8MB; downsizing to a 1600px JPEG in the browser keeps
// all three well under the serverless body limit and is still plenty to
// judge a wall's size, light and colour.
async function downsize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))), "image/jpeg", 0.82));
}

export function RecommendForm() {
  const { lang } = useLanguage();
  const t = useT();
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "limited">("idle");
  // Most visitors don't know their wall in cm off-hand, but a lot of Korean
  // buyers do think in canvas 호수 ("우리 집엔 20호 정도"). Picking one just
  // fills the same plain cm field below (F size's longer side, rounded) --
  // the curator email always gets a clean cm number either way.
  const [wall, setWall] = useState("");

  const spaces = [
    ["living", t("recommendSpaceLiving")],
    ["bedroom", t("recommendSpaceBedroom")],
    ["office", t("recommendSpaceOffice")],
    ["shop", t("recommendSpaceShop")],
    ["gift", t("recommendSpaceGift")],
    ["other", t("recommendSpaceOther")],
  ] as const;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    const data = new FormData(event.currentTarget);
    const budgetIndex = String(data.get("budget") ?? "");
    const budget = budgetIndex && PRICE_BUCKETS[Number(budgetIndex)] ? formatPriceBucket(PRICE_BUCKETS[Number(budgetIndex)], "ko") : t("catalogAnyBudget");
    const space = spaces.find(([key]) => key === data.get("space"))?.[1] ?? "";
    const summary = [
      `${t("fieldName")}: ${data.get("name")}`,
      `${t("fieldEmail")}: ${data.get("email")}`,
      `${t("recommendSpace")}: ${space}`,
      data.get("wall") ? `${t("recommendWall")}: ${data.get("wall")}` : null,
      `${t("recommendBudget")}: ${budget}`,
      String(data.get("taste") ?? "").trim() ? `${t("recommendTaste")}: ${data.get("taste")}` : null,
      visitSourceLine(),
    ].filter(Boolean).join("\n");

    try {
      const body = new FormData();
      body.set("name", String(data.get("name") ?? ""));
      body.set("email", String(data.get("email") ?? ""));
      body.set("summary", summary);
      for (const [index, photo] of photos.entries()) body.append("photo", await downsize(photo), `room-${index + 1}.jpg`);
      const response = await fetch("/api/recommend", { method: "POST", body, signal: AbortSignal.timeout(40_000) });
      if (response.status === 429) throw new Error("rate_limited");
      if (!response.ok) throw new Error("send_failed");
      setStatus("sent");
    } catch (error) {
      setStatus((error as Error).message === "rate_limited" ? "limited" : "error");
    }
  };

  if (status === "sent") return <div className="form-success" role="status"><span>✓</span><h1><T k="recommendSuccessHeading" /></h1><p><T k="recommendSuccessBody" /></p><Link className="primary-button" href="/artworks"><T k="favBrowse" /></Link></div>;

  return <form className="pote-form" onSubmit={submit}>
    <p className="eyebrow dark"><T k="recommendEyebrow" /></p>
    <h1 className="recommend-heading"><T k="recommendHeading" /></h1>
    <p><T k="recommendBody" /></p>
    <label><T k="fieldName" /><input required name="name" autoComplete="name" maxLength={120} /></label>
    <label><T k="fieldEmail" /><input required type="email" name="email" maxLength={254} autoComplete="email" /></label>
    <label>
      <T k="recommendPhotos" />
      <input type="file" accept="image/*" multiple onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        setPhotoError(files.length > MAX_PHOTOS);
        setPhotos(files.slice(0, MAX_PHOTOS));
      }} />
      <small className="field-hint">{photoError ? <T k="recommendPhotosTooMany" /> : <T k="recommendPhotosNote" />}</small>
    </label>
    <label><T k="recommendSpace" /><select name="space" defaultValue="living">{spaces.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>
      <T k="recommendWall" />
      <input name="wall" inputMode="numeric" pattern="[0-9]*" maxLength={5} value={wall} onChange={(event) => setWall(event.target.value)} />
    </label>
    <label className="recommend-wall-ho">
      <T k="recommendWallHo" />
      <select
        value=""
        aria-label={t("recommendWallHoChoose")}
        onChange={(event) => {
          const ho = Number(event.target.value);
          const size = ho ? canvasSizeCm(ho, "F") : null;
          if (size) setWall(String(Math.round(size[0])));
        }}
      >
        <option value="">{t("recommendWallHoChoose")}</option>
        {CANVAS_HO.map((ho) => <option key={ho} value={ho}>{ho}호</option>)}
      </select>
    </label>
    <label><T k="recommendBudget" /><select name="budget" defaultValue=""><option value="">{t("catalogAnyBudget")}</option>{PRICE_BUCKETS.map((bucket, index) => <option key={index} value={index}>{formatPriceBucket(bucket, lang)}</option>)}</select></label>
    <label><T k="recommendTaste" /><textarea name="taste" maxLength={2000} rows={3} placeholder={t("recommendTastePlaceholder")} /></label>
    <label className="consent"><input required type="checkbox" /> <T k="consentRecommend" /></label>
    <button className="primary-button" type="submit" disabled={status === "sending"}>{status === "sending" ? <T k={photos.length ? "recommendPhotosPreparing" : "formSending"} /> : <T k="recommendSubmit" />}</button>
    {status === "error" ? <p className="provisional-note" role="alert"><T k="formSendError" /> <EmailFallback address={INBOX} /></p> : null}
    {status === "limited" ? <p className="provisional-note" role="alert"><T k="commentsRateLimited" /> <EmailFallback address={INBOX} /></p> : null}
    <small><T k="inquiryResponseTime" /></small>
  </form>;
}
