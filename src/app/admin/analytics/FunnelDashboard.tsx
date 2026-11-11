"use client";

// 방문 → 작품 상세 → 문의 화면 → 문의 발송 성공 드릴다운 (2026-10-20).
// 필터·드릴 단계는 모두 URL 쿼리에 있어서 뒤로 가기·새로고침·링크 공유로 그대로 복원된다.
// 숫자가 없으면 0이 아니라 "미수집"/"오류"로 보여 준다.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "pote_admin_key";
const STEP_LABEL: Record<string, string> = { visit: "방문 세션", view: "작품 상세 조회", open: "작품 문의 화면 진입", done: "작품 문의 발송 성공" };
const KIND_LABEL: Record<string, string> = { artwork: "작품 문의", general: "일반 문의", collaboration: "협업 문의", artist_application: "작가 신청", feedback: "의견 보내기", other: "기타(분류 정보 없음)" };
const INTENT_LABEL: Record<string, string> = { buy: "구매 요청", offer: "가격 제안", photos: "사진 요청", availability: "구매 가능 여부", details: "작품 정보", delivery: "배송", other: "기타" };
const DEVICE_LABEL: Record<string, string> = { mobile: "모바일", tablet: "태블릿", desktop: "PC" };
const STATUS_LABEL: Record<string, string> = { uncollected: "미수집", partial_start: "수집 시작일(일부)", today: "오늘(진행 중)", collected: "수집" };

type Funnel = { step: string; sessions: number; dropped: number; inProgress: number }[];
type Daily = { day: string; status: string; legacyViews: number | null; sessions?: number; visitors?: number; pageViews?: number; view?: number; open?: number; done?: number; inquiries?: number; artworkInquiries?: number };
type Overview = {
  collectionStart: string | null; collectionStartDay: string | null; range: { from: string; to: string };
  totals: { sessions: number; visitors: number; pageViews: number } | null; funnel: Funnel;
  formSteps: Record<"inquiry_start" | "inquiry_invalid" | "inquiry_error", number>;
  inquiries: { total: number; byKind: Record<string, number>; multiArtwork: number };
  daily: Daily[];
  artworks: { slug: string; title: string | null; artistSlug: string | null; artistName: string | null; views: number; viewSessions: number; openSessions: number; inquiries: number; singleInquiries: number }[];
  artists: { artistSlug: string | null; artistName: string; works: number; views: number; inquiries: number }[];
  sources: { source: string; funnel: Funnel; inquiries: number }[];
  devices: { device: string; sessions: number; done: number }[];
  prevPaths: { path: string; label: string | null; views: number }[];
  legacyError: boolean; artistOptions: { slug: string; name: string }[];
};
type Journeys = {
  total: number; offset: number; pageSize: number;
  items: { label: string; day: string; startedAt: string; device: string; source: string; landing: string; inProgress: boolean; steps: { view: boolean; open: boolean; done: boolean };
    events: { at: string; type: string; path: string; artwork: string | null; artworks: string[]; intent: string | null }[];
    inquiries: { at: string; ref: string | null; kind: string; intent: string | null; artworks: string[] }[] }[];
};
type Load<T> = { state: "loading" } | { state: "error"; message: string; status?: number } | { state: "ok"; data: T };

const fmt = (value: number) => value.toLocaleString("ko-KR");
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "–");
// 24시간 표기: 이동 기록에서 시각만 잘라 보여도 오전/오후가 헷갈리지 않게 한다.
const time = (value: string) => new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" }).format(new Date(value));
const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function authHeaders(): HeadersInit {
  try {
    const key = window.sessionStorage.getItem(STORAGE_KEY);
    return key ? { "x-admin-password": key } : {};
  } catch { return {}; }
}

/** 관리자 API 호출. 401은 세션 만료로, 그 밖의 실패는 오류로 구분한다. */
export function useAdminJson<T>(url: string) {
  // 결과마다 요청 주소를 붙여 둔다. 주소가 바뀐 직후 이전 화면의 데이터를 새 화면으로 읽지 않게 한다.
  const [result, setResult] = useState<{ url: string; load: Load<T> } | null>(null);
  useEffect(() => {
    let active = true;
    fetch(url, { headers: authHeaders(), cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (response.ok) setResult({ url, load: { state: "ok", data: body as T } });
        else setResult({ url, load: { state: "error", status: response.status, message: response.status === 401 ? "관리자 로그인이 만료되었어요. 관리자 메인에서 다시 로그인해 주세요." : body?.message ?? `조회 오류 (HTTP ${response.status})` } });
      })
      .catch(() => { if (active) setResult({ url, load: { state: "error", message: "네트워크 오류로 불러오지 못했어요." } }); });
    return () => { active = false; };
  }, [url]);
  return result && result.url === url ? result.load : ({ state: "loading" } as Load<T>);
}

function ErrorBox({ load }: { load: Extract<Load<unknown>, { state: "error" }> }) {
  return (
    <div className="adm-fx-error" role="alert">
      <strong>{load.status === 401 ? "로그인 필요" : "오류"}</strong> {load.message}
      {load.status === 401 ? <> <Link href="/admin/submissions">관리자 로그인 →</Link></> : null}
    </div>
  );
}

/** 관리자 메인 상단의 작은 요약(최근 7일). */
export function FunnelSummaryPanel() {
  const today = kstToday();
  const load = useAdminJson<Overview>(`/api/admin/analytics/funnel?from=${addDays(today, -6)}&to=${today}`);
  const data = load.state === "ok" ? load.data : null;
  const value = (n: number | undefined) => (data?.collectionStart && n !== undefined ? fmt(n) : "미수집");
  return (
    <section className="adm-panel adm-fx-summary" aria-label="방문·문의 분석 요약">
      <p className="adm-eyebrow">VISITS → INQUIRIES · 최근 7일</p>
      <h2>방문·문의 분석</h2>
      {load.state === "error" ? <ErrorBox load={load} /> : (
        <div className="adm-fx-summary-row">
          <div><span>순방문자</span><strong>{load.state === "loading" ? "…" : value(data?.totals?.visitors ?? (data?.collectionStart ? 0 : undefined))}</strong></div>
          <div><span>작품 상세 조회 세션</span><strong>{load.state === "loading" ? "…" : value(data?.funnel[1].sessions)}</strong></div>
          <div><span>작품 문의 화면 진입</span><strong>{load.state === "loading" ? "…" : value(data?.funnel[2].sessions)}</strong></div>
          <div><span>문의 발송 성공(전체)</span><strong>{load.state === "loading" ? "…" : value(data?.inquiries.total)}</strong></div>
        </div>
      )}
      <Link className="adm-btn adm-fx-cta" href="/admin/analytics">드릴다운 분석 열기 →</Link>
    </section>
  );
}

export function FunnelDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const qs = params.toString();
  const mode = params.get("mode") === "journeys" ? "journeys" : "overview";
  const apiUrl = `/api/admin/analytics/funnel?${qs}`;
  const load = useAdminJson<Overview & Journeys>(apiUrl);

  // 목록 위치 복원: 다른 단계로 가기 전 스크롤을 URL별로 저장해 두었다가,
  // 뒤로/앞으로 가기로 그 URL에 돌아왔을 때만 데이터가 그려진 뒤 되살린다.
  const restoreRef = useRef(false);
  useEffect(() => {
    const onPop = () => { restoreRef.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useLayoutEffect(() => {
    if (load.state !== "ok" || !restoreRef.current) return;
    restoreRef.current = false;
    try {
      const saved = sessionStorage.getItem(`adm-fx-scroll:${qs}`);
      // 사이트 전체가 scroll-behavior:smooth라 즉시 이동을 명시한다.
      if (saved) requestAnimationFrame(() => window.scrollTo({ top: Number(saved), behavior: "instant" }));
    } catch {}
  }, [load.state, qs]);

  // restore=true: 경로 표시·이전 단계로 올라갈 때, 그 단계에서 보던 위치로 돌아간다.
  const go = useCallback((changes: Record<string, string | null>, restore = false) => {
    try { sessionStorage.setItem(`adm-fx-scroll:${qs}`, String(window.scrollY)); } catch {}
    const next = new URLSearchParams(qs);
    for (const [key, value] of Object.entries(changes)) { if (value === null || value === "") next.delete(key); else next.set(key, value); }
    if (!("offset" in changes)) next.delete("offset");
    restoreRef.current = restore;
    router.push(`/admin/analytics?${next.toString()}`, { scroll: false });
    if (!restore) requestAnimationFrame(() => document.getElementById("adm-fx")?.scrollIntoView({ block: "start", behavior: "instant" }));
  }, [qs, router]);

  // 경로 표시: 기간 → 날짜 → 유입 → 작가 → 작품 → 이동 기록. 각 단계를 누르면 그 아래 필터를 지운다.
  const crumbs = useMemo(() => {
    const list: { label: string; changes: Record<string, string | null> }[] = [];
    const rf = params.get("rf"), rt = params.get("rt");
    const from = params.get("from"), to = params.get("to");
    const base = { mode: null, step: null, outcome: null, day: null, artwork: null, artist: null, source: null };
    list.push({ label: rf ? `${rf} ~ ${rt}` : from ? `${from} ~ ${to}` : "최근 7일", changes: rf ? { ...base, from: rf, to: rt, rf: null, rt: null } : base });
    if (rf && from) list.push({ label: from, changes: { mode: null, step: null, outcome: null, day: null, artwork: null, artist: null, source: null } });
    if (params.get("source")) list.push({ label: `유입: ${params.get("source")}`, changes: { mode: null, step: null, outcome: null, day: null, artwork: null, artist: null } });
    if (params.get("artist")) list.push({ label: `작가: ${params.get("artistName") ?? params.get("artist")}`, changes: { mode: null, step: null, outcome: null, day: null, artwork: null } });
    if (params.get("artwork")) list.push({ label: `작품: ${params.get("artworkTitle") ?? params.get("artwork")}`, changes: { mode: null, step: null, outcome: null, day: null } });
    if (mode === "journeys") list.push({ label: `이동 기록 · ${STEP_LABEL[params.get("step") ?? "visit"]} ${params.get("outcome") === "dropped" ? "이탈" : params.get("outcome") === "progress" ? "진행 중" : "도달"}${params.get("day") ? ` · ${params.get("day")}` : ""}`, changes: {} });
    return list;
  }, [params, mode]);

  const setRange = (from: string, to: string) => go({ from, to, rf: null, rt: null, day: null, mode: null });
  const today = kstToday();
  const overview = load.state === "ok" && mode === "overview" ? (load.data as Overview) : null;
  const journeys = load.state === "ok" && mode === "journeys" ? (load.data as Journeys) : null;
  const drillDay = (day: string) => go({ from: day, to: day, rf: params.get("rf") ?? params.get("from") ?? addDays(today, -6), rt: params.get("rt") ?? params.get("to") ?? today, mode: null });
  const journeysOf = (step: string, outcome: string, day?: string) => go({ mode: "journeys", step, outcome, day: day ?? null });

  return (
    <section id="adm-fx" className="adm-fx" aria-label="방문·문의 드릴다운">
      <div className="adm-panel">
        <p className="adm-eyebrow adm-fx-center">FILTER</p>
        <h2 className="adm-fx-center">기간·필터</h2>
        <div className="adm-fx-filters">
          <div className="adm-fx-presets" role="group" aria-label="기간 선택">
            <button type="button" className="adm-chip" onClick={() => setRange(today, today)}>오늘</button>
            <button type="button" className="adm-chip" onClick={() => setRange(addDays(today, -6), today)}>최근 7일</button>
            <button type="button" className="adm-chip" onClick={() => setRange(addDays(today, -29), today)}>최근 30일</button>
          </div>
          {/* key로 URL 기간이 바뀔 때마다 입력칸을 현재 기간으로 다시 채운다. */}
          <form key={`${params.get("from")}~${params.get("to")}`} className="adm-fx-range" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const from = String(data.get("from") ?? ""), to = String(data.get("to") ?? "");
            if (from && to) setRange(from, to);
          }}>
            <label>시작<input type="date" name="from" defaultValue={params.get("from") ?? addDays(today, -6)} max={today} required /></label>
            <label>종료<input type="date" name="to" defaultValue={params.get("to") ?? today} max={today} required /></label>
            <button type="submit" className="adm-chip adm-fx-apply">직접 기간 적용</button>
          </form>
          {overview ? (
            <div className="adm-fx-selects">
              <label>작가<select value={params.get("artist") ?? ""} onChange={(event) => go({ artist: event.target.value || null, artistName: event.target.selectedOptions[0]?.text ?? null, artwork: null, artworkTitle: null, mode: null })}>
                <option value="">전체 작가</option>
                {overview.artistOptions.map((artist) => <option key={artist.slug} value={artist.slug}>{artist.name}</option>)}
              </select></label>
              <label>유입<select value={params.get("source") ?? ""} onChange={(event) => go({ source: event.target.value || null, mode: null })}>
                <option value="">전체 유입</option>
                {[...new Set([params.get("source") ?? "", ...overview.sources.map((row) => row.source)])].filter(Boolean).map((source) => <option key={source} value={source}>{source}</option>)}
              </select></label>
            </div>
          ) : null}
        </div>
        <nav className="adm-fx-crumbs" aria-label="현재 위치">
          {crumbs.length > 1 ? <button type="button" className="adm-chip adm-fx-up" onClick={() => go(crumbs[crumbs.length - 2].changes, true)}>← 이전 단계</button> : null}
          <ol>{crumbs.map((crumb, index) => <li key={crumb.label + index}>{index < crumbs.length - 1 ? <button type="button" onClick={() => go(crumb.changes, true)}>{crumb.label}</button> : <strong aria-current="page">{crumb.label}</strong>}</li>)}</ol>
        </nav>
      </div>

      {load.state === "loading" ? <div className="adm-panel adm-fx-center adm-hint">불러오는 중…</div> : null}
      {load.state === "error" ? <div className="adm-panel"><ErrorBox load={load} /></div> : null}
      {overview ? <OverviewView data={overview} params={params} go={go} drillDay={drillDay} journeysOf={journeysOf} /> : null}
      {journeys ? <JourneysView data={journeys} go={go} /> : null}

      <details className="adm-panel adm-fx-defs">
        <summary>숫자 기준 보기</summary>
        <ul>
          <li><b>순방문자</b>: 브라우저마다 만든 무작위 익명 번호 기준. 같은 사람이 다른 기기·브라우저를 쓰거나 저장소를 지우면 따로 셉니다.</li>
          <li><b>세션</b>: 30분 동안 아무 이동이 없으면 끝납니다. 날짜는 세션이 시작된 한국 시간 날짜에 들어갑니다.</li>
          <li><b>퍼널</b>: 같은 세션 안에서 작품 상세 → 그 뒤 작품 문의 화면 → 그 뒤 작품 문의 발송 성공 순서로 일어난 경우만 셉니다. 세션마다 한 번만 셉니다.</li>
          <li><b>발송 성공</b>: 서버가 메일 발송 서비스(Resend)의 접수 응답을 받은 문의입니다. 받은편지함 도착이나 판매 확정과는 다릅니다. 기록 저장에 실패하면 실제보다 적게 보일 수 있습니다.</li>
          <li><b>자정을 넘긴 문의</b>: 퍼널에서는 세션 시작일에, 날짜별 &lsquo;문의(발송일)&rsquo; 칸에서는 발송한 날짜에 들어갑니다.</li>
          <li><b>이탈/진행 중</b>: 다음 단계 없이 세션이 끝났으면 이탈, 마지막 이동이 30분 안이면 아직 진행 중으로 따로 표시합니다.</li>
          <li><b>여러 작품 문의</b>: 전체 문의에서는 1건, 작품별 표에서는 포함된 작품마다 &lsquo;관련 문의&rsquo;로 셉니다(괄호 안은 그 작품만 문의한 건수).</li>
          <li><b>제외</b>: 관리자 로그인·관리자 IP, 관리자·작가 도구 화면, 봇으로 보이는 접속, 자동화 브라우저, 운영 외 환경(로컬·미리보기)은 기록하지 않습니다. 이름·이메일·전화·문의 내용·IP는 분석 표에 저장하지 않습니다.</li>
          <li><b>기존 조회 기록</b>: 예전 visits 표의 페이지 조회 수입니다. 봇·시험 방문이 섞일 수 있고 클릭·문의 정보는 없습니다.</li>
        </ul>
      </details>
    </section>
  );
}

type Go = (changes: Record<string, string | null>) => void;

function OverviewView({ data, params, go, drillDay, journeysOf }: { data: Overview; params: URLSearchParams; go: Go; drillDay: (day: string) => void; journeysOf: (step: string, outcome: string, day?: string) => void }) {
  const collected = Boolean(data.collectionStart);
  const top = data.funnel[0].sessions;
  const maxDaily = Math.max(1, ...data.daily.map((row) => row.sessions ?? 0));
  const artworkFilter = params.get("artwork");
  return (
    <>
      <p className="adm-fx-note">
        {collected ? <>새 퍼널 수집 시작: <b>{time(data.collectionStart!)}</b> (한국 시간). 이 시점 이전은 &lsquo;미수집&rsquo;입니다.</> : <>아직 새 퍼널 기록이 없습니다(미수집). 운영 사이트에 반영된 뒤 첫 방문부터 쌓입니다.</>}
      </p>

      <section className="adm-tiles adm-fx-tiles" aria-label="기간 합계">
        <div className="adm-tile"><span>순방문자</span><strong>{data.totals ? fmt(data.totals.visitors) : collected ? 0 : "미수집"}</strong><small>브라우저 익명 번호 기준</small></div>
        <div className="adm-tile"><span>세션</span><strong>{data.totals ? fmt(data.totals.sessions) : collected ? 0 : "미수집"}</strong><small>30분 무활동 시 종료</small></div>
        <div className="adm-tile"><span>페이지 조회</span><strong>{data.totals ? fmt(data.totals.pageViews) : collected ? 0 : "미수집"}</strong><small>세션 안의 모든 화면 이동</small></div>
        <div className="adm-tile"><span>문의 발송 성공</span><strong>{collected ? fmt(data.inquiries.total) : "미수집"}</strong><small>{collected ? Object.entries(data.inquiries.byKind).map(([kind, count]) => `${KIND_LABEL[kind] ?? kind} ${count}`).join(" · ") || "이 기간 문의 없음" : "발송일 기준"}</small></div>
      </section>

      <div className="adm-panel">
        <p className="adm-eyebrow adm-fx-center">FUNNEL</p>
        <h2 className="adm-fx-center">방문에서 문의까지</h2>
        {!collected ? <p className="adm-empty">미수집</p> : (
          <ol className="adm-fx-funnel">
            {data.funnel.map((row, index) => (
              <li key={row.step}>
                <button type="button" className="adm-fx-bar" onClick={() => journeysOf(row.step, "reached")} aria-label={`${STEP_LABEL[row.step]} ${row.sessions}세션 이동 기록 보기`}>
                  <span className="adm-fx-bar-fill" style={{ width: `${top ? Math.max(2, (row.sessions / top) * 100) : 0}%` }} />
                  <span className="adm-fx-bar-text"><b>{STEP_LABEL[row.step]}</b><em>{fmt(row.sessions)}</em><small>{index === 0 ? "기준" : `처음 대비 ${pct(row.sessions, top)} · 이전 단계 대비 ${pct(row.sessions, data.funnel[index - 1].sessions)}`}</small></span>
                </button>
                {index < data.funnel.length - 1 ? (
                  <div className="adm-fx-drop">
                    <button type="button" className="adm-chip adm-chip-danger" disabled={!row.dropped} onClick={() => journeysOf(row.step, "dropped")}>여기서 이탈 {fmt(row.dropped)}</button>
                    {row.inProgress ? <button type="button" className="adm-chip" onClick={() => journeysOf(row.step, "progress")}>진행 중 {fmt(row.inProgress)}</button> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {collected && data.inquiries.byKind.artwork !== undefined && data.inquiries.byKind.artwork !== data.funnel[3].sessions ? (
          <p className="adm-hint adm-fx-center">작품 문의 발송 {fmt(data.inquiries.byKind.artwork)}건 중 퍼널 순서(상세 → 문의 화면 → 발송)를 같은 세션에서 거친 세션은 {fmt(data.funnel[3].sessions)}개입니다. 찜 목록 묶음 문의·다른 날 시작한 세션·여러 번 문의 등은 차이가 날 수 있습니다{data.inquiries.multiArtwork ? ` (여러 작품 묶음 문의 ${data.inquiries.multiArtwork}건)` : ""}.</p>
        ) : null}
        {collected ? (
          <p className="adm-hint adm-fx-center">문의 화면 안: 입력 시작 <b>{fmt(data.formSteps.inquiry_start)}</b>세션 · 빈 필수 칸 때문에 막힘 {fmt(data.formSteps.inquiry_invalid)} · 발송 실패 {fmt(data.formSteps.inquiry_error)} (10/30부터 수집, 모든 문의 종류 포함)</p>
        ) : null}
      </div>

      <div className="adm-panel">
        <p className="adm-eyebrow adm-fx-center">DAILY</p>
        <h2 className="adm-fx-center">날짜별 현황</h2>
        <div className="adm-fx-chart" role="img" aria-label="날짜별 세션 막대그래프">
          {data.daily.map((row) => (
            <button key={row.day} type="button" className="adm-fx-col" data-status={row.status} onClick={() => drillDay(row.day)} title={row.sessions === undefined ? `${row.day} 미수집` : `${row.day} 세션 ${row.sessions}`}>
              <span className="adm-fx-col-bar" style={{ height: row.sessions === undefined ? "100%" : `${Math.max(2, ((row.sessions ?? 0) / maxDaily) * 100)}%` }}>{row.done ? <i style={{ height: `${Math.max(6, ((row.done ?? 0) / Math.max(1, row.sessions ?? 1)) * 100)}%` }} /> : null}</span>
              <small>{shortDay(row.day)}</small>
            </button>
          ))}
        </div>
        <p className="adm-hint adm-fx-center"><span className="adm-fx-key adm-fx-key-bar" /> 세션 <span className="adm-fx-key adm-fx-key-done" /> 작품 문의 발송 성공 세션 <span className="adm-fx-key adm-fx-key-none" /> 미수집 · 막대를 누르면 그날로 들어갑니다.</p>
        <div className="adm-fx-table-wrap">
          <table className="adm-fx-table">
            <thead><tr><th>날짜</th><th>상태</th><th>순방문자</th><th>세션</th><th>페이지 조회</th><th>상세 조회</th><th>문의 화면</th><th>발송 성공<br /><small>(세션 기준)</small></th><th>문의<br /><small>(발송일, 전체)</small></th><th>기존 조회 기록</th></tr></thead>
            <tbody>
              {data.daily.slice().reverse().map((row) => {
                const cell = (value: number | undefined, step?: string) => value === undefined ? <td className="adm-fx-na">미수집</td> : <td>{step && value ? <button type="button" className="adm-fx-link" onClick={() => journeysOf(step, "reached", row.day)}>{fmt(value)}</button> : fmt(value)}</td>;
                return (
                  <tr key={row.day}>
                    <th scope="row"><button type="button" className="adm-fx-link" onClick={() => drillDay(row.day)}>{row.day}</button></th>
                    <td><span className="adm-fx-status" data-status={row.status}>{STATUS_LABEL[row.status]}</span></td>
                    {cell(row.visitors)}{cell(row.sessions, "visit")}{cell(row.pageViews)}{cell(row.view, "view")}{cell(row.open, "open")}{cell(row.done, "done")}{cell(row.inquiries)}
                    <td className={row.legacyViews === null ? "adm-fx-err" : undefined}>{row.legacyViews === null ? "오류" : fmt(row.legacyViews)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.legacyError ? <p className="adm-error adm-fx-center">기존 visits 표 조회에 실패해 &lsquo;기존 조회 기록&rsquo;을 오류로 표시했습니다.</p> : null}
      </div>

      {artworkFilter && data.prevPaths.length ? (
        <div className="adm-panel">
          <p className="adm-eyebrow adm-fx-center">DISCOVERY</p>
          <h2 className="adm-fx-center">이 작품을 보기 직전 화면</h2>
          <div className="adm-fx-table-wrap"><table className="adm-fx-table adm-fx-table-left">
            <thead><tr><th>직전 화면</th><th>조회 수</th></tr></thead>
            <tbody>{data.prevPaths.map((row) => <tr key={row.path}><th scope="row">{row.label ? <>{row.label} {row.path ? <code>{row.path}</code> : null}</> : <code>{row.path}</code>}</th><td>{fmt(row.views)}</td></tr>)}</tbody>
          </table></div>
          <p className="adm-hint adm-fx-center">외부 유입 경로는 아래 &lsquo;유입별&rsquo; 표에서 이 작품 기준으로 보입니다.</p>
        </div>
      ) : null}

      {!params.get("artist") && !artworkFilter ? (
        <div className="adm-panel">
          <p className="adm-eyebrow adm-fx-center">ARTISTS</p>
          <h2 className="adm-fx-center">작가별</h2>
          {!collected ? <p className="adm-empty">미수집</p> : data.artists.length === 0 ? <p className="adm-empty">이 기간 작품 조회 0건</p> : (
            <div className="adm-fx-table-wrap"><table className="adm-fx-table adm-fx-table-left">
              <thead><tr><th>작가</th><th>조회된 작품 수</th><th>상세 조회(회)</th><th>관련 문의</th></tr></thead>
              <tbody>{data.artists.map((row) => (
                <tr key={row.artistSlug ?? "none"}>
                  <th scope="row">{row.artistSlug ? <button type="button" className="adm-fx-link" onClick={() => go({ artist: row.artistSlug, artistName: row.artistName, artwork: null, artworkTitle: null, mode: null })}>{row.artistName}</button> : <span className="adm-fx-na">{row.artistName}</span>}</th>
                  <td>{fmt(row.works)}</td><td>{fmt(row.views)}</td><td>{fmt(row.inquiries)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ) : null}

      <div className="adm-panel">
        <p className="adm-eyebrow adm-fx-center">ARTWORKS</p>
        <h2 className="adm-fx-center">작품별</h2>
        {!collected ? <p className="adm-empty">미수집</p> : data.artworks.length === 0 ? <p className="adm-empty">이 조건에서 작품 조회 0건</p> : (
          <div className="adm-fx-table-wrap"><table className="adm-fx-table adm-fx-table-left">
            <thead><tr><th>작품</th><th>작가</th><th>상세 조회(회)</th><th>조회 세션</th><th>문의 화면 세션</th><th>관련 문의<br /><small>(단독)</small></th></tr></thead>
            <tbody>{data.artworks.map((row) => (
              <tr key={row.slug} aria-current={row.slug === artworkFilter ? "true" : undefined}>
                <th scope="row">{row.title ? <button type="button" className="adm-fx-link" onClick={() => go({ artwork: row.slug, artworkTitle: row.title, mode: null })}>{row.title}</button> : <span className="adm-fx-na" title={row.slug}>매칭 불가 ({row.slug.slice(0, 20)})</span>}</th>
                <td>{row.artistName ?? <span className="adm-fx-na">–</span>}</td><td>{fmt(row.views)}</td><td>{fmt(row.viewSessions)}</td><td>{fmt(row.openSessions)}</td><td>{fmt(row.inquiries)} <small>({fmt(row.singleInquiries)})</small></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <div className="adm-panel">
        <p className="adm-eyebrow adm-fx-center">SOURCES</p>
        <h2 className="adm-fx-center">유입별</h2>
        {!collected ? <p className="adm-empty">미수집</p> : data.sources.length === 0 ? <p className="adm-empty">이 조건에서 세션 0개</p> : (
          <div className="adm-fx-table-wrap"><table className="adm-fx-table adm-fx-table-left">
            <thead><tr><th>유입</th><th>세션</th><th>상세 조회</th><th>문의 화면</th><th>발송 성공</th><th>방문→발송</th></tr></thead>
            <tbody>{data.sources.map((row) => (
              <tr key={row.source}>
                <th scope="row"><button type="button" className="adm-fx-link" onClick={() => go({ source: row.source, mode: null })}>{row.source}</button></th>
                {row.funnel.map((step) => <td key={step.step}>{fmt(step.sessions)}</td>)}<td>{pct(row.funnel[3].sessions, row.funnel[0].sessions)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {collected && data.devices.length ? <p className="adm-hint adm-fx-center">기기: {data.devices.map((row) => `${DEVICE_LABEL[row.device] ?? row.device} ${fmt(row.sessions)}세션(발송 ${fmt(row.done)})`).join(" · ")}</p> : null}
      </div>
    </>
  );
}

function JourneysView({ data, go }: { data: Journeys; go: Go }) {
  const eventText = (event: Journeys["items"][number]["events"][number]) => {
    if (event.type === "artwork_view") return <>작품 상세 · <b>{event.artwork}</b></>;
    if (event.type === "inquiry_start") return <>문의 입력 시작</>;
    if (event.type === "inquiry_invalid") return <>문의 보내기 막힘(빈 필수 칸)</>;
    if (event.type === "inquiry_error") return <>문의 발송 실패</>;
    if (event.type === "inquiry_open") return <>문의 화면{event.artworks.length ? <> · <b>{event.artworks.join(", ")}</b></> : " (작품 없음)"}{event.intent ? ` · ${INTENT_LABEL[event.intent] ?? event.intent}` : ""}</>;
    return <code>{event.path}</code>;
  };
  return (
    <div className="adm-panel">
      <p className="adm-eyebrow adm-fx-center">JOURNEYS</p>
      <h2 className="adm-fx-center">익명 이동 기록</h2>
      <p className="adm-hint adm-fx-center">조건에 맞는 세션 {fmt(data.total)}개 · 최근 시작 순 · 번호는 무작위 익명 표시입니다.</p>
      {data.items.length === 0 ? <p className="adm-empty">해당 세션 0개</p> : (
        <ol className="adm-fx-journeys">
          {data.items.map((item) => (
            <li key={item.label + item.startedAt}>
              <header>
                <strong>#{item.label}</strong>
                <span>{time(item.startedAt)} · {DEVICE_LABEL[item.device] ?? item.device} · 유입 {item.source}</span>
                <span className="adm-fx-steps">{item.steps.view ? "상세 ✓" : "상세 –"} {item.steps.open ? "문의화면 ✓" : "문의화면 –"} {item.steps.done ? "발송 ✓" : item.inProgress ? "진행 중" : "발송 –"}</span>
              </header>
              <ol className="adm-fx-timeline">
                {item.events.map((event, index) => <li key={index}><time>{time(event.at).split(" ").slice(-1)}</time> {eventText(event)}</li>)}
                {item.inquiries.map((inquiry, index) => <li key={`i${index}`} className="adm-fx-done"><time>{time(inquiry.at).split(" ").slice(-1)}</time> <b>{KIND_LABEL[inquiry.kind] ?? inquiry.kind} 발송 성공</b>{inquiry.intent ? ` · ${INTENT_LABEL[inquiry.intent] ?? inquiry.intent}` : ""}{inquiry.artworks.length ? ` · ${inquiry.artworks.join(", ")}` : ""}{inquiry.ref ? <> · 접수번호 <code>{inquiry.ref}</code></> : null}</li>)}
              </ol>
            </li>
          ))}
        </ol>
      )}
      {data.total > data.offset + data.pageSize || data.offset > 0 ? (
        <div className="adm-fx-pager">
          <button type="button" className="adm-chip" disabled={data.offset === 0} onClick={() => go({ offset: String(Math.max(0, data.offset - data.pageSize)) })}>← 이전 {data.pageSize}개</button>
          <span>{fmt(data.offset + 1)}–{fmt(Math.min(data.total, data.offset + data.pageSize))} / {fmt(data.total)}</span>
          <button type="button" className="adm-chip" disabled={data.total <= data.offset + data.pageSize} onClick={() => go({ offset: String(data.offset + data.pageSize) })}>다음 {data.pageSize}개 →</button>
        </div>
      ) : null}
    </div>
  );
}
