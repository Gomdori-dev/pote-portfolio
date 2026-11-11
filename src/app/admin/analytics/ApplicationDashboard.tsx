"use client";

import { useState } from "react";
import { useAdminJson } from "./FunnelDashboard";

type Row = { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null; visits: number; starts: number; applications: number; converted: number; unmatched: number };
type Report = { collectionStart: string | null; rows: Row[] };
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const money = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const rate = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : "—";

export function ApplicationDashboard() {
  const [from, setFrom] = useState(() => today().slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [campaign, setCampaign] = useState("artist_recruit_next");
  const [content, setContent] = useState("carousel_a");
  const load = useAdminJson<Report>(`/api/admin/analytics/applications?from=${from}&to=${to}`);
  const params = new URLSearchParams({ utm_source: "meta", utm_medium: "paid_social", utm_campaign: campaign, utm_content: content });
  const link = `https://potegallery.com/apply?${params}`;
  const validId = (s: string) => /^[A-Za-z0-9_.~-]{1,160}$/.test(s);
  return <section className="adm-panel" id="application-performance">
    <p className="adm-eyebrow" style={{ textAlign: "center", color: "#E06D3B" }}>ARTIST APPLICATIONS</p>
    <h2 style={{ textAlign: "center" }}>작가 모집 광고 · 신청 성과</h2>
    <p className="adm-hint">신청 접수는 메일 서비스가 수락한 건수입니다. 메일 도착·참여 확정과 구분하며, 같은 내용의 재전송은 한 번만 집계합니다.</p>
    <div className="adm-fx-filters">
      <label>시작일 <input type="date" aria-label="신청 성과 시작일" value={from} onChange={e => { setFrom(e.target.value); setCosts({}); }} /></label>
      <label>종료일 <input type="date" aria-label="신청 성과 종료일" value={to} onChange={e => { setTo(e.target.value); setCosts({}); }} /></label>
    </div>
    {load.state === "loading" ? <p role="status">신청 성과 불러오는 중…</p> : load.state === "error" ? <p className="adm-error" role="alert">{load.message}</p> : <>
      <p className="adm-hint">수집 시작: {load.data.collectionStart ? new Date(load.data.collectionStart).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "아직 수집된 기록 없음"} · 한국 시간 기준</p>
      {!load.data.rows.length ? <p>선택 기간에 수집된 신청 추적 기록이 없습니다. 과거 신청은 소급해 광고에 연결하지 않습니다.</p> : <div className="adm-fx-table-wrap"><table className="adm-fx-table adm-fx-table-left">
        <thead><tr><th>매체 / 캠페인 / 소재 / 광고 세트</th><th>모집 방문</th><th>입력 시작</th><th>접수</th><th>방문→접수율</th><th>기간 광고비(원)</th><th>신청당 비용</th></tr></thead>
        <tbody>{load.data.rows.map(row => {
          const key = JSON.stringify([row.source, row.medium, row.campaign, row.content, row.term]);
          const cost = costs[key] ?? "";
          const label = [row.source ?? "직접·미확인", row.medium, row.campaign ?? "캠페인 미확인", row.content ?? "소재 미확인", row.term].filter(Boolean).join(" / ");
          return <tr key={key}><td>{label}{row.unmatched > 0 ? <small style={{ display: "block" }}>기간 내 방문 기록과 미연결 접수 {row.unmatched}건</small> : null}</td><td>{row.visits}</td><td>{row.starts}</td><td>{row.applications}</td><td>{rate(row.converted, row.visits)}</td><td><input type="number" min="0" step="1" aria-label={`${label} 광고비`} value={cost} style={{ width: "110px" }} onChange={e => setCosts(v => ({ ...v, [key]: e.target.value }))} /></td><td>{cost !== "" && Number.isFinite(Number(cost)) && Number(cost) >= 0 && row.applications > 0 ? money(Number(cost) / row.applications) : "—"}</td></tr>;
        })}</tbody>
      </table></div>}
      <p className="adm-hint">방문·입력 시작은 같은 방문에서 각 1회입니다. 신청률은 기간 내 모집 방문 중 같은 기간에 접수된 방문의 비율입니다. 방문 기록이 차단됐거나 기간 밖에 있으면 접수만 표시합니다. 광고비는 각 행과 동일한 기간·소재 범위의 Meta 매체비(부가세 제외)를 입력하세요. 입력한 비용은 이 화면에서만 계산하며 새로고침·기간 변경 시 초기화됩니다.</p>
    </>}
    <details><summary>다음 광고용 추적 링크 만들기</summary>
      <p>광고마다 캠페인과 소재 식별값을 구분해 사용하세요. 영문·숫자·밑줄·하이픈·점만 사용하고 개인정보는 넣지 마세요.</p>
      <div className="adm-fx-filters"><label>캠페인 <input value={campaign} onChange={e => setCampaign(e.target.value)} /></label><label>소재 <input value={content} onChange={e => setContent(e.target.value)} /></label></div>
      {validId(campaign) && validId(content) ? <><label>광고 목적지 URL <textarea readOnly value={link} style={{ width: "100%", minHeight: "90px" }} onFocus={e => e.currentTarget.select()} /></label><p className="adm-hint">Meta 광고의 웹사이트 URL에 전체 주소를 넣으세요. 각 소재에는 서로 다른 소재값을 사용하세요.</p></> : <p role="alert">캠페인·소재 식별값을 1~160자의 영문·숫자·밑줄·하이픈·점으로 입력해 주세요.</p>}
    </details>
  </section>;
}
