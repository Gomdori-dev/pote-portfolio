"use client";

import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Noto_Serif_KR } from "next/font/google";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useElapsed, useVisit } from "@/hooks/useVisit";
import { useLanguage, useT } from "@/lib/i18n";
import { safeArtworkHref } from "@/lib/artwork-route";
import { formatDuration, formatEntry, OPEN_VISIT_EVENT, worksByTime } from "@/lib/visit-log";
import { drawVisitTicket } from "@/lib/visit-ticket";
import { SOCIAL_HOLD_SLUGS } from "@/lib/social-holds";

// Faces for the admission ticket only. Not preloaded: they download the first
// time a ticket is drawn (document.fonts.load in visit-ticket.ts).
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], display: "swap", preload: false });
const serif = Noto_Serif_KR({ subsets: ["latin"], weight: ["400", "500"], display: "swap", preload: false });

type Ticket = { url: string; file: File; canShare: boolean };

/**
 * "오늘의 관람 기록": opened from the header's REC badge (desktop) or the menu
 * (phones). Shows this visit's works and turns them into an admission ticket
 * image to save or share. Rendered into <body> so the header's backdrop-filter
 * can't become the containing block of its fixed layers.
 */
export function VisitPanel() {
  const { lang } = useLanguage();
  const t = useT();
  const visit = useVisit();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const elapsed = useElapsed(visit?.start, open);

  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  useEffect(() => {
    const toggle = (event: Event) => {
      const anchor = event instanceof CustomEvent ? (event.detail as { left?: number } | null)?.left : undefined;
      setLeft(typeof anchor === "number" ? anchor : null);
      setOpen((value) => !value);
    };
    window.addEventListener(OPEN_VISIT_EVENT, toggle);
    return () => window.removeEventListener(OPEN_VISIT_EVENT, toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // A new ticket each time the panel opens: the visit keeps going.
  useEffect(() => {
    if (open || !ticket) return;
    URL.revokeObjectURL(ticket.url);
    queueMicrotask(() => { setTicket(null); setFailed(false); });
  }, [open, ticket]);

  if (!mounted || !open || !visit) return null;

  const works = worksByTime(visit);
  const duration = formatDuration(elapsed ?? 0, lang);
  const entry = formatEntry(visit.start);
  const summary = lang === "ko"
    ? works.length ? `${entry} 입장 · ${duration} 동안 ${works.length}점을 보셨어요` : `${entry} 입장 · ${duration}째 관람 중`
    : works.length ? `In at ${entry} · ${works.length} ${works.length === 1 ? "work" : "works"} in ${duration}` : `In at ${entry} · ${duration} so far`;
  const longest = works[0];
  const shareable = works.filter((work) => !SOCIAL_HOLD_SLUGS.has(work.slug));
  const longestSecs = longest ? Math.round(longest.ms / 1000) : 0;

  async function makeTicket() {
    if (!visit || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const blob = await drawVisitTicket(visit, lang, { display: display.style.fontFamily, serif: serif.style.fontFamily });
      const file = new File([blob], `pote-ticket-${visit.no}.jpg`, { type: "image/jpeg" });
      const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      setTicket({ url: URL.createObjectURL(blob), file, canShare });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!ticket) return;
    try {
      await navigator.share({ files: [ticket.file], title: t("visitShareTitle") });
    } catch { /* cancelled */ }
  }

  const close = () => setOpen(false);

  return createPortal(
    <div className="visit-layer">
      <button type="button" className="visit-backdrop" aria-label={t("visitClose")} onClick={close} />
      <section className="visit-panel" role="dialog" aria-labelledby="visit-title" style={left !== null ? { left: `${Math.max(12, Math.min(left - 22, window.innerWidth - Math.min(392, window.innerWidth - 24) - 12))}px` } : undefined}>
        <button type="button" className="visit-close" onClick={close} aria-label={t("visitClose")}>×</button>
          <p className="visit-eyebrow">TODAY&apos;S VISIT</p>
          <h2 id="visit-title">{t("visitTitle")}</h2>
          <p className="visit-summary">{summary}</p>
          {works.length ? <>
            <div className="visit-thumbs">
              {works.map((work) => <Link key={work.slug} href={safeArtworkHref({ slug: work.slug })} onClick={close} aria-label={`${work.artist[lang]} · ${work.title[lang]}`}>
                <Image src={work.image} alt="" fill sizes="64px" />
              </Link>)}
            </div>
            {longest ? <p className="visit-longest">{t("visitLongest")} · <b>{longest.artist[lang]} 「{longest.title[lang]}」</b> {Math.floor(longestSecs / 60)}′{String(longestSecs % 60).padStart(2, "0")}″</p> : null}
            {shareable.length ? <button type="button" className="visit-button" onClick={makeTicket} disabled={busy}>{busy ? t("visitMaking") : t("visitMake")}</button> : <p className="visit-empty">{t("visitHeldOnly")}</p>}
            {shareable.length && shareable.length < works.length ? <p className="visit-fine">{t("visitHeldNote")}</p> : null}
            {failed ? <p className="visit-error">{t("visitFailed")}</p> : null}
          </> : <>
            <p className="visit-empty">{t("visitEmpty")}</p>
            <Link className="visit-button" href="/artworks" onClick={close}>{t("visitBrowse")}</Link>
          </>}
          <p className="visit-fine">{t("visitPrivate")}</p>
      </section>
      {/* The ticket itself, as large as the screen allows. */}
      {ticket ? <div className="visit-viewer" role="dialog" aria-modal="true" aria-labelledby="visit-ticket-title">
        <h2 id="visit-ticket-title" className="sr-only">{t("visitTicketTitle")}</h2>
        <button type="button" className="visit-viewer-close" onClick={() => setTicket(null)} aria-label={t("visitBack")}>×</button>
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL made just now; nothing for the optimiser to do */}
        <img src={ticket.url} alt={t("visitTicketAlt")} width={1080} height={1350} />
        <div className="visit-viewer-actions">
          {ticket.canShare ? <button type="button" className="visit-button" onClick={share}>{t("visitShare")}</button> : null}
          <a className="visit-button" href={ticket.url} download={ticket.file.name}>{t("visitSave")}</a>
        </div>
      </div> : null}
    </div>,
    document.body,
  );
}
