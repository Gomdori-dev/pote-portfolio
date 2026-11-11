"use client";

// 운영자용 "한 줄 감상" 검토 칸. 관리자 대시보드(/admin/submissions)와
// /admin/comments가 함께 쓴다. 운영자만 보므로 한국어로만 쓴다.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type CommentStatus = "pending" | "approved" | "rejected";
type Comment = { id: string; slug: string; nickname: string | null; body: string; status: CommentStatus; createdAt: string };
type Tab = CommentStatus | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "확인 전" },
  { key: "approved", label: "보이는 중" },
  { key: "rejected", label: "숨김" },
  { key: "all", label: "전체" },
];
const STATUS_LABEL: Record<CommentStatus, string> = { pending: "확인 전", approved: "보이는 중", rejected: "숨김" };

export function AdminCommentsBoard({ headers, onPendingChange }: { headers: () => HeadersInit; onPendingChange?: (pending: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/comments", { headers: headers() }).catch(() => null);
    if (!response) return setError("불러오지 못했어요. 잠시 뒤 새로고침해 주세요.");
    if (response.status === 401) return setError("관리자 로그인이 필요해요.");
    if (!response.ok) return setError("불러오지 못했어요. 잠시 뒤 새로고침해 주세요.");
    const list: Comment[] = (await response.json()).comments ?? [];
    setError("");
    setComments(list);
    onPendingChange?.(list.filter((comment) => comment.status === "pending").length);
  }, [headers, onPendingChange]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  async function act(id: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !window.confirm("이 감상을 완전히 지울까요?")) return;
    setBusy(id);
    await fetch("/api/admin/comments", { method: "POST", headers: { "Content-Type": "application/json", ...headers() }, body: JSON.stringify({ id, action }) }).catch(() => null);
    setBusy("");
    await load();
  }

  const count = (key: Tab) => (comments ?? []).filter((comment) => key === "all" || comment.status === key).length;
  const shown = (comments ?? []).filter((comment) => tab === "all" || comment.status === tab);

  return <section className="adm-panel adm-comments-board" id="adm-comments">
    <div className="adm-panel-head">
      <div>
        <p className="adm-eyebrow">VISITOR NOTES</p>
        <h2>한 줄 감상</h2>
      </div>
      <div className="adm-tabs" role="tablist">
        {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={key === tab} className="adm-tab" onClick={() => setTab(key)}>
          {label}<span>{comments ? count(key) : "·"}</span>
        </button>)}
      </div>
    </div>
    {error ? <p className="adm-error">{error}</p> : null}
    {comments === null && !error ? <p className="adm-empty">감상을 불러오는 중…</p> : null}
    {comments && shown.length === 0 ? <div className="adm-empty"><p>{tab === "pending" ? "확인할 감상이 없어요." : "해당하는 감상이 없어요."}</p></div> : null}
    {shown.length > 0 ? <ul className="adm-comment-list">{shown.map((comment) => <li key={comment.id} data-status={comment.status}>
      <div className="adm-comment-meta"><strong>{STATUS_LABEL[comment.status]}</strong> · <Link href={`/artworks/${comment.slug}`} target="_blank">{comment.slug}</Link> · {comment.nickname || "익명"} · {new Date(comment.createdAt).toLocaleString("ko-KR")}</div>
      <p>{comment.body}</p>
      <div className="adm-comment-actions">
        {comment.status !== "approved" ? <button type="button" disabled={busy === comment.id} onClick={() => act(comment.id, "approve")}>승인</button> : null}
        {comment.status !== "rejected" ? <button type="button" disabled={busy === comment.id} onClick={() => act(comment.id, "reject")}>숨기기</button> : null}
        <button type="button" disabled={busy === comment.id} onClick={() => act(comment.id, "delete")}>삭제</button>
      </div>
    </li>)}</ul> : null}
  </section>;
}
