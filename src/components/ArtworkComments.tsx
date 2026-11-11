"use client";

import { useEffect, useId, useState } from "react";
import { T, useLanguage, useT } from "@/lib/i18n";

// 작품 상세 "한 줄 감상"(구매 버튼 아래). 남긴 글은 운영자가 승인한 뒤에만 보인다.
const COMMENT_MAX = 80;
const NICKNAME_MAX = 12;
// 작품 정보가 너무 밀리지 않게 처음엔 최근 몇 개만 보인다.
const VISIBLE = 3;

type Comment = { id: string; nickname: string | null; body: string; createdAt: string };
type Status = "idle" | "sending" | "sent" | "error" | "has_link" | "rate_limited";

export function ArtworkComments({ slug }: { slug: string }) {
  const t = useT();
  const { lang } = useLanguage();
  const headingId = useId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/artwork-comments?slug=${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : { comments: [] }))
      .then((data) => { if (alive) setComments(Array.isArray(data.comments) ? data.comments : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (body.trim().length < 2 || status === "sending") return;
    setStatus("sending");
    try {
      const response = await fetch("/api/artwork-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, nickname, body, website }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { setStatus("sent"); setBody(""); return; }
      setStatus(data.error === "has_link" || data.error === "rate_limited" ? data.error : "error");
    } catch {
      setStatus("error");
    }
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  return <section className="artwork-comments" aria-labelledby={headingId}>
    <h2 id={headingId}><T k="commentsHeading" /></h2>
    {comments.length > 0
      ? <><ul>{(showAll ? comments : comments.slice(0, VISIBLE)).map((comment) => <li key={comment.id}><p>{comment.body}</p><small>{comment.nickname || t("commentsAnonymous")} · {date(comment.createdAt)}</small></li>)}</ul>
        {comments.length > VISIBLE && !showAll ? <button type="button" className="artwork-comments-more" onClick={() => setShowAll(true)}><T k="commentsMore" /> ({comments.length - VISIBLE})</button> : null}</>
      : <p className="artwork-comments-empty"><T k="commentsEmpty" /></p>}
    {status === "sent"
      ? <p className="artwork-comments-note" role="status"><T k="commentsSent" /></p>
      : <form onSubmit={submit}>
        <label className="artwork-comments-body">
          <span className="sr-only"><T k="commentsBodyLabel" /></span>
          <textarea value={body} maxLength={COMMENT_MAX} rows={2} required placeholder={t("commentsBodyPlaceholder")} onChange={(event) => setBody(event.target.value)} />
          <small aria-hidden="true">{body.length}/{COMMENT_MAX}</small>
        </label>
        <div className="artwork-comments-row">
          <label>
            <span className="sr-only"><T k="commentsNicknameLabel" /></span>
            <input value={nickname} maxLength={NICKNAME_MAX} placeholder={t("commentsNicknamePlaceholder")} onChange={(event) => setNickname(event.target.value)} />
          </label>
          {/* 사람에게는 보이지 않는 칸: 봇만 채운다. */}
          <input className="artwork-comments-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(event) => setWebsite(event.target.value)} />
          <button className="outline-button" type="submit" disabled={status === "sending" || body.trim().length < 2}>{status === "sending" ? <T k="formSending" /> : <T k="commentsSubmit" />}</button>
        </div>
        <p className="artwork-comments-note" role={status === "idle" || status === "sending" ? undefined : "alert"}>
          {status === "has_link" ? <T k="commentsNoLinks" /> : status === "rate_limited" ? <T k="commentsRateLimited" /> : status === "error" ? <T k="commentsError" /> : <T k="commentsReviewNote" />}
        </p>
      </form>}
  </section>;
}
