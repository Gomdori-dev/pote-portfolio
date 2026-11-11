"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AiReview } from "@/lib/artwork-review";
import AdminReviewNote from "@/components/AdminReviewNote";

type Preview = {
  status: "pending" | "approved" | "rejected";
  artist: string;
  title_ko: string;
  details_ko: string;
  description_ko: string;
  palette_ko: string;
  price: string | null;
  image_urls: string[];
  ai_review: AiReview | null;
};

const ERRORS: Record<string, string> = {
  invalid_token: "링크가 올바르지 않아요. 메일에 있는 링크를 그대로 열어 주세요.",
  not_found: "작품을 찾을 수 없어요. 이미 삭제됐을 수 있어요.",
};

export default function QuickApproveClient() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const token = params.get("t") ?? "";
  const endpoint = `/api/admin/submissions/${encodeURIComponent(id)}/quick-approve?t=${encodeURIComponent(token)}`;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(endpoint)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "unexpected_error");
        setPreview(data.submission);
      })
      .catch((err: Error) => setError(ERRORS[err.message] ?? "불러오지 못했어요. 잠시 뒤 다시 열어 주세요."));
  }, [endpoint]);

  const approve = async () => {
    setBusy(true);
    const response = await fetch(endpoint, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (response?.ok) setDone(true);
    else {
      const payload = await response?.json().catch(() => null);
      setError(payload?.error === "portalTranslationError" ? "영어 번역을 완료하지 못해 승인하지 않았어요. 잠시 뒤 다시 눌러 주세요." : response?.status === 409 ? "이미 처리된 작품이에요." : "승인하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
  };

  const review = preview?.ai_review;

  return (
    <main className="adm">
      <section className="adm-panel adm-quick">
        <p className="adm-eyebrow">POTE BACKSTAGE · 빠른 승인</p>
        {!preview && !error ? <p>불러오는 중…</p> : null}
        {preview ? (
          <div className="adm-sub" data-status={done ? "approved" : preview.status}>
            <div className="adm-sub-images">
              {preview.image_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={preview.title_ko} />
                </a>
              ))}
              {done ? <span className="adm-stamp adm-stamp-approved">승인</span> : null}
            </div>
            <div className="adm-sub-body">
              <p className="adm-sub-artist">{preview.artist}</p>
              <h3>{preview.title_ko}</h3>
              <p className={preview.image_urls.length > 1 ? "adm-sub-note" : "adm-sub-details"}>
                작품 1점 · 사진 {preview.image_urls.length}장
                {preview.image_urls.length > 1 ? " — 승인하면 모든 사진이 한 작품 페이지에 묶입니다. 서로 다른 작품이면 관리 화면에서 반려 후 각각 제출해 주세요." : ""}
              </p>
              <p className="adm-sub-details">{preview.details_ko}</p>
              <p className="adm-sub-desc">{preview.description_ko || "(소품 — 작품 설명 없음)"}</p>
              <ul className="adm-sub-tags">
                {preview.price ? <li>💰 {preview.price}</li> : null}
                {preview.palette_ko ? <li>🎨 {preview.palette_ko}</li> : null}
              </ul>
              <AdminReviewNote review={review} pending={!done && preview.status === "pending"} />
              {done ? (
                <p className="adm-review adm-review-pass">사이트에 걸렸어요.</p>
              ) : preview.status === "pending" ? (
                <div className="adm-sub-actions">
                  <button className="adm-btn adm-btn-primary" type="button" disabled={busy} onClick={approve}>
                    {busy ? "승인하는 중…" : "작품 1점 승인하고 벽에 걸기"}
                  </button>
                  <a className="adm-btn adm-btn-ghost" href="/admin/submissions">관리 화면에서 보기</a>
                </div>
              ) : (
                <p className="adm-review">이미 {preview.status === "approved" ? "승인" : "반려"}된 작품이에요.</p>
              )}
            </div>
          </div>
        ) : null}
        {error ? <p className="adm-error">{error}</p> : null}
      </section>
    </main>
  );
}
