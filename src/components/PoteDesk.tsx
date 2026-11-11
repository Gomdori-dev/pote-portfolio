"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useLanguage, useT, type DictKey, type Lang } from "@/lib/i18n";
import type { DeskAnswer } from "@/lib/desk-answer";
import { answerBuyingQuestion } from "@/lib/desk-faq";

type Message = { id: number; by: "visitor" | "desk"; text: string; links?: DeskAnswer["links"] };

function generalAnswer(question: string, lang: Lang, t: (key: DictKey) => string): DeskAnswer | null {
  const q = question.toLocaleLowerCase();
  if (/인기|많이\s*(?:본|보는|찾는|찜)|베스트|순위|popular|most viewed|best.?sell|trending|top work/.test(q)) {
    return { text: t("deskPopularity"), links: [{ href: "/taste", label: t("deskTasteLink") }, { href: "/artworks", label: t("deskBrowseLink") }] };
  }
  const known = answerBuyingQuestion(question, lang);
  if (known) return known;

  const sections: { match: RegExp; answer: DictKey; href: string; label: DictKey }[] = [
    { match: /추천|내\s?취향|어울리는\s?그림|recommend|my taste/, answer: "deskTasteAnswer", href: "/taste", label: "deskTasteLink" },
    { match: /선물|gift/, answer: "deskGiftAnswer", href: "/gift", label: "deskGiftLink" },
    { match: /작가\s?(?:지원|신청|참여)|입점|submit (?:my )?art|become an artist/, answer: "deskApplyAnswer", href: "/apply", label: "deskApplyLink" },
    { match: /이벤트|계절\s?전시|seasonal event/, answer: "deskEventAnswer", href: "/event", label: "deskEventLink" },
    { match: /전시|exhibition/, answer: "deskExhibitionAnswer", href: "/exhibitions", label: "deskExhibitionLink" },
    { match: /찜|즐겨찾기|저장|favorite|saved work/, answer: "deskFavoritesAnswer", href: "/favorites", label: "deskFavoritesLink" },
    { match: /작품.*(?:찾|둘러|목록)|그림.*(?:찾|둘러|목록)|browse (?:art|work)|find (?:art|work)/, answer: "deskBrowseAnswer", href: "/artworks", label: "deskBrowseLink" },
    { match: /포트\s?갤러리|pote|어떤\s?사이트|what is this site/, answer: "deskAbout", href: "/guide", label: "deskGuideLink" },
  ];
  const section = sections.find(({ match }) => match.test(q));
  if (section) return { text: t(section.answer), links: [{ href: section.href, label: t(section.label) }] };
  return null;
}

export function PoteDesk({ open, visible, onToggle, onClose }: { open: boolean; visible: boolean; onToggle: () => void; onClose: () => void }) {
  const { lang } = useLanguage();
  const t = useT();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const nextId = useRef(1);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, by: "desk", text: t("deskWelcome") }]);

  // True while the question box has focus, i.e. the phone keyboard is up.
  // On phones the panel then docks to the top of the screen (globals.css
  // [data-typing]) so the keyboard can't cover the box or the latest reply.
  const [typing, setTyping] = useState(false);
  const baseHeight = useRef(0);
  // Set once a keyboard has actually been measured during this focus, so its
  // disappearance (Android back button, "done" key) can end typing mode by
  // itself instead of leaving the panel shrunk over an empty screen.
  const keyboardShown = useRef(false);

  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    baseHeight.current = Math.max(baseHeight.current, window.innerHeight, viewport.height);
    const updatePosition = () => {
      const panel = panelRef.current;
      if (!panel) return;
      // Mobile keyboards shrink the visual viewport while fixed elements can
      // stay anchored to the larger layout viewport (notably in in-app browsers).
      const coveredBottom = Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
      panel.style.setProperty("--desk-visible-height", `${viewport.height}px`);
      panel.style.setProperty("--desk-covered-bottom", `${coveredBottom}px`);
      // Instagram's Android in-app browser (user, 2026-09-27) reports no
      // change at all when its keyboard opens: innerHeight and the visual
      // viewport stay full size, so the lines above never move the panel and
      // the keyboard sits on top of it. When no shrink is visible while
      // typing, assume the keyboard takes the lower ~64% (Samsung keyboard
      // with its toolbar measured 58% there, plus a margin) and fit the panel above it.
      const base = Math.max(baseHeight.current, window.innerHeight);
      if (document.activeElement !== inputRef.current) baseHeight.current = base;
      const keyboardSeen = viewport.height < base - 120 || window.innerHeight < base - 120;
      const focused = document.activeElement === inputRef.current;
      if (!focused) keyboardShown.current = false;
      else if (keyboardSeen) keyboardShown.current = true;
      else if (keyboardShown.current) {
        keyboardShown.current = false;
        inputRef.current?.blur();
      }
      panel.style.setProperty("--desk-typing-top", `${Math.max(0, viewport.offsetTop) + 8}px`);
      // Keep a larger safety gap when an in-app browser gives us no keyboard
      // measurements. The old 220px CSS minimum could undo this limit.
      panel.style.setProperty("--desk-typing-height", `${Math.round(keyboardSeen ? viewport.height - 16 : base * 0.32)}px`);
    };
    updatePosition();
    // Chromium's VirtualKeyboard API reports the keyboard directly where the
    // viewport does not change.
    const keyboard = (navigator as Navigator & { virtualKeyboard?: EventTarget & { boundingRect: DOMRect } }).virtualKeyboard;
    const onKeyboard = () => {
      if (!keyboard) return;
      if (keyboard.boundingRect.height > 0) keyboardShown.current = true;
      else if (keyboardShown.current && document.activeElement === inputRef.current) {
        keyboardShown.current = false;
        inputRef.current?.blur();
      }
    };
    keyboard?.addEventListener("geometrychange", onKeyboard);
    viewport.addEventListener("resize", updatePosition);
    viewport.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      keyboard?.removeEventListener("geometrychange", onKeyboard);
      viewport.removeEventListener("resize", updatePosition);
      viewport.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);
  // No automatic focus on touch screens: it threw the keyboard over the
  // welcome line and the prompt chips the moment the panel opened.
  useEffect(() => { if (open && !window.matchMedia("(hover: none)").matches) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (typing) logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [typing]);
  useEffect(() => { if (open && messages.length > 1) logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open]);

  async function ask(value: string) {
    const text = value.trim();
    if (!text || pending) return;
    setQuestion("");
    // The conversation so far (not the welcome line), so the AI can follow up.
    const history = messages.slice(1).slice(-8).map(({ by, text: said }) => ({ by, text: said.slice(0, 1200) }));
    setMessages((items) => [...items, { id: nextId.current++, by: "visitor", text }]);
    // The public buying guide already has an exact answer to these common
    // questions. Show it immediately instead of waiting for a model request.
    const quick = pathname?.startsWith("/artworks/") ? null : answerBuyingQuestion(text, lang);
    if (quick) {
      setMessages((items) => [...items, { id: nextId.current++, by: "desk", ...quick }]);
      return;
    }
    setPending(true);
    try {
      const match = pathname?.match(/^\/artworks\/([^/]+)$/);
      const response = await fetch("/api/desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, lang, contextSlug: match?.[1], history }),
      });
      if (!response.ok) throw new Error("desk request failed");
      const { ai, ...answer }: DeskAnswer & { ai?: boolean } = await response.json();
      // The AI answers everything when it is available (desk-ai.ts). When it is
      // not — no key, free quota used up — the fixed guide answers come first,
      // then the server's keyword match.
      const known = ai ? null : generalAnswer(text, lang, t);
      setMessages((items) => [...items, { id: nextId.current++, by: "desk", ...(known ?? answer) }]);
    } catch {
      setMessages((items) => [...items, { id: nextId.current++, by: "desk", text: t("deskError"), links: [{ href: "/inquiry", label: t("deskInquiryLink") }] }]);
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || pending) return;
    // Keep the cursor and phone keyboard ready for the next question.
    // Focus during submission only, so a later reply cannot steal focus.
    inputRef.current?.focus({ preventScroll: true });
    void ask(question);
  }

  // Instagram's in-app browser gives no keyboard signal at all, so touching
  // the conversation to read it also closes the keyboard and restores the sheet.
  const panel = (
    <section id="pote-desk-panel" ref={panelRef} className="pote-desk-panel" role="dialog" aria-label={t("deskTitle")} hidden={!open} data-typing={typing}>
      <header className="pote-desk-heading"><div><span className="pote-desk-eyebrow">POTE GALLERY</span><h2>{t("deskTitle")}</h2><p>{t("deskSubtitle")}</p></div><button type="button" className="pote-desk-expand" onClick={() => { inputRef.current?.blur(); setTyping(false); }} aria-label={t("deskExpand")}>{t("deskExpand")}</button><button type="button" className="pote-desk-close" onClick={onClose} aria-label={t("deskClose")}>×</button></header>
      <div className="pote-desk-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" onPointerDown={() => { if (document.activeElement === inputRef.current) inputRef.current?.blur(); }}>
        {messages.map((message) => <div key={message.id} className={`pote-desk-message ${message.by}`}><p>{message.text}</p>{message.links?.length ? <div className="pote-desk-links">{message.links.map((link) => <Link key={`${message.id}-${link.href}`} href={link.href} onClick={onClose}>{link.label} <span aria-hidden="true">↗</span></Link>)}</div> : null}</div>)}
        {messages.length === 1 ? <div className="pote-desk-prompts">{(["deskPromptRoom", "deskPromptGift", "deskPromptPay"] as const).map((key) => <button type="button" key={key} onClick={() => void ask(t(key))}>{t(key)}</button>)}</div> : null}
        {pending ? <p className="pote-desk-thinking">{t("deskSearching")}</p> : null}
      </div>
      <form className="pote-desk-form" onSubmit={submit}><label className="sr-only" htmlFor="pote-desk-question">{t("deskQuestionLabel")}</label><input id="pote-desk-question" ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={200} placeholder={t("deskPlaceholder")} onFocus={() => setTyping(true)} onBlur={() => window.setTimeout(() => setTyping(document.activeElement === inputRef.current), 150)} /><button type="submit" disabled={!question.trim() || pending} aria-label={t("deskSend")} onPointerDown={(event) => event.preventDefault()}>↗</button></form>
    </section>
  );

  return <>
    <div className="pote-desk-launcher">
      <span className="pote-desk-launcher-label">{t("deskTitle")}</span>
      <button type="button" className="pote-desk-trigger" aria-expanded={open} aria-controls="pote-desk-panel" aria-label={t(open ? "deskClose" : "deskOpen")} tabIndex={visible ? 0 : -1} onClick={onToggle}>
        <span className="pote-desk-mark" aria-hidden="true">P</span>
      </button>
    </div>
    {open && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
  </>;
}
