"use client";

import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { MOOD_DICT_KEY, MOOD_ORDER, type MoodKey } from "@/lib/artists";
import { T, useLanguage, useT, type Lang } from "@/lib/i18n";

const LANG_TABS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
];

const STORAGE_KEY = "pote_studio_key";

type Translation = { description: string; snsCaption: string; idealFor: string };

type ToolResult = {
  suggestedMood: MoodKey;
  priceRangeMin: number;
  priceRangeMax: number;
  priceNote: string;
  translations: Record<Lang, Translation>;
};

const MAX_DIMENSION = 1600;

/** 카카오톡 등에서 받은 원본 고해상도 사진은 그대로 올리면 서버 요청 용량 제한(413)에 걸릴 수 있어, 캔버스로 리사이즈·재압축한 뒤 base64로 변환한다. */
function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const [, data] = dataUrl.split(",");
      resolve({ data, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image load failed"));
    };
    img.src = objectUrl;
  });
}

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없는 환경이면 조용히 무시 (버튼은 그대로 남아있어 다시 시도 가능)
    }
  };

  return (
    <button type="button" className="copy-button" onClick={copy}>
      {copied ? t("studioCopied") : t("studioCopy")}
    </button>
  );
}

export default function ArtistStudioPage() {
  const { lang } = useLanguage();
  const t = useT();

  const [studioKey, setStudioKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // sessionStorage는 서버에 없으므로 마운트 후(클라이언트에서만) 확인해 하이드레이션 불일치를 피한다.
  // useFavorites.ts와 동일하게 queueMicrotask로 감싸 effect 본문에서 직접 setState하지 않는다.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.sessionStorage.getItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
    if (stored) {
      queueMicrotask(() => {
        setStudioKey(stored);
        setUnlocked(true);
      });
    }
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [medium, setMedium] = useState("");
  const [workMedium, setWorkMedium] = useState("painting");
  const [size, setSize] = useState("");
  const [moodKey, setMoodKey] = useState<MoodKey | "">("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("ko");

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/artist-studio-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: passwordInput }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setAuthError(t("studioAuthWrongPassword"));
        return;
      }
      try { window.sessionStorage.setItem(STORAGE_KEY, passwordInput); } catch { /* Keep this session usable. */ }
      setStudioKey(passwordInput);
      setUnlocked(true);
    } catch {
      setAuthError(t("studioAuthGenericError"));
    } finally {
      setAuthLoading(false);
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setGenError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
  };

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setGenError(t("studioErrorNoFile"));
      return;
    }
    setGenerating(true);
    setGenError("");
    setResult(null);
    try {
      const { data, mimeType } = await fileToBase64(file);
      const response = await fetch("/api/artist-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-studio-key": studioKey },
        body: JSON.stringify({ imageBase64: data, mimeType, medium, size, workMedium, moodKey: moodKey || undefined }),
        signal: AbortSignal.timeout(60_000),
      });

      if (response.status === 401) {
        try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
        setUnlocked(false);
        setStudioKey("");
        setAuthError(t("studioErrorExpiredKey"));
        return;
      }
      if (response.status === 413) {
        setGenError(t("studioErrorTooLarge"));
        return;
      }
      if (response.status === 422) {
        const payload = await response.json().catch(() => null);
        setGenError(payload?.reason ? `${t("studioErrorNotArtwork")} (${payload.reason})` : t("studioErrorNotArtwork"));
        return;
      }
      if (!response.ok) {
        setGenError(t("studioErrorGeneric"));
        return;
      }
      const payload = await response.json();
      setResult(payload.result as ToolResult);
      setActiveLang(lang);
    } catch {
      setGenError(t("studioErrorNetwork"));
    } finally {
      setGenerating(false);
    }
  };

  if (!unlocked) {
    return (
      <>
        <SiteHeader />
        <main key="locked" className="apply-page artist-studio-page">
          <section className="apply-intro">
            <p className="eyebrow">
              <T k="studioAuthEyebrow" />
            </p>
            <h1>
              <T k="studioAuthHeading" />
            </h1>
            <p>
              <T k="studioAuthIntro" />
            </p>
          </section>
          <form className="pote-form artist-form" onSubmit={unlock}>
            <label>
              <T k="studioPasswordLabel" />
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? t("studioAuthSubmitting") : t("studioAuthSubmit")}
            </button>
            {authError ? <p className="provisional-note">{authError}</p> : null}
          </form>
        </main>
      </>
    );
  }

  const activeTranslation = result?.translations?.[activeLang];
  const priceText = result ? (result.priceRangeMin > 0 && result.priceRangeMax > 0 ? `${result.priceRangeMin.toLocaleString()}원 ~ ${result.priceRangeMax.toLocaleString()}원` : t("studioPriceUnavailable")) : "";

  return (
    <>
      <SiteHeader />
      <main key="unlocked" className="apply-page artist-studio-page">
        <section className="apply-intro">
          <p className="eyebrow">
            <T k="studioEyebrow" />
          </p>
          <h1>
            <T k="studioHeading" />
          </h1>
          <p>
            <T k="studioIntro" />
          </p>
          <p className="provisional-note">
            <T k="studioPriceDisclaimer" />
          </p>

          {result ? (
            <div className="studio-result">
              <div className="studio-lang-tabs" role="tablist" aria-label={t("languageSelectorLabel")}>
                {LANG_TABS.map((locale) => (
                  <button
                    key={locale.code}
                    type="button"
                    role="tab"
                    aria-selected={activeLang === locale.code}
                    className={activeLang === locale.code ? "active" : ""}
                    onClick={() => setActiveLang(locale.code)}
                  >
                    {locale.label}
                  </button>
                ))}
              </div>

              <div className="studio-result-card">
                <div className="studio-card-head">
                  <h2>
                    <T k="studioCardDescription" />
                  </h2>
                  {activeTranslation ? <CopyButton text={activeTranslation.description} /> : null}
                </div>
                <p>{activeTranslation?.description}</p>
              </div>

              <div className="studio-result-card">
                <div className="studio-card-head">
                  <h2>
                    <T k="studioCardCaption" />
                  </h2>
                  {activeTranslation ? <CopyButton text={activeTranslation.snsCaption} /> : null}
                </div>
                <p>{activeTranslation?.snsCaption}</p>
              </div>

              <div className="studio-result-card">
                <div className="studio-card-head">
                  <h2>
                    <T k="studioCardIdealFor" />
                  </h2>
                  {activeTranslation ? <CopyButton text={activeTranslation.idealFor} /> : null}
                </div>
                <p>{activeTranslation?.idealFor}</p>
              </div>

              <div className="studio-result-card">
                <div className="studio-card-head">
                  <h2>
                    <T k="studioCardMood" />
                  </h2>
                </div>
                <p>
                  {t(MOOD_DICT_KEY[result.suggestedMood])}
                  {moodKey === result.suggestedMood ? ` ${t("studioMoodApplied")}` : ""}
                </p>
                {moodKey !== result.suggestedMood ? (
                  <button type="button" className="copy-button" onClick={() => setMoodKey(result.suggestedMood)}>
                    <T k="studioApplyMood" />
                  </button>
                ) : null}
              </div>

              <div className="studio-result-card">
                <div className="studio-card-head">
                  <h2>
                    <T k="studioCardPrice" />
                  </h2>
                  <CopyButton text={priceText} />
                </div>
                <p className="studio-price">{priceText}</p>
                <p className="provisional-note">{result.priceNote}</p>
              </div>
            </div>
          ) : null}
        </section>

        <form className="pote-form artist-form" onSubmit={generate}>
          <label>
            <T k="studioPhotoLabel" />
            <input type="file" accept="image/*" onChange={onFileChange} required />
          </label>
          {previewUrl ? (
            <div className="studio-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={t("studioPhotoAlt")} />
            </div>
          ) : null}
          <label><T k="registrationMedium" /><select value={workMedium} onChange={event => setWorkMedium(event.target.value)}><option value="painting">{t("mediumPainting")}</option><option value="print">{t("mediumPrint")}</option><option value="craft">{t("mediumCraft")}</option><option value="photo">{t("mediumPhoto")}</option></select></label>
          <label>
            <T k="studioMediumLabel" />
            <input value={medium} onChange={(event) => setMedium(event.target.value)} placeholder={t("studioMediumPlaceholder")} />
          </label>
          <label>
            <T k="studioSizeLabel" />
            <input value={size} onChange={(event) => setSize(event.target.value)} placeholder={t("studioSizePlaceholder")} />
          </label>
          <label>
            <T k="studioMoodLabel" />
            <select value={moodKey} onChange={(event) => setMoodKey(event.target.value as MoodKey | "")}>
              <option value="">{t("studioMoodNone")}</option>
              {MOOD_ORDER.map((key) => (
                <option key={key} value={key}>
                  {t(MOOD_DICT_KEY[key])}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={generating}>
            {generating ? t("studioSubmitLoading") : t("studioSubmitIdle")}
          </button>
          {genError ? <p className="provisional-note">{genError}</p> : null}
        </form>
      </main>
    </>
  );
}
