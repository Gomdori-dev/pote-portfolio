"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { FunnelDashboard } from "./FunnelDashboard";
import { ApplicationDashboard } from "./ApplicationDashboard";

type AnalyticsData = {
  today: {
    total: number;
    byPath: Record<string, number>;
    byIp: Array<{ ip: string; count: number }>;
  };
  week: Array<{ date: string; count: number }>;
};

// 2026-10-20: 위쪽에 방문→문의 드릴다운(FunnelDashboard)을 더하고, 기존 visits 표 조회는
// 아래 "기존 조회 기록"으로 그대로 둔다. 기존 표는 COUNT(*)라 순방문자가 아니라 페이지 조회 수다.
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        let key: string | null = null;
        try { key = window.sessionStorage.getItem("pote_admin_key"); } catch {}
        const res = await fetch("/api/admin/analytics", { headers: key ? { "x-admin-password": key } : {}, cache: "no-store" });
        if (res.status === 401) throw new Error("관리자 로그인이 만료되었어요. 관리자 메인에서 다시 로그인해 주세요.");
        if (!res.ok) throw new Error(`조회 오류 (HTTP ${res.status})`);
        const json = (await res.json()) as AnalyticsData;
        setData(json);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  return (
    <main className="adm">
      <header className="adm-top">
        <div>
          <p className="adm-eyebrow">POTE BACKSTAGE · ANALYTICS</p>
          <h1>방문·문의 분석<br /><em>어디서 와서, 어디서 멈추고, 얼마나 문의로 이어지는지.</em></h1>
        </div>
        <Link className="adm-btn adm-btn-ghost" href="/admin/submissions">← 관리자 메인</Link>
      </header>

      <ApplicationDashboard />
      <Suspense fallback={<div className="adm-panel adm-hint">불러오는 중…</div>}>
        <FunnelDashboard />
      </Suspense>

      <LegacyVisits data={data} loading={loading} error={error} />
    </main>
  );
}

function LegacyVisits({ data, loading, error }: { data: AnalyticsData | null; loading: boolean; error: string }) {
  if (loading) return <div className="adm-panel adm-hint">기존 조회 기록 불러오는 중…</div>;
  if (error) return <div className="adm-panel"><p className="adm-error">기존 조회 기록 오류: {error}</p></div>;
  if (!data) return <div className="adm-panel adm-empty">데이터 없음</div>;

  const todayCount = data.today.total;
  const yesterdayCount = data.week[data.week.length - 2]?.count || 0;
  const change = todayCount - yesterdayCount;
  const changePercent =
    yesterdayCount > 0
      ? Math.round((change / yesterdayCount) * 100)
      : todayCount > 0
        ? 100
        : 0;

  const sortedPaths = Object.entries(data.today.byPath)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const sortedIps = data.today.byIp.slice(0, 10);

  return (
    <section className="adm-panel adm-fx-legacy">
      <p className="adm-eyebrow adm-fx-center">LEGACY · VISITS</p>
      <h2 className="adm-fx-center">기존 조회 기록</h2>
      <p className="adm-hint adm-fx-center">예전 visits 표의 페이지 조회 수(한국 시간 기준)입니다. 봇·시험 방문이 섞일 수 있고, 클릭·문의 정보는 없습니다.</p>

      <div className="adm-fx-legacy-today">
        <div>
          <strong>{todayCount}</strong>
          <span>오늘 페이지 조회</span>
        </div>
        <div>
          <strong className={change >= 0 ? "adm-ok" : "adm-error"}>
            {change >= 0 ? "+" : ""}{change} ({changePercent}%)
          </strong>
          <span>어제 대비</span>
        </div>
      </div>

      <h3>오늘 경로별 조회 (상위 10)</h3>
      <div className="adm-fx-table-wrap">
        <table className="adm-fx-table adm-fx-table-left">
          <thead><tr><th>경로</th><th>조회</th></tr></thead>
          <tbody>
            {sortedPaths.map(([path, count]) => (
              <tr key={path}><th scope="row"><code>{path}</code></th><td>{count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>오늘 IP별 조회 (상위 10)</h3>
      <div className="adm-fx-table-wrap">
        <table className="adm-fx-table adm-fx-table-left">
          <thead><tr><th>IP 주소</th><th>조회 수</th><th>비고</th></tr></thead>
          <tbody>
            {sortedIps.map((row) => (
              <tr key={row.ip}>
                <th scope="row"><code>{row.ip}</code></th>
                <td>{row.count}</td>
                <td>{row.ip === "121.167.51.143" && "← 당신"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>지난 7일 추이</h3>
      <div className="adm-fx-table-wrap">
        <table className="adm-fx-table adm-fx-table-left">
          <thead><tr><th>날짜</th><th>조회</th></tr></thead>
          <tbody>
            {data.week.map((row) => (
              <tr key={row.date}><th scope="row">{row.date}</th><td>{row.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="adm-hint">
        자동 새로고침이 없습니다. 브라우저 새로고침으로 최신 데이터를 확인하세요. <code>121.167.51.143</code>(당신의 IP)는 자동으로 제외됩니다.
      </p>
    </section>
  );
}
