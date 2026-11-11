"use client";

import Image from "next/image";
import { useElapsed, useVisit } from "@/hooks/useVisit";
import { useLanguage, useT } from "@/lib/i18n";
import { formatClock, OPEN_VISIT_EVENT } from "@/lib/visit-log";

/**
 * The camcorder read-out that follows the wordmark's blinking red dot:
 * "REC 12:08 ▢▢▢ 작품 5점 [관람권 만들기]". The little frames are the last works this visit
 * has "recorded" — each new one slides in as the visitor opens a work, so the
 * header visibly keeps a record rather than just counting. Pressing it opens
 * the visit record and its admission ticket (VisitPanel).
 *
 * No light, no pill of its own (user, 2026-09-27): the wordmark's red dot is
 * the recording light, and REC reads as its caption.
 *
 * The start time lives in sessionStorage (visit-log.ts), so the clock keeps
 * running across pages. It renders nothing until mounted. The ticking figures
 * are aria-hidden; the button's label says what it does.
 */
export function SessionRec() {
  const { lang } = useLanguage();
  const t = useT();
  const visit = useVisit();
  const elapsed = useElapsed(visit?.start);

  if (!visit || elapsed === null) return null;
  const count = visit.works.length;
  // Oldest to newest, so the newest frame arrives at the right-hand end.
  const recent = [...visit.works].sort((a, b) => a.last - b.last).slice(-3);

  return (
    <button
      type="button"
      className="session-rec"
      aria-label={t("visitOpen")}
      onClick={(event) => window.dispatchEvent(new CustomEvent(OPEN_VISIT_EVENT, { detail: { left: event.currentTarget.getBoundingClientRect().left } }))}
    >
      <span className="session-rec-tag" aria-hidden="true">REC</span>
      <span className="session-rec-time" aria-hidden="true">{formatClock(elapsed)}</span>
      {count ? <>
        <span className="session-rec-reel" aria-hidden="true">
          {recent.map((work) => <span key={work.slug} className="session-rec-frame"><Image src={work.image} alt="" fill sizes="24px" /></span>)}
        </span>
        <span className="session-rec-count" aria-hidden="true">{lang === "ko" ? `작품 ${count}점` : `${count} ${count === 1 ? "work" : "works"}`}</span>
      </> : <span className="session-rec-count session-rec-idle" aria-hidden="true">{lang === "ko" ? "관람 기록 중" : "recording your visit"}</span>}
      {/* What the recording is for, in the shape of what it makes. */}
      <span className="session-rec-ticket" aria-hidden="true">{lang === "ko" ? "관람권 만들기" : "Make my ticket"}</span>
    </button>
  );
}
