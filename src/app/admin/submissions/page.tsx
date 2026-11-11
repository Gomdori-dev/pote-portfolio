"use client";

// Internal-only admin tool (owner use, direct-URL only, not linked from the
// main nav — same convention as /artist-studio). Kept in plain Korean rather
// than the ko/en i18n dict pattern used by the public/bilingual site and by
// /artist-portal (which artists themselves use): only the site owner (a
// Korean speaker) ever opens this screen.
//
// 2026-09-25 "백스테이지" 대시보드로 다시 꾸밈: 위에 숫자 타일(누르면 그 목록으로
// 이동), 작가 명부(폴라로이드 카드 — 인스타·작가 페이지·비밀번호 재발급 버튼),
// 제출 작품 카드(승인/반려하면 도장이 찍힌 뒤 목록이 갱신된다).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { artists, type ArtistSlug } from "@/lib/artists";
import { artistInstagram, instagramUrl } from "@/lib/artist-instagram";
import { artistThumb } from "@/lib/artist-portraits";
import { FRAME_LABEL_KEY, FRAME_MATERIAL_LABEL_KEY, PROOF_LABEL_KEY, hasExtras, proofPhotos, type ArtworkExtras } from "@/lib/artwork-extras";
import { dict } from "@/lib/i18n";
import { FACT_LABELS } from "@/lib/artwork-registration";
import type { AiReview } from "@/lib/artwork-review";
import AdminReviewNote from "@/components/AdminReviewNote";
import { AdminCommentsBoard } from "@/components/AdminCommentsBoard";
import { FunnelSummaryPanel } from "@/app/admin/analytics/FunnelDashboard";
import type { ManagedWork, WorkAction } from "@/lib/artwork-controls";

const STORAGE_KEY = "pote_admin_key";

type Status = "pending" | "approved" | "rejected";
type Tab = Status | "all";

type Submission = {
  id: string;
  artist_slug: string;
  status: Status;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  palette_ko?: string;
  extras?: ArtworkExtras;
  mood_key: string;
  status_key: string;
  price: string | null;
  image_urls: string[];
  admin_note: string | null;
  ai_review?: AiReview | null;
  created_at: string;
  reviewed_at: string | null;
};

export default function AdminSubmissionsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* Storage is optional. */
    }
    if (stored) {
      queueMicrotask(() => {
        setAdminKey(stored);
        setUnlocked(true);
      });
    }
  }, []);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (!response.ok) {
        setAuthError("비밀번호가 맞지 않아요.");
        return;
      }
      try {
        window.sessionStorage.setItem(STORAGE_KEY, passwordInput);
      } catch {
        /* Storage is optional. */
      }
      setAdminKey(passwordInput);
      setUnlocked(true);
    } catch {
      setAuthError("접속 중 오류가 발생했어요.");
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* Best effort — the cookie will also just expire on its own. */
    }
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage is optional. */
    }
    setAdminKey("");
    setUnlocked(false);
  };

  if (!unlocked) {
    return (
      <main className="adm adm-locked">
        <form className="adm-door" onSubmit={unlock}>
          <span className="adm-door-sign">STAFF ONLY</span>
          <p className="adm-eyebrow">POTE BACKSTAGE</p>
          <h1>관계자 외 출입금지</h1>
          <p className="adm-door-sub">관리자 비밀번호를 입력하면 문이 열려요.</p>
          <label>
            관리자 비밀번호
            <input type="password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} required autoFocus />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit">
            입장하기
          </button>
          {authError ? <p className="adm-error">{authError}</p> : null}
        </form>
      </main>
    );
  }

  return <Dashboard adminKey={adminKey} onLogout={logout} onPasswordChanged={setAdminKey} />;
}

function greeting(hour: number) {
  if (hour < 6) return "늦은 밤까지 수고 많아요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function Dashboard({ adminKey, onLogout, onPasswordChanged }: { adminKey: string; onLogout: () => void; onPasswordChanged: (next: string) => void }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("pending");

  const load = async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/submissions", { headers: authHeaders(adminKey) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setLoadError(payload?.error === "db_not_configured" ? "DB가 아직 연결되지 않았어요." : "목록을 불러오지 못했어요.");
        setSubmissions([]);
        return;
      }
      const data = await response.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      setLoadError("목록을 불러오는 중 오류가 발생했어요.");
      setSubmissions([]);
    }
  };

  useEffect(() => {
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  // 한 줄 감상 중 확인 전인 글 수. 아래 AdminCommentsBoard가 불러올 때 알려 준다.
  const [pendingComments, setPendingComments] = useState<number | null>(null);
  const commentHeaders = useCallback(() => authHeaders(adminKey), [adminKey]);

  const counts = useMemo(() => {
    const all = submissions ?? [];
    return {
      pending: all.filter((s) => s.status === "pending").length,
      approved: all.filter((s) => s.status === "approved").length,
      rejected: all.filter((s) => s.status === "rejected").length,
      all: all.length,
    };
  }, [submissions]);

  const pendingBySlug = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of submissions ?? []) if (s.status === "pending") map[s.artist_slug] = (map[s.artist_slug] ?? 0) + 1;
    return map;
  }, [submissions]);

  const now = new Date();
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Seoul" }));
  const today = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul" });
  const artistCount = Object.keys(artists).length;

  const jump = (next: Tab) => {
    setTab(next);
    document.getElementById("adm-submissions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="adm">
      <header className="adm-top">
        <div>
          <p className="adm-eyebrow">POTE BACKSTAGE · {today}</p>
          <h1>
            {greeting(hour)}.
            <br />
            <em>{counts.pending > 0 ? `작품 ${counts.pending}점이 벽에 걸리길 기다려요.` : "오늘은 기다리는 작품이 없어요."}</em>
          </h1>
        </div>
        <button className="adm-btn adm-btn-ghost" type="button" onClick={onLogout}>
          로그아웃
        </button>
      </header>

      <section className="adm-tiles" aria-label="요약">
        <button type="button" className="adm-tile adm-tile-hot" data-alive={counts.pending > 0} onClick={() => jump("pending")}>
          <span>심사 대기</span>
          <strong>{submissions ? counts.pending : "–"}</strong>
          <small>{counts.pending > 0 ? "눌러서 바로 심사하기 →" : "모두 처리했어요 ✓"}</small>
        </button>
        <button type="button" className="adm-tile" onClick={() => jump("approved")}>
          <span>승인됨</span>
          <strong>{submissions ? counts.approved : "–"}</strong>
          <small>사이트에 걸린 작품</small>
        </button>
        <button type="button" className="adm-tile" onClick={() => jump("rejected")}>
          <span>반려됨</span>
          <strong>{submissions ? counts.rejected : "–"}</strong>
          <small>작가에게 사유가 보여요</small>
        </button>
        <a className="adm-tile" href="#adm-roster">
          <span>참여 작가</span>
          <strong>{artistCount}</strong>
          <small>작가 명부 보기 ↓</small>
        </a>
        <a className="adm-tile adm-tile-hot" data-alive={(pendingComments ?? 0) > 0} href="#adm-comments">
          <span>한 줄 감상</span>
          <strong>{pendingComments ?? "–"}</strong>
          <small>{(pendingComments ?? 0) > 0 ? "확인 전 감상 검토하기 →" : "확인할 감상이 없어요 ✓"}</small>
        </a>
      </section>

      <FunnelSummaryPanel />

      <Roster adminKey={adminKey} pendingBySlug={pendingBySlug} />

      <SubmissionsBoard
        submissions={submissions}
        error={loadError}
        tab={tab}
        counts={counts}
        onTab={setTab}
        adminKey={adminKey}
        onChanged={load}
      />

      <AdminCommentsBoard headers={commentHeaders} onPendingChange={setPendingComments} />
      <SiteWorksPanel adminKey={adminKey} />

      <details className="adm-panel adm-settings">
        <summary>⚙ 관리자 비밀번호 변경</summary>
        <ChangeAdminPasswordForm adminKey={adminKey} onPasswordChanged={onPasswordChanged} />
      </details>
    </main>
  );
}

function Roster({ adminKey, pendingBySlug }: { adminKey: string; pendingBySlug: Record<string, number> }) {
  return (
    <section className="adm-panel" id="adm-roster">
      <div className="adm-panel-head">
        <div>
          <p className="adm-eyebrow">ARTIST ROSTER</p>
          <h2>작가 명부</h2>
        </div>
        <p className="adm-hint">카드마다 인스타·작가 페이지·로그인 재발급을 바로 할 수 있어요.</p>
      </div>
      <div className="adm-roster">
        {Object.values(artists).map((artist, index) => (
          <ArtistCard key={artist.slug} slug={artist.slug} index={index} adminKey={adminKey} pending={pendingBySlug[artist.slug] ?? 0} />
        ))}
      </div>
    </section>
  );
}

function ArtistCard({ slug, index, adminKey, pending }: { slug: ArtistSlug; index: number; adminKey: string; pending: number }) {
  const router = useRouter();
  const artist = artists[slug];
  const handle = artistInstagram[slug];
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const issue = async () => {
    if (!window.confirm(`${artist.name.ko} 작가의 비밀번호를 새로 발급할까요?\n지금 쓰던 비밀번호는 더 이상 로그인되지 않아요.`)) return;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      const response = await fetch("/api/admin/artist-credentials", {
        method: "POST",
        headers: authHeaders(adminKey),
        body: JSON.stringify({ artistSlug: slug }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error === "db_not_configured" ? "DB 미연결" : "발급 실패");
        return;
      }
      const data = await response.json();
      setIssued(data.password);
    } catch {
      setError("발급 중 오류");
    } finally {
      setBusy(false);
    }
  };

  // 작가 비밀번호 없이 그 작가의 포털을 새 탭으로 연다. 팝업 차단을 피하려고 클릭 순간에
  // 빈 탭부터 열고, 세션 쿠키를 받은 뒤 주소를 바꾼다.
  const openPortal = async () => {
    const tab = window.open("about:blank", "_blank");
    setError("");
    try {
      const response = await fetch("/api/admin/view-as-artist", {
        method: "POST",
        headers: authHeaders(adminKey),
        body: JSON.stringify({ artistSlug: slug }),
      });
      if (!response.ok) throw new Error(String(response.status));
      if (tab) tab.location.href = `/artist-portal?admin=${slug}`;
      else router.push(`/artist-portal?admin=${slug}`);
    } catch {
      tab?.close();
      setError("포털을 열지 못했어요");
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard can be blocked; the password is still on screen. */
    }
  };

  return (
    <article className="adm-card" style={{ ["--tilt" as string]: `${((index * 7) % 5) - 2}deg` }}>
      <span className="adm-tape" aria-hidden="true" />
      {pending > 0 ? <span className="adm-card-badge">대기 {pending}</span> : null}
      <div className="adm-card-photo">
        {!artistThumb(slug) ? (
          <span className="adm-card-initial">{artist.name.ko.slice(0, 1)}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artistThumb(slug)} alt="" loading="lazy" />
        )}
      </div>
      <h3>{artist.name.ko}</h3>
      <p className="adm-card-meta">{handle ? `@${handle}` : "인스타 정보 없음"}</p>
      <div className="adm-card-actions">
        {handle ? (
          <a className="adm-chip adm-chip-ig" href={instagramUrl(handle)} target="_blank" rel="noopener noreferrer" title={`@${handle} 인스타그램 열기`}>
            <InstagramIcon /> 인스타
          </a>
        ) : (
          <span className="adm-chip adm-chip-off" title="신청서에 인스타 아이디가 없어요">
            <InstagramIcon /> 인스타
          </span>
        )}
        <Link className="adm-chip" href={`/artists/${slug}`} target="_blank">
          페이지 ↗
        </Link>
        <button className="adm-chip adm-chip-portal" type="button" onClick={openPortal} title={`${artist.name.ko} 작가 포털을 관리자로 열기`}>
          🖼 포털 보기
        </button>
        <button className="adm-chip" type="button" onClick={issue} disabled={busy}>
          {busy ? "발급 중…" : "🔑 비번"}
        </button>
      </div>
      {issued ? (
        <button type="button" className="adm-card-password" onClick={copy} title="눌러서 복사">
          새 비밀번호 <strong>{issued}</strong>
          <small>{copied ? "복사됐어요 ✓" : "눌러서 복사 · 이 화면을 벗어나면 다시 볼 수 없어요"}</small>
        </button>
      ) : null}
      {error ? <p className="adm-error">{error}</p> : null}
    </article>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "심사 대기" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "반려됨" },
  { key: "all", label: "전체" },
];

function SubmissionsBoard({
  submissions,
  error,
  tab,
  counts,
  onTab,
  adminKey,
  onChanged,
}: {
  submissions: Submission[] | null;
  error: string;
  tab: Tab;
  counts: Record<Tab, number>;
  onTab: (tab: Tab) => void;
  adminKey: string;
  onChanged: () => void;
}) {
  const [stamp, setStamp] = useState<{ id: string; kind: "approved" | "rejected" } | null>(null);
  const [decisionError, setDecisionError] = useState("");
  const [deciding, setDeciding] = useState(false);
  const shown = (submissions ?? []).filter((s) => tab === "all" || s.status === tab);

  const decide = async (id: string, kind: "approved" | "rejected") => {
    if (deciding || stamp) return;
    let note: string | null = null;
    if (kind === "rejected") {
      const answer = window.prompt("반려 이유(선택, 작가에게 그대로 보여집니다):");
      if (answer === null) return;
      note = answer || null;
    }
    setDecisionError("");
    setDeciding(true);
    try {
      const response = await fetch(`/api/admin/submissions/${id}/${kind === "approved" ? "approve" : "reject"}`, {
        method: "POST",
        headers: authHeaders(adminKey),
        body: kind === "rejected" ? JSON.stringify({ note }) : undefined,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setDecisionError(payload?.error === "portalTranslationError" ? "영어 번역을 완료하지 못해 승인하지 않았어요. 잠시 뒤 다시 눌러 주세요." : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
        return;
      }
      setStamp({ id, kind });
      await new Promise((resolve) => setTimeout(resolve, 950));
      setStamp(null);
      onChanged();
    } catch {
      setDecisionError("접속 중 오류가 발생했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setDeciding(false);
    }
  };

  const statusLabel = (status: Status) => (status === "pending" ? "심사 대기" : status === "approved" ? "승인됨" : "반려됨");

  return (
    <section className="adm-panel" id="adm-submissions">
      <div className="adm-panel-head">
        <div>
          <p className="adm-eyebrow">SUBMISSIONS</p>
          <h2>제출 작품</h2>
        </div>
        <div className="adm-tabs" role="tablist">
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={key === tab} className="adm-tab" onClick={() => onTab(key)}>
              {label}
              <span>{submissions ? counts[key] : "·"}</span>
            </button>
          ))}
        </div>
      </div>
      {error || decisionError ? <p className="adm-error">{decisionError || error}</p> : null}
      {submissions === null ? (
        <p className="adm-empty">작품을 불러오는 중…</p>
      ) : shown.length === 0 ? (
        <div className="adm-empty">
          <span aria-hidden="true">🖼</span>
          <p>{tab === "pending" ? "심사할 작품이 없어요. 차 한잔 하세요 ☕" : "해당하는 작품이 없어요."}</p>
        </div>
      ) : tab !== "pending" ? (
        <ArchiveView submissions={shown} />
      ) : (
        <div className="adm-subs">
          {shown.map((submission) => {
            const stamped = stamp?.id === submission.id ? stamp.kind : null;
            return (
              <article className="adm-sub" key={submission.id} data-status={submission.status}>
                <div className="adm-sub-images">
                  {submission.image_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={submission.title_ko} loading="lazy" />
                    </a>
                  ))}
                  {stamped ? <span className={`adm-stamp adm-stamp-${stamped}`}>{stamped === "approved" ? "승인" : "반려"}</span> : null}
                </div>
                <div className="adm-sub-body">
                  <p className="adm-sub-artist">{artists[submission.artist_slug as ArtistSlug]?.name.ko ?? submission.artist_slug}</p>
                  <h3>{submission.title_ko}</h3>
                  <p className={submission.image_urls.length > 1 ? "adm-sub-note" : "adm-sub-details"}>
                    작품 1점 · 사진 {submission.image_urls.length}장
                    {submission.image_urls.length > 1 ? " — 승인하면 모든 사진이 한 작품 페이지에 묶입니다. 서로 다른 작품이면 반려 후 각각 제출해 주세요." : ""}
                  </p>
                  <p className="adm-sub-details">{submission.details_ko}</p>
                  <p className="adm-sub-desc">{submission.description_ko || "(소품 — 작품 설명 없음)"}</p>
                  <ul className="adm-sub-tags">
                    {submission.price ? <li>💰 {submission.price}</li> : null}
                    <li>분위기 {submission.mood_key}</li>
                    <li>{submission.status_key}</li>
                    {submission.palette_ko ? <li>🎨 {submission.palette_ko}</li> : null}
                    {extrasTags(submission.extras).map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                  <p className="adm-sub-time">
                    <span className={`adm-pill adm-pill-${submission.status}`}>{statusLabel(submission.status)}</span>
                    제출 {new Date(submission.created_at).toLocaleString("ko-KR")}
                    {submission.reviewed_at ? ` · 심사 ${new Date(submission.reviewed_at).toLocaleString("ko-KR")}` : ""}
                  </p>
                  {submission.status === "pending" ? <AdminReviewNote review={submission.ai_review} pending note={submission.admin_note} /> : null}
                  {submission.status === "rejected" && submission.admin_note ? <p className="adm-sub-note">반려 이유: {submission.admin_note}</p> : null}
                  {submission.status === "pending" ? (
                    <div className="adm-sub-actions">
                      <button className="adm-btn adm-btn-primary" type="button" disabled={deciding || !!stamp} onClick={() => decide(submission.id, "approved")}>
                        작품 1점 승인하고 벽에 걸기
                      </button>
                      <button className="adm-btn adm-btn-ghost" type="button" disabled={deciding || !!stamp} onClick={() => decide(submission.id, "rejected")}>
                        반려
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const WORK_ACTION_CONFIRM: Record<WorkAction, (work: ManagedWork) => string> = {
  hide: (w) => `"${w.title_ko}"을(를) 사이트에서 내릴까요? 나중에 다시 걸 수 있어요.`,
  show: (w) => `"${w.title_ko}"을(를) 다시 사이트에 걸까요?`,
  sold: (w) => `"${w.title_ko}"을(를) 판매 완료로 바꿀까요?`,
  available: (w) => `"${w.title_ko}"을(를) 다시 판매 중으로 바꿀까요?`,
  delete: (w) =>
    w.slug.startsWith("submission-")
      ? `"${w.title_ko}"을(를) 완전히 삭제할까요? 사진까지 지워지고 되돌릴 수 없어요.`
      : `"${w.title_ko}"을(를) 삭제할까요? 처음 등록한 작품이라 코드에서는 지우지 않고 사이트와 작가 포털에서 영구히 숨겨요. 운영자만 이 목록에서 다시 걸 수 있어요.`,
};

/** 사이트에 걸린 모든 작가의 작품(정적 + 승인된 포털 작품)을 내리기·판매완료·삭제한다. */
function SiteWorksPanel({ adminKey }: { adminKey: string }) {
  const [works, setWorks] = useState<ManagedWork[] | null>(null);
  const [artistFilter, setArtistFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/admin/works", { headers: authHeaders(adminKey) })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setWorks(data.works ?? []))
      .catch(() => setError("작품 목록을 불러오지 못했어요."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  const act = async (work: ManagedWork, action: WorkAction) => {
    if (!window.confirm(WORK_ACTION_CONFIRM[action](work))) return;
    setBusy(work.slug);
    setError("");
    const response = await fetch("/api/admin/works", {
      method: "POST",
      headers: { ...authHeaders(adminKey), "Content-Type": "application/json" },
      body: JSON.stringify({ slug: work.slug, action }),
    }).catch(() => null);
    if (!response?.ok) setError("처리하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    await load();
    setBusy(null);
  };

  const q = query.trim().toLowerCase();
  const shown = (works ?? []).filter(
    (w) => (artistFilter === "all" || w.artistSlug === artistFilter) && (!q || `${w.title_ko} ${w.title_en}`.toLowerCase().includes(q)),
  );
  const artistSlugs = [...new Set((works ?? []).map((w) => w.artistSlug))];

  return (
    <section className="adm-panel" id="adm-works">
      <div className="adm-panel-head">
        <div>
          <p className="adm-eyebrow">ON THE WALL</p>
          <h2>사이트 작품 관리</h2>
        </div>
        <div className="adm-works-filters">
          <select value={artistFilter} onChange={(event) => setArtistFilter(event.target.value)} aria-label="작가">
            <option value="all">모든 작가 ({works?.length ?? 0})</option>
            {artistSlugs.map((slug) => (
              <option key={slug} value={slug}>
                {artists[slug as ArtistSlug]?.name.ko ?? slug}
              </option>
            ))}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작품명 검색" aria-label="작품명 검색" />
        </div>
      </div>
      <p className="adm-muted">내리면 사이트에서만 사라지고 언제든 다시 걸 수 있어요. 판매완료는 사이트에 &ldquo;판매 완료&rdquo;로 보여요. 누르면 배포 없이 바로 반영돼요.</p>
      {error ? <p className="adm-error">{error}</p> : null}
      {works === null ? (
        <p className="adm-empty">작품을 불러오는 중…</p>
      ) : (
        <ul className="adm-works">
          {shown.map((work) => {
            const off = work.hidden || work.deleted;
            return (
              <li key={work.slug} data-off={off}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={work.image} alt="" loading="lazy" />
                <div>
                  <strong>{work.title_ko}</strong>
                  <span className="adm-works-meta">
                    {artists[work.artistSlug as ArtistSlug]?.name.ko ?? work.artistSlug}
                    {work.deleted ? <em className="adm-pill adm-pill-rejected">삭제됨</em> : work.hidden ? <em className="adm-pill adm-pill-rejected">내림</em> : <em className="adm-pill adm-pill-approved">걸림</em>}
                    {work.statusKey === "sold" ? <em className="adm-pill adm-pill-pending">판매 완료</em> : null}
                  </span>
                </div>
                <div className="adm-works-actions">
                  {off ? (
                    <button className="adm-chip" type="button" disabled={busy !== null} onClick={() => act(work, "show")}>다시 걸기</button>
                  ) : (
                    <>
                      <a className="adm-chip" href={`/artworks/${work.slug}`} target="_blank" rel="noopener noreferrer">보기 ↗</a>
                      <button className="adm-chip" type="button" disabled={busy !== null} onClick={() => act(work, "hide")}>내리기</button>
                    </>
                  )}
                  {work.statusKey === "sold" ? (
                    <button className="adm-chip" type="button" disabled={busy !== null} onClick={() => act(work, "available")}>판매 중으로</button>
                  ) : (
                    <button className="adm-chip" type="button" disabled={busy !== null} onClick={() => act(work, "sold")}>판매완료</button>
                  )}
                  {work.deleted ? null : (
                    <button className="adm-chip adm-chip-danger" type="button" disabled={busy !== null} onClick={() => act(work, "delete")}>삭제</button>
                  )}
                </div>
              </li>
            );
          })}
          {shown.length === 0 ? <li className="adm-empty">해당하는 작품이 없어요.</li> : null}
        </ul>
      )}
    </section>
  );
}

function ChangeAdminPasswordForm({ adminKey, onPasswordChanged }: { adminKey: string; onPasswordChanged: (next: string) => void }) {
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
      setError("새 비밀번호가 서로 달라요.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: authHeaders(adminKey),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (response.status === 401) {
        setError("현재 비밀번호가 맞지 않아요.");
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error === "db_not_configured" ? "DB가 아직 연결되지 않았어요." : "변경에 실패했어요.");
        return;
      }
      try {
        window.sessionStorage.setItem(STORAGE_KEY, newPassword);
      } catch {
        /* Storage is optional. */
      }
      onPasswordChanged(newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("변경 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="adm-form" onSubmit={submit}>
      <label>
        현재 비밀번호
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      </label>
      <label>
        새 비밀번호 (6자 이상)
        <input type="password" minLength={6} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      </label>
      <label>
        새 비밀번호 확인
        <input type="password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={submitting}>
        {submitting ? "변경 중..." : "비밀번호 변경"}
      </button>
      {success ? <p className="adm-ok">비밀번호가 변경됐어요.</p> : null}
      {error ? <p className="adm-error">{error}</p> : null}
    </form>
  );
}

function authHeaders(adminKey: string): HeadersInit {
  return { "x-admin-password": adminKey, "Content-Type": "application/json" };
}

/** 액자·설치 정보를 관리자 화면용 짧은 한국어 태그로. */
function extrasTags(extras: ArtworkExtras | undefined): string[] {
  if (!hasExtras(extras)) return [];
  const tags: string[] = [];
  if (extras.frame) tags.push(`🖼 ${dict[FRAME_LABEL_KEY[extras.frame]].ko}${extras.frameMaterial ? ` · ${dict[FRAME_MATERIAL_LABEL_KEY[extras.frameMaterial]].ko}` : ""}`);
  if (extras.framedWidthCm && extras.framedHeightCm) tags.push(`액자 포함 ${extras.framedWidthCm}×${extras.framedHeightCm}cm`);
  if (extras.depthCm) tags.push(`두께 ${extras.depthCm}cm`);
  if (extras.edition) tags.push(`에디션 ${extras.edition}`);
  if (extras.hangingReady) tags.push("고리·와이어 포함");
  if (extras.certificate) tags.push("보증서 제공");
  if (extras.workKind) tags.push(dict[FACT_LABELS.workKind[extras.workKind]].ko);
  if (extras.condition) tags.push(dict[FACT_LABELS.condition[extras.condition]].ko);
  if (extras.condition === "issues" && extras.conditionNoteKo) tags.push(extras.conditionNoteKo);
  if (extras.signature) tags.push(dict[FACT_LABELS.signature[extras.signature]].ko);
  if (extras.pricing) tags.push(dict[FACT_LABELS.pricing[extras.pricing]].ko);
  const proof = proofPhotos(extras);
  if (proof.length) tags.push(`실물 사진 ${proof.map(([key]) => dict[PROOF_LABEL_KEY[key]].ko).join("·")}`);
  return tags;
}

/** "9월 24일 (수) 오후 10:25" — 올해가 아니면 연도를 앞에 붙인다. */
function formatKoreanDate(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  const yearOf = (d: Date) => d.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Seoul" });
  const sameYear = yearOf(date) === yearOf(new Date());
  return date.toLocaleString("ko-KR", {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

const artistNameKo = (slug: string) => artists[slug as ArtistSlug]?.name.ko ?? slug;

/**
 * 심사가 끝난 작품(승인·반려·전체) 보관함. 한 번에 다 펼치지 않고 작가별로 접어 두며,
 * 작가 칩·제목 검색·정렬로 좁혀 본다. 줄을 누르면 그 작품의 전체 정보가 펼쳐진다.
 */
function ArchiveView({ submissions }: { submissions: Submission[] }) {
  const [artistFilter, setArtistFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"new" | "old">("new");
  const [openId, setOpenId] = useState<string | null>(null);

  const bySlug = useMemo(() => {
    const map = new Map<string, Submission[]>();
    for (const s of submissions) map.set(s.artist_slug, [...(map.get(s.artist_slug) ?? []), s]);
    return map;
  }, [submissions]);

  const q = query.trim().toLowerCase();
  const time = (s: Submission) => new Date(s.created_at).getTime();
  const groups = [...bySlug.entries()]
    .filter(([slug]) => artistFilter === "all" || slug === artistFilter)
    .map(
      ([slug, items]) =>
        [
          slug,
          items
            .filter((s) => !q || s.title_ko.toLowerCase().includes(q) || s.title_en.toLowerCase().includes(q))
            .sort((a, b) => (order === "new" ? time(b) - time(a) : time(a) - time(b))),
        ] as const,
    )
    .filter(([, items]) => items.length > 0)
    .sort((a, b) => artistNameKo(a[0]).localeCompare(artistNameKo(b[0]), "ko"));

  // 작가 하나만 보거나 검색 중이면 펼쳐 두고, 전체 작가일 때는 접어 둔다.
  const expanded = artistFilter !== "all" || groups.length === 1 || !!q;
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <div className="adm-archive">
      <div className="adm-archive-tools">
        <div className="adm-archive-chips" aria-label="작가별로 보기">
          <button type="button" className="adm-chip" aria-pressed={artistFilter === "all"} onClick={() => setArtistFilter("all")}>
            전체 작가 <span>{submissions.length}</span>
          </button>
          {[...bySlug.keys()]
            .sort((a, b) => artistNameKo(a).localeCompare(artistNameKo(b), "ko"))
            .map((slug) => (
              <button key={slug} type="button" className="adm-chip" aria-pressed={artistFilter === slug} onClick={() => setArtistFilter(slug)}>
                {artistNameKo(slug)} <span>{bySlug.get(slug)?.length}</span>
              </button>
            ))}
        </div>
        <div className="adm-archive-search">
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작품 제목으로 찾기" aria-label="작품 제목으로 찾기" />
          <select value={order} onChange={(event) => setOrder(event.target.value as "new" | "old")} aria-label="정렬">
            <option value="new">최근 올린 순</option>
            <option value="old">오래된 순</option>
          </select>
        </div>
      </div>

      {groups.length === 0 ? <p className="adm-empty">찾는 작품이 없어요.</p> : null}

      {groups.map(([slug, items]) => {
        const thumb = Object.hasOwn(artists, slug) ? artistThumb(slug as ArtistSlug) : undefined;
        const latest = items.reduce((max, s) => Math.max(max, time(s)), 0);
        return (
          <details className="adm-group" key={`${slug}-${expanded}`} open={expanded}>
            <summary>
              <span className="adm-group-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb ? <img src={thumb} alt="" /> : <span>{artistNameKo(slug).slice(0, 1)}</span>}
              </span>
              <strong>{artistNameKo(slug)}</strong>
              <span className="adm-group-count">{items.length}점</span>
              <span className="adm-group-latest">마지막 업로드 {formatKoreanDate(new Date(latest).toISOString())}</span>
            </summary>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">작품</th>
                    <th scope="col">올린 날</th>
                    <th scope="col">심사한 날</th>
                    <th scope="col">가격</th>
                    <th scope="col">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => {
                    const open = openId === s.id;
                    const tags = extrasTags(s.extras);
                    return (
                      <Fragment key={s.id}>
                        <tr
                          className="adm-row"
                          data-open={open}
                          tabIndex={0}
                          aria-expanded={open}
                          onClick={() => toggle(s.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggle(s.id);
                            }
                          }}
                        >
                          <td>
                            <span className="adm-row-work">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {s.image_urls[0] ? <img src={s.image_urls[0]} alt="" loading="lazy" /> : <span />}
                              <span>
                                <strong>{s.title_ko}</strong>
                                <small>{s.details_ko}</small>
                              </span>
                            </span>
                          </td>
                          <td>{formatKoreanDate(s.created_at)}</td>
                          <td>{formatKoreanDate(s.reviewed_at)}</td>
                          <td>{s.price ?? "–"}</td>
                          <td>
                            <span className={`adm-pill adm-pill-${s.status}`}>{s.status === "approved" ? "승인됨" : s.status === "rejected" ? "반려됨" : "심사 대기"}</span>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="adm-row-detail">
                            <td colSpan={5}>
                              <div className="adm-detail">
                                <div className="adm-detail-images">
                                  {s.image_urls.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={s.title_ko} loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                                <dl>
                                  <div><dt>제목 (영문)</dt><dd>{s.title_en}</dd></div>
                                  <div><dt>설명</dt><dd>{s.description_ko || "(소품 — 설명 없음)"}</dd></div>
                                  <div><dt>작품 정보</dt><dd>{s.details_ko}</dd></div>
                                  {s.status === "pending" ? <div><dt>대기 사유</dt><dd><AdminReviewNote review={s.ai_review} pending note={s.admin_note} /></dd></div> : null}
                                  <div><dt>분위기 · 판매</dt><dd>{s.mood_key} · {s.status_key}</dd></div>
                                  {s.palette_ko ? <div><dt>주요 색</dt><dd>{s.palette_ko}</dd></div> : null}
                                  {tags.length ? <div><dt>액자·설치</dt><dd>{tags.join(" · ")}</dd></div> : null}
                                  {s.admin_note ? <div><dt>반려 이유</dt><dd>{s.admin_note}</dd></div> : null}
                                  <div><dt>올린 날</dt><dd>{formatKoreanDate(s.created_at)}</dd></div>
                                  <div><dt>심사한 날</dt><dd>{formatKoreanDate(s.reviewed_at)}</dd></div>
                                </dl>
                                {s.status === "approved" ? (
                                  <a className="adm-chip" href={`/artworks/submission-${s.id}`} target="_blank" rel="noopener noreferrer">
                                    사이트에서 보기 ↗
                                  </a>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
