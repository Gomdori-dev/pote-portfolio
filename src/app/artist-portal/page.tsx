"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { MOOD_DICT_KEY, MOOD_ORDER, artists, type ArtistSlug, type MoodKey, type StatusKey } from "@/lib/artists";
import { artistThumb } from "@/lib/artist-portraits";
import { FRAME_KEYS, FRAME_LABEL_KEY, FRAME_MATERIALS, FRAME_MATERIAL_LABEL_KEY, PROOF_KEYS, PROOF_LABEL_KEY, type FrameKey, type FrameMaterial, type ProofKey } from "@/lib/artwork-extras";
import { T, useLanguage, useT, type DictKey } from "@/lib/i18n";
import { CANVAS_HO, CANVAS_SHAPES, canvasSizeCm, type CanvasShape } from "@/lib/canvas-size";
import type { ManagedWork, WorkAction } from "@/lib/artwork-controls";
import { parseArtworkExtras, type ArtworkExtras } from "@/lib/artwork-extras";
import { resizeImage } from "@/lib/portal-image";
import { ArtworkRegistrationEditor } from "@/components/ArtworkRegistrationEditor";
import { ArtworkRegistrationFields } from "@/components/ArtworkRegistrationFields";
import { registrationError, validRegistrationYear } from "@/lib/artwork-registration";

const STORAGE_KEY = "pote_portal_artist";


const statusDictKey: Record<StatusKey, "statusOptionAvailable" | "statusOptionSold" | "statusOptionPending"> = {
  available: "statusOptionAvailable",
  sold: "statusOptionSold",
  pending: "statusOptionPending",
};
const statusOrder: StatusKey[] = ["available", "sold", "pending"];

const statusLabelDictKey: Record<string, "portalStatusPending" | "portalStatusApproved" | "portalStatusRejected"> = {
  pending: "portalStatusPending",
  approved: "portalStatusApproved",
  rejected: "portalStatusRejected",
};

type Submission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  price: string | null;
  image_urls: string[];
  admin_note: string | null;
  created_at: string;
  extras?: ArtworkExtras;
};

export default function ArtistPortalPage() {
  const { lang } = useLanguage();
  const t = useT();

  const [artistSlug, setArtistSlug] = useState<ArtistSlug | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSlug | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [adminView, setAdminView] = useState(false);

  useEffect(() => {
    // 관리자 화면의 "포털 보기"는 /api/admin/view-as-artist로 작가 세션 쿠키를 받은 뒤
    // ?admin=<slug>로 연다. 쿠키가 없으면 이후 API가 전부 401이라 이 값만으로는 아무것도 못 한다.
    const viewAs = new URLSearchParams(window.location.search).get("admin");
    if (viewAs && Object.hasOwn(artists, viewAs)) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, viewAs);
      } catch {
        /* Storage is optional. */
      }
      queueMicrotask(() => {
        setArtistSlug(viewAs as ArtistSlug);
        setAdminView(true);
      });
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* Storage is optional. */
    }
    if (stored && Object.hasOwn(artists, stored)) {
      queueMicrotask(() => setArtistSlug(stored as ArtistSlug));
    }
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedArtist) {
      setLoginError(t("portalChooseArtistError"));
      return;
    }
    setLoginError("");
    setLoginLoading(true);
    try {
      const response = await fetch("/api/artist-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistSlug: selectedArtist, password: passwordInput }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setLoginError(t("portalLoginError"));
        return;
      }
      try {
        window.sessionStorage.setItem(STORAGE_KEY, selectedArtist);
      } catch {
        /* Keep this session usable even without storage. */
      }
      setArtistSlug(selectedArtist);
      setPasswordInput("");
    } catch {
      setLoginError(t("portalLoginErrorNetwork"));
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/artist-auth/logout", { method: "POST" });
    } catch {
      /* Best effort — the cookie will also just expire on its own. */
    }
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage is optional. */
    }
    setArtistSlug(null);
    setAdminView(false);
  };

  if (!artistSlug) {
    return (
      <>
        <SiteHeader />
        <main className="pt pt-entrance">
          <div className="pt-entrance-card">
            <p className="pt-eyebrow">
              <T k="portalEyebrow" />
            </p>
            <h1>
              <T k="portalLoginHeading" />
            </h1>
            <p className="pt-muted">
              <T k="portalLoginIntro" />
            </p>
            <form onSubmit={login}>
              <fieldset className="pt-picker">
                <legend>
                  <T k="portalChooseArtist" />
                </legend>
                <div className="pt-picker-grid">
                  {Object.values(artists).map((artist) => {
                    const photo = artistThumb(artist.slug);
                    return (
                      <button
                        key={artist.slug}
                        type="button"
                        className="pt-pick"
                        aria-pressed={selectedArtist === artist.slug}
                        onClick={() => {
                          setSelectedArtist(artist.slug);
                          setLoginError("");
                        }}
                      >
                        <span className="pt-avatar">
                                                    {photo ? <NextImage src={photo} alt="" width={128} height={128} loading="eager" /> : <span>{artist.name.ko.slice(0, 1)}</span>}
                        </span>
                        <span className="pt-pick-name">{artist.name[lang]}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="pt-field">
                <span>
                  <T k="portalPasswordLabel" />
                  {selectedArtist ? <em> · {artists[selectedArtist].name[lang]}</em> : null}
                </span>
                <input type="password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} required />
              </label>
              <button className="pt-btn pt-btn-primary pt-btn-block" type="submit" disabled={loginLoading}>
                {loginLoading ? t("portalLoginSubmitting") : t("portalLoginSubmit")}
              </button>
              {loginError ? <p className="pt-error">{loginError}</p> : null}
            </form>
          </div>
        </main>
      </>
    );
  }

  return <PortalDashboard artistSlug={artistSlug} adminView={adminView} onLogout={logout} />;
}

function PortalDashboard({ artistSlug, adminView, onLogout }: { artistSlug: ArtistSlug; adminView: boolean; onLogout: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const photo = artistThumb(artistSlug);
  const artist = artists[artistSlug];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/artist-submissions")
      .then((response) => (response.ok ? response.json() : { submissions: [] }))
      .then((data) => {
        if (!cancelled) setSubmissions(data.submissions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [artistSlug, reloadKey]);

  const count = (status: Submission["status"]) => (submissions ?? []).filter((s) => s.status === status).length;

  return (
    <>
      <SiteHeader />
      <main className="pt">
        {adminView ? (
          <p className="portal-admin-banner" role="status">
            🔑 {t("portalAdminViewNotice").replace("{name}", artist.name[lang])}
          </p>
        ) : null}

        <header className="pt-hero">
          <span className="pt-hero-avatar">
                        {photo ? <NextImage src={photo} alt="" width={208} height={208} preload /> : <span>{artist.name.ko.slice(0, 1)}</span>}
          </span>
          <div className="pt-hero-copy">
            <p className="pt-eyebrow">
              <T k="portalEyebrow" />
            </p>
            <h1>
              {artist.name[lang]}
              {t("portalWelcome")}
            </h1>
            <div className="pt-hero-links">
              <a className="pt-btn pt-btn-ghost" href={`/artists/${artistSlug}`} target="_blank" rel="noopener noreferrer">
                <T k="portalViewMyPage" /> ↗
              </a>
              <button className="pt-btn pt-btn-quiet" type="button" onClick={onLogout}>
                <T k="portalLogout" />
              </button>
            </div>
          </div>
          <dl className="pt-stats">
            <div>
              <dt><T k="portalStatusPending" /></dt>
              <dd>{submissions ? count("pending") : "–"}</dd>
            </div>
            <div>
              <dt><T k="portalStatusApproved" /></dt>
              <dd>{submissions ? count("approved") : "–"}</dd>
            </div>
            <div>
              <dt><T k="portalStatusRejected" /></dt>
              <dd>{submissions ? count("rejected") : "–"}</dd>
            </div>
          </dl>
        </header>

        <div className="pt-layout">
          <UploadForm onSubmitted={() => setReloadKey((key) => key + 1)} />
          <aside className="pt-side">
            <SubmissionStatusList submissions={submissions} onChanged={() => setReloadKey((key) => key + 1)} />
            <details className="pt-card pt-password">
              <summary>
                <T k="portalPasswordHeading" />
              </summary>
              <ChangePasswordForm />
            </details>
          </aside>
        </div>
        <MyWorksManager reloadKey={reloadKey} onChanged={() => setReloadKey((key) => key + 1)} />
      </main>
    </>
  );
}

const PORTAL_CONFIRM_KEY: Record<WorkAction, DictKey> = {
  hide: "portalWorksConfirmHide",
  show: "portalWorksConfirmShow",
  sold: "portalWorksConfirmSold",
  available: "portalWorksConfirmAvailable",
  delete: "portalWorksConfirmDelete",
};

/** 작가가 자기 작품에 한 번 행동한다. 서버가 세션의 작가와 작품 주인을 다시 비교한다. */
async function artistWorkAction(slug: string, action: WorkAction) {
  const response = await fetch("/api/artist-works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, action }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

/** 사이트에 걸린 내 작품: 내리기·다시 걸기·판매완료·삭제. 다른 작가 작품은 목록에 오지도 않는다. */
function MyWorksManager({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [works, setWorks] = useState<ManagedWork[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proofOpen, setProofOpen] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/artist-works")
      .then((response) => (response.ok ? response.json() : { works: [] }))
      .then((data) => {
        if (!cancelled) setWorks(data.works ?? []);
      })
      .catch(() => {
        if (!cancelled) setWorks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const act = async (work: ManagedWork, action: WorkAction) => {
    const title = lang === "ko" ? work.title_ko : work.title_en;
    if (!window.confirm(t(PORTAL_CONFIRM_KEY[action]).replace("{title}", title))) return;
    setBusy(true);
    setError("");
    if (!(await artistWorkAction(work.slug, action))) setError(t("portalWorksError"));
    setBusy(false);
    onChanged();
  };

  return (
    <section className="pt-card pt-works">
      <div className="pt-card-head">
        <p className="pt-eyebrow">ON THE WALL</p>
        <h2><T k="portalWorksHeading" /></h2>
        <p className="pt-muted"><T k="portalWorksIntro" /></p>
      </div>
      {error ? <p className="pt-error">{error}</p> : null}
      {works === null ? (
        <p className="pt-muted">…</p>
      ) : works.length === 0 ? (
        <p className="pt-muted"><T k="portalWorksEmpty" /></p>
      ) : (
        <ul className="pt-works-list">
          {works.map((work) => (
            <li key={work.slug} data-off={work.hidden}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={work.image} alt="" loading="lazy" />
              <div>
                <strong>{lang === "ko" ? work.title_ko : work.title_en}</strong>
                <span className="pt-works-tags">
                  <span className={`pt-pill ${work.hidden ? "pt-pill-rejected" : "pt-pill-approved"}`}>{t(work.hidden ? "portalWorksHidden" : "portalWorksLive")}</span>
                  {work.statusKey === "sold" ? <span className="pt-pill pt-pill-pending">{t("portalWorksSold")}</span> : null}
                </span>
              </div>
              <div className="pt-works-actions">
                <button type="button" aria-expanded={imageOpen === work.slug} disabled={busy} onClick={() => setImageOpen((open) => (open === work.slug ? null : work.slug))}>{t("portalMainImageEdit")}</button>
                <button type="button" aria-expanded={editOpen === work.slug} disabled={busy} onClick={() => setEditOpen((open) => (open === work.slug ? null : work.slug))}>{t("portalCopyEdit")}</button>
                <button type="button" aria-expanded={registrationOpen === work.slug} disabled={busy} onClick={() => setRegistrationOpen((open) => (open === work.slug ? null : work.slug))}>{t("registrationEdit")}</button>
                <button type="button" disabled={busy} onClick={() => act(work, work.hidden ? "show" : "hide")}>{t(work.hidden ? "portalWorksShow" : "portalWorksHide")}</button>
                <button type="button" disabled={busy} onClick={() => act(work, work.statusKey === "sold" ? "available" : "sold")}>{t(work.statusKey === "sold" ? "portalWorksMarkAvailable" : "portalWorksMarkSold")}</button>
                <button type="button" aria-expanded={proofOpen === work.slug} disabled={busy} onClick={() => setProofOpen((open) => (open === work.slug ? null : work.slug))}>{t("portalProofManageButton").replace("{n}", String(PROOF_KEYS.filter((key) => work.proof[key]).length))}</button>
                <button type="button" className="pt-works-danger" disabled={busy} onClick={() => act(work, "delete")}>{t("portalWorksDelete")}</button>
              </div>
              {imageOpen === work.slug ? <MainImageEditor key={work.slug} slug={work.slug} currentImage={work.image} onSaved={() => { setImageOpen(null); onChanged(); }} /> : null}
              {editOpen === work.slug ? <ArtworkCopyEditor key={`${work.slug}-${lang}`} slug={work.slug} title={lang === "ko" ? work.title_ko : work.title_en} description={lang === "ko" ? work.description_ko : work.description_en} details={lang === "ko" ? work.details_ko : work.details_en} price={work.price} onSaved={() => { setEditOpen(null); onChanged(); }} onCancel={() => setEditOpen(null)} /> : null}
              {proofOpen === work.slug ? <ProofPhotosManager work={work} onChanged={onChanged} /> : null}
              {registrationOpen === work.slug ? <ArtworkRegistrationEditor key={`${work.slug}-${lang}`} slug={work.slug} extras={work.extras} price={work.price} onSaved={() => { setRegistrationOpen(null); onChanged(); }} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 이미 걸린 작품의 실물 확인 사진(서명·뒷면·옆면)을 칸마다 올리고 바꾸고 지운다.
 * 새 작품 등록의 "실물 확인 사진" 칸과 같은 곳(extras.proof)에 저장돼 작품 페이지 사진 줄에 붙는다.
 * 작품 주인 확인은 서버(/api/artist-works/proof)가 한다.
 */
function ProofPhotosManager({ work, onChanged }: { work: ManagedWork; onChanged: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [pending, setPending] = useState<ProofKey | null>(null);
  const [error, setError] = useState("");

  const upload = async (key: ProofKey, file: File | undefined) => {
    if (!file) return;
    setPending(key);
    setError("");
    const form = new FormData();
    form.set("slug", work.slug);
    form.set("key", key);
    form.set("image", await resizeImage(file).catch(() => file));
    const response = await fetch("/api/artist-works/proof", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) }).catch(() => null);
    setPending(null);
    if (!response?.ok) setError(t("portalWorksError"));
    onChanged();
  };

  const remove = async (key: ProofKey) => {
    const title = lang === "ko" ? work.title_ko : work.title_en;
    if (!window.confirm(t("portalProofConfirmRemove").replace("{title}", title).replace("{kind}", t(PROOF_LABEL_KEY[key])))) return;
    setPending(key);
    setError("");
    const response = await fetch("/api/artist-works/proof", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: work.slug, key }),
    }).catch(() => null);
    setPending(null);
    if (!response?.ok) setError(t("portalWorksError"));
    onChanged();
  };

  return (
    <div className="pt-proof-manage">
      <p className="pt-muted">{t("portalProofManageIntro")}</p>
      {error ? <p className="pt-error">{error}</p> : null}
      <ul>
        {PROOF_KEYS.map((key) => {
          const url = work.proof[key];
          const inputId = `pt-proof-${work.slug}-${key}`;
          return (
            <li key={key}>
              <span className="pt-proof-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url ? <img src={url} alt="" loading="lazy" /> : <span aria-hidden="true">+</span>}
              </span>
              <span className="pt-proof-body">
                <strong>{t(PROOF_LABEL_KEY[key])}</strong>
                <small>{t(`${PROOF_LABEL_KEY[key]}Hint`)}</small>
                <input
                  id={inputId}
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={pending !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void upload(key, file);
                  }}
                />
                <span className="pt-proof-actions">
                  <label htmlFor={inputId} aria-disabled={pending !== null}>
                    {pending === key ? t("portalProofUploading") : t(url ? "portalProofReplace" : "portalProofAdd")}
                  </label>
                  {url ? <button type="button" className="pt-works-danger" disabled={pending !== null} onClick={() => remove(key)}>{t("portalProofRemove")}</button> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SHAPE_LABEL_KEY: Record<CanvasShape, DictKey> = { F: "portalHoShapeF", P: "portalHoShapeP", M: "portalHoShapeM", S: "portalHoShapeS" };

/**
 * 호수(10호, 20호 P…)를 고르면 가로·세로 cm를 채워 준다. 저장은 cm로만 한다.
 * 작품 크기가 표준에서 몇 mm 다르면 작가가 cm 칸을 직접 고치면 된다.
 */
function HoPicker({ onPick }: { onPick: (width: string, height: string) => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [ho, setHo] = useState("");
  const [shape, setShape] = useState<CanvasShape>("F");
  const [landscape, setLandscape] = useState(false);

  const apply = (nextHo: string, nextShape: CanvasShape, nextLandscape: boolean) => {
    const size = canvasSizeCm(Number(nextHo), nextShape);
    if (!size) return;
    const [long, short] = size;
    const [width, height] = nextLandscape ? [long, short] : [short, long];
    onPick(String(width), String(height));
  };

  return (
    <div className="pt-ho" role="group" aria-label={t("portalHoLabel")}>
      <span>{t("portalHoLabel")}</span>
      <div>
        <select value={ho} aria-label={t("portalHoChoose")} onChange={(event) => { setHo(event.target.value); apply(event.target.value, shape, landscape); }}>
          <option value="">{t("portalHoChoose")}</option>
          {CANVAS_HO.map((value) => (
            <option key={value} value={value}>{value}{lang === "ko" ? "호" : ""}</option>
          ))}
        </select>
        <select value={shape} aria-label={t("portalHoShape")} onChange={(event) => { const next = event.target.value as CanvasShape; setShape(next); apply(ho, next, landscape); }}>
          {CANVAS_SHAPES.map((key) => (
            <option key={key} value={key}>{t(SHAPE_LABEL_KEY[key])}</option>
          ))}
        </select>
        <select value={landscape ? "landscape" : "portrait"} aria-label={t("portalHoDirection")} disabled={shape === "S"} onChange={(event) => { const next = event.target.value === "landscape"; setLandscape(next); apply(ho, shape, next); }}>
          <option value="portrait">{t("portalHoPortrait")}</option>
          <option value="landscape">{t("portalHoLandscape")}</option>
        </select>
      </div>
    </div>
  );
}

/**
 * "여러 작품 한 번에" 모드에서 사진 한 장(= 작품 한 점)마다 따로 적는 값.
 * 비어 있는 칸은 위의 공통 칸 값을 쓴다.
 */
type WorkOverride = {
  title: string;
  price: string;
  description: string;
  material: string;
  width: string;
  height: string;
  year: string;
  frame: FrameKey | "";
  depth: string;
  edition: string;
  facts: ArtworkExtras;
  conditionPhoto?: File;
};

const EMPTY_OVERRIDE: WorkOverride = { title: "", price: "", description: "", material: "", width: "", height: "", year: "", frame: "", depth: "", edition: "", facts: {} };

function UploadForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [titleKo, setTitleKo] = useState("");
  const [descriptionKo, setDescriptionKo] = useState("");
  const [materialKo, setMaterialKo] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [year, setYear] = useState("");
  const [paletteKo, setPaletteKo] = useState("");
  const [moodKey, setMoodKey] = useState<MoodKey>("quiet");
  const [statusKey, setStatusKey] = useState<StatusKey>("available");
  const [price, setPrice] = useState("");
  const [frame, setFrame] = useState<FrameKey | "">("");
  const [frameMaterial, setFrameMaterial] = useState<FrameMaterial | "">("");
  const [framedWidthCm, setFramedWidthCm] = useState("");
  const [framedHeightCm, setFramedHeightCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [edition, setEdition] = useState("");
  const [facts, setFacts] = useState<ArtworkExtras>({});
  // 실물 확인 사진: 칸마다 한 장(선택). 여러 작품 한 번에 올리기에서는 받지 않는다.
  const [proof, setProof] = useState<Partial<Record<ProofKey, File>>>({});
  const [proofInputKey, setProofInputKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  // 여러 작품 한 번에 올리기: 사진 한 장이 작품 한 점이 되고, works[i]가 그 사진만의 값이다.
  const [batch, setBatch] = useState(true);
  const [sameArtworkConfirmed, setSameArtworkConfirmed] = useState(false);
  const [works, setWorks] = useState<WorkOverride[]>([]);
  const [progress, setProgress] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    queueMicrotask(() => setPreviews(urls));
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const addFiles = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    setSameArtworkConfirmed(false);
    setFiles((current) => [...current, ...images]);
    setWorks((current) => [...current, ...images.map(() => ({ ...EMPTY_OVERRIDE }))]);
  };

  const setWork = (index: number, patch: Partial<WorkOverride>) =>
    setWorks((current) => current.map((work, i) => (i === index ? { ...work, ...patch } : work)));

  /** 사진 i의 최종 값: 그 사진에 적은 값, 없으면 공통 값. */
  const resolveWork = (index: number) => {
    const work = works[index] ?? EMPTY_OVERRIDE;
    const pick = (own: string, shared: string) => own.trim() || shared.trim();
    return {
      title: batch ? pick(work.title, titleKo.trim() ? (files.length > 1 ? `${titleKo.trim()} ${index + 1}` : titleKo.trim()) : "") : titleKo.trim(),
      price: batch ? pick(work.price, price) : price.trim(),
      description: batch ? pick(work.description, descriptionKo) : descriptionKo.trim(),
      material: batch ? pick(work.material, materialKo) : materialKo.trim(),
      width: batch ? pick(work.width, widthCm) : widthCm,
      height: batch ? pick(work.height, heightCm) : heightCm,
      year: batch ? pick(work.year, year) : year.trim(),
      frame: (batch && work.frame) || frame,
      depth: batch ? pick(work.depth, depthCm) : depthCm,
      edition: batch ? pick(work.edition, edition) : edition.trim(),
      facts: batch ? work.facts : facts,
      conditionPhoto: batch ? work.conditionPhoto : proof.edge,
    };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    if (files.length === 0) {
      setError(t("portalSubmitErrorNoImages"));
      return;
    }
    if (!batch && files.length > 1 && !sameArtworkConfirmed) {
      setError(t("portalSameArtworkRequired"));
      return;
    }
    const resolvedWorks = batch ? files.map((_, i) => resolveWork(i)) : [resolveWork(0)];
    // 공통 칸을 비우고 사진마다 따로 쓸 수도 있어서, 필수 값은 작품마다 최종 값으로 확인한다.
    const missingIndex = resolvedWorks.findIndex(
      (work) => !work.title || !work.material || !work.width || !work.height || !work.year,
    );
    if (missingIndex !== -1) {
      setError(batch ? t("portalBatchMissing").replace("{n}", String(missingIndex + 1)) : t("portalSubmitError"));
      return;
    }
    if (resolvedWorks.some((work) => !work.frame)) {
      setError(t("portalFrameRequired"));
      return;
    }
    for (let i = 0; i < resolvedWorks.length; i++) {
      const work = resolvedWorks[i];
      const extra = parseArtworkExtras({ ...work.facts, frame: work.frame, depthCm: work.depth, edition: work.edition, framedWidthCm, framedHeightCm });
      const errorKey = registrationError(extra, work.price, Boolean(work.conditionPhoto), true);
      if (errorKey || !validRegistrationYear(work.year)) {
        setError(`${batch ? `${i + 1}: ` : ""}${t(errorKey ?? "portalSubmitError")}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const resized = await Promise.all(files.map((file) => resizeImage(file).catch(() => file)));
      const resizedProof = batch ? [] : await Promise.all(PROOF_KEYS.flatMap((key) => (proof[key] ? [resizeImage(proof[key]).catch(() => proof[key] as File).then((file) => [key, file] as const)] : [])));
      const buildForm = (work: ReturnType<typeof resolveWork>, images: File[]) => {
        const form = new FormData();
        form.set("inputLang", lang);
        if (!batch && sameArtworkConfirmed) form.set("photoMode", "same-artwork");
        form.set("title", work.title);
        form.set("description", work.description);
        // Built here rather than free-typed, so it always matches the
        // "material · W × Hcm · year" shape artworkDimensionsCm() (src/lib/catalog.ts)
        // parses for the room-preview feature — a free-text field let artists
        // type e.g. "60.6*45.5" with no "cm", silently hiding that button.
        form.set("details", `${work.material} · ${work.width} × ${work.height}cm · ${work.year === "unknown" ? (lang === "ko" ? "미상" : "Unknown") : work.year}`);
        // 여러 작품을 한 번에 올리면 색이 작품마다 달라서, 비워 두고 자동 검토가 사진마다 채운다.
        form.set("palette", batch ? "" : paletteKo.trim());
        form.set("moodKey", moodKey);
        form.set("statusKey", statusKey);
        if (work.price) form.set("price", work.price);
        form.set("frame", work.frame);
        if (work.frame === "framed") {
          form.set("frameMaterial", frameMaterial);
          form.set("framedWidthCm", framedWidthCm);
          form.set("framedHeightCm", framedHeightCm);
        }
        form.set("depthCm", work.depth);
        form.set("edition", work.edition);
        for (const key of ["medium", "photoProcess", "photoPaper", "workKind", "condition", "signature", "signatureLocation", "pricing", "installation", "certificateAvailability"] as const) form.set(key, work.facts[key] ?? "");
        form.set("authorized", String(work.facts.authorized === true));
        form.set("conditionNote", (lang === "ko" ? work.facts.conditionNoteKo : work.facts.conditionNoteEn) ?? "");
        images.forEach((file) => form.append("images", file));
        resizedProof.forEach(([key, file]) => form.set(`proof_${key}`, file));
        return form;
      };
      let translationFailed = false;
      const post = (form: FormData) =>
        fetch("/api/artist-submissions", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) })
          .then(async (response) => {
            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              if (payload?.error === "portalTranslationError") translationFailed = true;
            }
            return response.ok;
          })
          .catch(() => false);

      if (batch) {
        // One request per photo, in order, so a failure part-way leaves only
        // the photos that didn't make it in the form for a retry.
        const failed: number[] = [];
        for (let i = 0; i < resized.length; i++) {
          setProgress(t("portalBatchProgress").replace("{n}", String(i + 1)).replace("{total}", String(resized.length)));
          const form = buildForm(resolvedWorks[i], [resized[i]]);
          if (resolvedWorks[i].conditionPhoto) form.set("proof_edge", await resizeImage(resolvedWorks[i].conditionPhoto!).catch(() => resolvedWorks[i].conditionPhoto!));
          if (!(await post(form))) failed.push(i);
        }
        setProgress("");
        if (failed.length) {
          setFiles((current) => current.filter((_, i) => failed.includes(i)));
          // Keep each leftover photo's resolved title ("내려놓음 3"), so a retry
          // doesn't renumber it into a title that already went up.
          setWorks((current) => failed.map((i) => ({ ...(current[i] ?? EMPTY_OVERRIDE), title: resolvedWorks[i].title })));
          setError(t("portalBatchPartialError").replace("{done}", String(resized.length - failed.length)).replace("{failed}", String(failed.length)) + (translationFailed ? ` ${t("portalTranslationError")}` : ""));
          if (failed.length < resized.length) onSubmitted();
          return;
        }
      } else if (!(await post(buildForm(resolvedWorks[0], resized)))) {
        setError(t(translationFailed ? "portalTranslationError" : "portalSubmitError"));
        return;
      }
      setSuccess(true);
      setTitleKo("");
      setDescriptionKo("");
      setMaterialKo("");
      setWidthCm("");
      setHeightCm("");
      setYear("");
      setPaletteKo("");
      setPrice("");
      setFrame("");
      setFrameMaterial("");
      setFramedWidthCm("");
      setFramedHeightCm("");
      setDepthCm("");
      setEdition("");
      setFacts({});
      setProof({});
      setProofInputKey((n) => n + 1);
      setFiles([]);
      setWorks([]);
      setSameArtworkConfirmed(false);
      onSubmitted();
    } catch {
      setError(t("portalSubmitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-card pt-upload">
      <div className="pt-card-head">
        <p className="pt-eyebrow">NEW WORK</p>
        <h2>
          <T k="portalUploadHeading" />
        </h2>
        <p className="pt-muted">
          <T k="portalUploadIntro" />
        </p>
      </div>
      <form onSubmit={submit}>
        <div className="pt-choices pt-mode" role="radiogroup" aria-label={t("portalModeLabel")}>
          <button type="button" role="radio" aria-checked={!batch} className="pt-choice" onClick={() => { setBatch(false); setSameArtworkConfirmed(false); }}>
            <T k="portalModeSingle" />
          </button>
          <button type="button" role="radio" aria-checked={batch} className="pt-choice" onClick={() => { setBatch(true); setSameArtworkConfirmed(false); }}>
            <T k="portalModeBatch" />
          </button>
        </div>
        <p className="pt-note"><T k={batch ? "portalModeBatchNote" : "portalModeSingleNote"} /></p>
        <div
          className="pt-drop"
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <label className="pt-drop-target">
            <input type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} />
            <span className="pt-drop-icon" aria-hidden="true">＋</span>
            <strong>
              <T k="portalImagesLabel" />
            </strong>
            <small>
              <T k="portalDropHint" />
            </small>
          </label>
          {previews.length ? (
            batch ? (
              <ul className="pt-batch-list">
                {previews.map((url, index) => {
                  const work = works[index] ?? EMPTY_OVERRIDE;
                  const input = (key: keyof Omit<WorkOverride, "frame" | "facts" | "conditionPhoto">, label: DictKey, shared: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
                    <label>
                      <span>{t(label)}</span>
                      <input value={work[key] === "unknown" ? "" : work[key]} onChange={(event) => setWork(index, { [key]: event.target.value })} placeholder={shared === "unknown" ? "" : shared} {...extra} />
                    </label>
                  );
                  return (
                    <li key={url} className="pt-batch-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" />
                      <div className="pt-batch-fields">
                        <p className="pt-batch-no">{index + 1}</p>
                        {input("title", "portalTitleKoLabel", titleKo.trim() ? `${titleKo.trim()} ${index + 1}` : "")}
                        {input("price", "portalPriceLabel", price.trim(), { inputMode: "numeric" })}
                        <details open={Object.entries(work).some(([key, value]) => key !== "title" && key !== "price" && value)}>
                          <summary>{t("portalBatchMore")}</summary>
                          <label>
                            <span>{t("portalDescriptionKoLabelOptional")}</span>
                            <textarea rows={2} value={work.description} onChange={(event) => setWork(index, { description: event.target.value })} placeholder={descriptionKo.trim()} />
                          </label>
                          {input("material", "portalMaterialLabel", materialKo.trim())}
                          {work.facts.medium !== "photo" && work.facts.medium !== "craft" ? <HoPicker onPick={(width, height) => setWork(index, { width, height })} /> : null}
                          <div className="pt-batch-three">
                            {input("width", "portalWidthLabel", widthCm, { type: "number", inputMode: "decimal", step: "0.1", min: "0.1" })}
                            {input("height", "portalHeightLabel", heightCm, { type: "number", inputMode: "decimal", step: "0.1", min: "0.1" })}
                            {input("year", "portalYearLabel", year.trim(), { type: "number", inputMode: "numeric", min: "1900", max: "2100", disabled: (work.year || year) === "unknown" })}
                          </div>
                          <label className="pt-check"><input type="checkbox" checked={(work.year || year) === "unknown"} onChange={(event) => setWork(index, { year: event.target.checked ? "unknown" : "" })} />{t("registrationYearUnknown")}</label>
                          <label>
                            <span>{t("portalFrameLabel")}</span>
                            {/* 공통 칸에서 고른 값이 그대로 보이고, 이 작품만 다르면 여기서 바꾼다. */}
                            <select value={work.frame || frame} onChange={(event) => setWork(index, { frame: event.target.value as FrameKey })}>
                              {work.frame || frame ? null : <option value="" disabled>{t("portalFrameChoose")}</option>}
                              {FRAME_KEYS.map((key) => (
                                <option key={key} value={key}>
                                  {t(FRAME_LABEL_KEY[key])}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="pt-batch-two">
                            {input("depth", "portalDepthLabel", depthCm, { type: "number", inputMode: "decimal", step: "0.1", min: "0.1" })}
                            {input("edition", "portalEditionLabel", edition.trim(), { maxLength: 20 })}
                          </div>
                        </details>
                        <ArtworkRegistrationFields value={work.facts} onChange={(facts) => setWork(index, { facts })} />
                        {work.facts.condition === "issues" ? <label className="pt-field"><span>{t("registrationConditionPhoto")}</span><input type="file" accept="image/*" onChange={(event) => setWork(index, { conditionPhoto: event.target.files?.[0] })} /><small>{work.conditionPhoto?.name}</small></label> : null}
                      </div>
                      <button type="button" aria-label={t("portalRemovePhoto")} onClick={() => {
                          setFiles((current) => current.filter((_, i) => i !== index));
                          setWorks((current) => current.filter((_, i) => i !== index));
                        }}>
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="pt-previews">
                {previews.map((url, index) => (
                  <li key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                    <button type="button" aria-label={t("portalRemovePhoto")} onClick={() => {
                        setFiles((current) => current.filter((_, i) => i !== index));
                        setWorks((current) => current.filter((_, i) => i !== index));
                      }}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>

        <fieldset className="pt-group">
          <legend>
            <T k="portalSectionBasics" />
          </legend>
          <label className="pt-field">
            <span><T k={batch ? "portalBatchTitleLabel" : "portalTitleKoLabel"} /></span>
            <input value={titleKo} onChange={(event) => setTitleKo(event.target.value)} required={!batch} />
            {batch ? <small className="pt-note"><T k="portalBatchTitleNote" /></small> : null}
          </label>
          <label className="pt-field">
            <span><T k="portalDescriptionKoLabelOptional" /></span>
            <textarea value={descriptionKo} onChange={(event) => setDescriptionKo(event.target.value)} rows={3} />
            <small className="pt-note"><T k="portalDescriptionSkippedNote" /></small>
          </label>
          <label className="pt-field">
            <span><T k="portalMaterialLabel" /></span>
            <input value={materialKo} onChange={(event) => setMaterialKo(event.target.value)} placeholder={t("portalMaterialPlaceholder")} required={!batch} />
          </label>
          {batch ? null : (
            <label className="pt-field">
              <span><T k="portalPaletteLabel" /></span>
              <input value={paletteKo} onChange={(event) => setPaletteKo(event.target.value)} placeholder={t("portalPalettePlaceholder")} />
              <small className="pt-note"><T k="portalPaletteAutoNote" /></small>
            </label>
          )}
        </fieldset>

        <fieldset className="pt-group">
          <legend>
            <T k="portalSectionSize" />
          </legend>
          {facts.medium !== "photo" && facts.medium !== "craft" && !works.some(work => work.facts.medium === "photo" || work.facts.medium === "craft") ? <><HoPicker onPick={(width, height) => { setWidthCm(width); setHeightCm(height); }} /><small className="pt-note"><T k="portalHoNote" /></small></> : null}
          <div className="pt-row3">
            <label className="pt-field">
              <span><T k="portalWidthLabel" /></span>
              <input type="number" inputMode="decimal" step="0.1" min="0.1" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} required={!batch} />
            </label>
            <label className="pt-field">
              <span><T k="portalHeightLabel" /></span>
              <input type="number" inputMode="decimal" step="0.1" min="0.1" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} required={!batch} />
            </label>
            <label className="pt-field">
              <span><T k="portalYearLabel" /></span>
              <input type="number" inputMode="numeric" min="1900" max="2100" value={year === "unknown" ? "" : year} disabled={year === "unknown"} onChange={(event) => setYear(event.target.value)} placeholder={t("portalYearPlaceholder")} required={!batch && year !== "unknown"} />
            </label>
          </div>
          <label className="pt-check"><input type="checkbox" checked={year === "unknown"} onChange={(event) => setYear(event.target.checked ? "unknown" : "")} />{t("registrationYearUnknown")}</label>
        </fieldset>

        {!batch ? <fieldset className="pt-group"><legend>{t("registrationHeading")}</legend><ArtworkRegistrationFields value={facts} onChange={setFacts} /></fieldset> : null}

        <fieldset className="pt-group">
          <legend>
            <T k="portalSectionFrame" />
          </legend>
          <div className="pt-field">
            <span><T k="portalFrameLabel" /></span>
            <div className="pt-choices" role="radiogroup" aria-label={t("portalFrameLabel")}>
              {FRAME_KEYS.map((key) => (
                <button key={key} type="button" role="radio" aria-checked={frame === key} className="pt-choice" onClick={() => setFrame(key)}>
                  <T k={FRAME_LABEL_KEY[key]} />
                </button>
              ))}
            </div>
          </div>
          {frame === "framed" ? (
            <div className="pt-row3">
              <label className="pt-field">
                <span><T k="portalFrameMaterialLabel" /></span>
                <select value={frameMaterial} onChange={(event) => setFrameMaterial(event.target.value as FrameMaterial | "")}>
                  <option value="">{t("portalFrameChoose")}</option>
                  {FRAME_MATERIALS.map((key) => (
                    <option key={key} value={key}>
                      {t(FRAME_MATERIAL_LABEL_KEY[key])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pt-field">
                <span><T k={facts.medium === "photo" ? "registrationPhotoFrameWidth" : "portalFramedWidthLabel"} /></span>
                <input type="number" inputMode="decimal" step="0.1" min="0.1" value={framedWidthCm} onChange={(event) => setFramedWidthCm(event.target.value)} />
              </label>
              <label className="pt-field">
                <span><T k={facts.medium === "photo" ? "registrationPhotoFrameHeight" : "portalFramedHeightLabel"} /></span>
                <input type="number" inputMode="decimal" step="0.1" min="0.1" value={framedHeightCm} onChange={(event) => setFramedHeightCm(event.target.value)} />
              </label>
            </div>
          ) : null}
          <div className="pt-row2">
            <label className="pt-field">
              <span><T k="portalDepthLabel" /></span>
              <input type="number" inputMode="decimal" step="0.1" min="0.1" value={depthCm} onChange={(event) => setDepthCm(event.target.value)} />
              <small className="pt-note"><T k="portalDepthNote" /></small>
            </label>
            <label className="pt-field">
              <span><T k="portalEditionLabel" /></span>
              <input value={edition} maxLength={20} onChange={(event) => setEdition(event.target.value)} placeholder={t("portalEditionPlaceholder")} />
            </label>
          </div>
        </fieldset>

        <fieldset className="pt-group">
          <legend>
            <T k="portalProofSection" />
          </legend>
          <p className="pt-note"><T k={batch ? "portalProofBatchNote" : "portalProofNote"} /></p>
          {!batch ? (
            <div className="pt-row3">
              {PROOF_KEYS.map((key) => (
                <label key={key} className="pt-field pt-proof">
                  <span><T k={key === "edge" && facts.condition === "issues" ? "registrationConditionPhoto" : PROOF_LABEL_KEY[key]} /></span>
                  <input key={proofInputKey} type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; setProof((current) => ({ ...current, [key]: file })); }} />
                  <small className="pt-note">{proof[key] ? proof[key]?.name : <T k={`${PROOF_LABEL_KEY[key]}Hint`} />}</small>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="pt-group">
          <legend>
            <T k="portalSectionSale" />
          </legend>
          <div className="pt-row3">
            <label className="pt-field">
              <span><T k="portalMoodLabel" /></span>
              <select value={moodKey} onChange={(event) => setMoodKey(event.target.value as MoodKey)}>
                {MOOD_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {t(MOOD_DICT_KEY[key])}
                  </option>
                ))}
              </select>
            </label>
            <label className="pt-field">
              <span><T k="portalStatusLabel" /></span>
              <select value={statusKey} onChange={(event) => setStatusKey(event.target.value as StatusKey)}>
                {statusOrder.map((key) => (
                  <option key={key} value={key}>
                    {t(statusDictKey[key])}
                  </option>
                ))}
              </select>
            </label>
            <label className="pt-field">
              <span><T k="portalPriceLabel" /></span>
              <input value={price} disabled={!batch && facts.pricing === "inquiry"} required={!batch && facts.pricing === "fixed"} onChange={(event) => setPrice(event.target.value)} placeholder={t("portalPricePlaceholder")} />
              <small className="pt-note">{t("registrationPriceHint")}</small>
            </label>
          </div>
        </fieldset>

        {files.length > 0 ? <p className="pt-note" role="status">{t(batch ? "portalBatchCount" : "portalSingleCount").replace("{n}", String(files.length))}</p> : null}
        {!batch && files.length > 1 ? (
          <label className="pt-check">
            <input type="checkbox" checked={sameArtworkConfirmed} onChange={(event) => setSameArtworkConfirmed(event.target.checked)} />
            {t("portalSameArtworkConfirm")}
          </label>
        ) : null}
        <button className="pt-btn pt-btn-primary pt-btn-block" type="submit" disabled={submitting || (!batch && files.length > 1 && !sameArtworkConfirmed)}>
          {submitting
            ? progress || t("portalSubmitting")
            : batch && files.length > 1
              ? t("portalBatchSubmit").replace("{n}", String(files.length))
              : t("portalSubmit")}
        </button>
        {success ? <p className="pt-success">{t("portalSubmitSuccess")}</p> : null}
        {error ? <p className="pt-error">{error}</p> : null}
      </form>
    </section>
  );
}

function SubmissionStatusList({ submissions, onChanged }: { submissions: Submission[] | null; onChanged: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<string | null>(null);
  // 심사 중이거나 반려된 내 제출물은 여기서 바로 지운다(승인된 작품은 "내 작품 관리"에서).
  const remove = async (submission: Submission) => {
    const title = lang === "ko" ? submission.title_ko : submission.title_en;
    if (!window.confirm(t("portalWorksConfirmDelete").replace("{title}", title))) return;
    if (!(await artistWorkAction(`submission-${submission.id}`, "delete"))) window.alert(t("portalWorksError"));
    onChanged();
  };

  return (
    <section className="pt-card">
      <div className="pt-card-head">
        <p className="pt-eyebrow">MY WORKS</p>
        <h2>
          <T k="portalStatusHeading" />
        </h2>
      </div>
      {submissions === null ? (
        <p className="pt-muted">…</p>
      ) : submissions.length === 0 ? (
        <p className="pt-muted">
          <T k="portalStatusEmpty" />
        </p>
      ) : (
        <ul className="pt-subs">
          {submissions.map((submission) => (
            <li key={submission.id} data-status={submission.status}>
              <span className="pt-sub-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {submission.image_urls[0] ? <img src={submission.image_urls[0]} alt="" loading="lazy" /> : null}
              </span>
              <div>
                <strong>{lang === "ko" ? submission.title_ko : submission.title_en}</strong>
                <span className={`pt-pill pt-pill-${submission.status}`}>{t(statusLabelDictKey[submission.status])}</span>
                {submission.admin_note ? (
                  <p className="pt-note">
                    {t("portalStatusNoteLabel")}: {submission.admin_note}
                  </p>
                ) : null}
                {submission.status !== "approved" ? (
                  <button type="button" className="pt-sub-edit" aria-expanded={imageOpen === submission.id} onClick={() => setImageOpen((open) => (open === submission.id ? null : submission.id))}>{t("portalMainImageEdit")}</button>
                ) : null}
                {submission.status !== "approved" ? (
                  <button type="button" className="pt-sub-edit" aria-expanded={editOpen === submission.id} onClick={() => setEditOpen((open) => (open === submission.id ? null : submission.id))}>{t("portalCopyEdit")}</button>
                ) : null}
                {submission.status !== "approved" ? <button type="button" className="pt-sub-edit" aria-expanded={registrationOpen === submission.id} onClick={() => setRegistrationOpen((open) => (open === submission.id ? null : submission.id))}>{t("registrationEdit")}</button> : null}
                {submission.status !== "approved" ? (
                  <button type="button" className="pt-sub-delete" onClick={() => remove(submission)}>{t("portalWorksDelete")}</button>
                ) : null}
              </div>
              {imageOpen === submission.id ? <MainImageEditor key={submission.id} slug={`submission-${submission.id}`} currentImage={submission.image_urls[0] ?? ""} onSaved={() => { setImageOpen(null); onChanged(); }} /> : null}
              {registrationOpen === submission.id ? <ArtworkRegistrationEditor key={`${submission.id}-${lang}`} slug={`submission-${submission.id}`} extras={submission.extras} price={submission.price ?? ""} onSaved={() => { setRegistrationOpen(null); onChanged(); }} /> : null}
              {editOpen === submission.id ? <ArtworkCopyEditor key={`${submission.id}-${lang}`} slug={`submission-${submission.id}`} title={lang === "ko" ? submission.title_ko : submission.title_en} description={lang === "ko" ? submission.description_ko : submission.description_en} details={lang === "ko" ? submission.details_ko : submission.details_en} price={submission.price ?? ""} onSaved={() => { setEditOpen(null); onChanged(); }} onCancel={() => setEditOpen(null)} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MainImageEditor({ slug, currentImage, onSaved }: { slug: string; currentImage: string; onSaved: () => void }) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const save = async () => {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("image", await resizeImage(file));
      const response = await fetch("/api/artist-works/main-image", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error("upload failed");
      onSaved();
    } catch {
      setError(t("portalMainImageError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-main-image-editor">
      <p className="pt-muted">{t("portalMainImageIntro")}</p>
      <div className="pt-main-image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview || currentImage} alt="" />
        {file ? <span>{file.name}</span> : null}
      </div>
      <div className="pt-main-image-actions">
        <label>
          {t("portalMainImageChoose")}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setPreview(selected ? URL.createObjectURL(selected) : "");
            setError("");
          }} />
        </label>
        <button type="button" className="pt-btn" disabled={!file || saving} onClick={() => void save()}>{saving ? t("portalProofUploading") : t("portalMainImageSave")}</button>
      </div>
      {error ? <p className="pt-error">{error}</p> : null}
    </div>
  );
}

function ArtworkCopyEditor({ slug, title, description, details, price, onSaved, onCancel }: {
  slug: string; title: string; description: string; details: string; price: string; onSaved: () => void; onCancel: () => void;
}) {
  const { lang } = useLanguage();
  const t = useT();
  const [titleKo, setTitleKo] = useState(title);
  const [descriptionKo, setDescriptionKo] = useState(description);
  const [detailsKo, setDetailsKo] = useState(details);
  const [priceValue, setPriceValue] = useState(price);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/artist-works/copy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, inputLang: lang, title: titleKo, description: descriptionKo, details: detailsKo, price: priceValue }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(t(payload?.error === "portalTranslationError" ? "portalTranslationError" : "portalCopyError"));
        return;
      }
      onSaved();
    } catch {
      setError(t("portalCopyError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pt-copy-editor" onSubmit={save}>
      <p className="pt-muted">{t("portalCopyIntro")}</p>
      <label className="pt-field">
        <span>{t("portalDetailsKoLabel")}</span>
        <input value={detailsKo} onChange={(event) => setDetailsKo(event.target.value)} maxLength={500} />
      </label>
      <label className="pt-field">
        <span>{t("portalPriceLabel")}</span>
        <input value={priceValue} onChange={(event) => setPriceValue(event.target.value)} maxLength={100} />
      </label>
      <label className="pt-field">
        <span>{t("portalTitleKoLabel")}</span>
        <input value={titleKo} onChange={(event) => setTitleKo(event.target.value)} maxLength={200} required />
      </label>
      <label className="pt-field">
        <span>{t("portalDescriptionKoLabelOptional")}</span>
        <textarea value={descriptionKo} onChange={(event) => setDescriptionKo(event.target.value)} maxLength={5000} rows={5} />
      </label>
      <div className="pt-copy-actions">
        <button className="pt-btn pt-btn-primary" type="submit" disabled={saving}>{saving ? t("portalCopySaving") : t("portalCopySave")}</button>
        <button className="pt-btn pt-btn-ghost" type="button" disabled={saving} onClick={onCancel}>{t("portalCopyCancel")}</button>
      </div>
      {error ? <p className="pt-error">{error}</p> : null}
    </form>
  );
}

function ChangePasswordForm() {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError(t("portalChangePasswordErrorMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/artist-auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 401) {
        setError(t("portalChangePasswordErrorWrongCurrent"));
        return;
      }
      if (!response.ok) {
        setError(t("portalChangePasswordError"));
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(t("portalChangePasswordError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="pt-password-form" onSubmit={submit}>
      <label className="pt-field">
        <span><T k="portalCurrentPasswordLabel" /></span>
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      </label>
      <label className="pt-field">
        <span><T k="portalNewPasswordLabel" /></span>
        <input type="password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      </label>
      <label className="pt-field">
        <span><T k="portalConfirmPasswordLabel" /></span>
        <input type="password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </label>
      <button className="pt-btn pt-btn-primary" type="submit" disabled={submitting}>
        {submitting ? t("portalChangePasswordSubmitting") : t("portalChangePasswordSubmit")}
      </button>
      {success ? <p className="pt-success">{t("portalChangePasswordSuccess")}</p> : null}
      {error ? <p className="pt-error">{error}</p> : null}
    </form>
  );
}
