"use client";

import { BgmToggle } from "@/components/SiteBgm";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionRec } from "@/components/SessionRec";
import { VisitPanel } from "@/components/VisitPanel";
import { useVisit } from "@/hooks/useVisit";
import { OPEN_VISIT_EVENT } from "@/lib/visit-log";
import { notePath } from "@/lib/nav-history";
import { usePathname } from "next/navigation";
import { PoteDesk } from "@/components/PoteDesk";
import { T, useLanguage, useT } from "@/lib/i18n";

// Was a flag dropdown across ten languages; cut back to a two-way toggle
// 2026-09-19 when the site itself did (see the note by `Lang` in i18n.tsx) —
// with only ko/en left, a single click beats opening a menu to pick one of two.
function LanguageSelector() {
  const { lang, toggle } = useLanguage();
  const t = useT();
  return (
    <button type="button" className="lang-toggle" onClick={toggle} aria-label={t("languageSelectorLabel")}>
      {lang === "ko" ? "KR" : "EN"}
    </button>
  );
}

function FloatingNav() {
  // Visible from first paint now — this is the site's only nav (the header's
  // own <nav> and mobile menu were dropped as duplicates of this one), so it
  // can't wait for a scroll threshold the way an earlier, supplementary
  // version of it did. It used to duck out once the footer was on screen, but
  // that read as "the menu vanished" at the bottom of every page (2026-09-27
  // user report), so it now stays; the footer gets bottom room in globals.css
  // instead so the buttons never sit on its links.
  const visible = true;
  const [open, setOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const { lang } = useLanguage();
  const visitCount = useVisit()?.works.length ?? 0;
  const t = useT();

  useEffect(() => {
    // Phones: the round buttons step aside while reading down the page (they
    // covered cards and links) and come back as soon as the visitor scrolls up.
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // At the very bottom there is no "scroll up" left to bring them back.
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      if (atBottom) { setTucked(false); lastY = y; return; }
      if (Math.abs(y - lastY) > 8) { setTucked(y > lastY && y > 240); lastY = y; }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Phones, site rule (user, 2026-09-28): while a swipeable picture row, the
  // room preview, purchase steps or the taste quiz answers sit where the round buttons are
  // (bottom-right), the buttons step aside so they never block a swipe or a
  // tap. New swipe galleries get `data-swipe-gallery` and are covered too.
  // Rows can mount without a scroll (a tapped room thumbnail), hence the DOM
  // watch as well as scroll.
  const [overSwipe, setOverSwipe] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia("(max-width:700px)");
    const AREAS = "[data-swipe-gallery], .playlist-rail, .scroll-row, .detail-visual, .detail-title-row, .detail-actions, .pote-form label, .pote-form button[type=submit], .inquiry-receipt, .detail-strip, .visit-thumbs, .room-preview, .quiz-actions, .home-paths, .home-buying-steps";
    const BUTTON_ZONE = 170; // px from the bottom of the screen the round buttons take up
    let frame = 0;
    const check = () => {
      frame = 0;
      if (!phone.matches) { setOverSwipe(false); return; }
      const bottom = window.innerHeight;
      const ctaHeight = document.querySelector(".detail-mobile-cta")?.getBoundingClientRect().height ?? 0;
      setOverSwipe([...document.querySelectorAll(AREAS)].some((area) => {
        const box = area.getBoundingClientRect();
        return box.height > 0 && box.bottom > bottom - BUTTON_ZONE - ctaHeight && box.top < bottom - 10;
      }));
    };
    const schedule = () => { if (!frame) frame = window.setTimeout(check, 60); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.clearTimeout(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);


  useEffect(() => {
    if (!open && !deskOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setDeskOpen(false); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, deskOpen]);

  useEffect(() => {
    const openCurator = () => { setOpen(false); setDeskOpen(true); };
    window.addEventListener("pote:open-curator", openCurator);
    return () => window.removeEventListener("pote:open-curator", openCurator);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className={`floating-nav ${visible ? "visible" : ""} ${(tucked || overSwipe) && !open && !deskOpen ? "tucked" : ""}`}>
      <div
        id="floating-nav-panel"
        className="floating-nav-panel"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(8px)",
          visibility: open ? "visible" : "hidden",
          transition: open
            ? "opacity .18s ease, transform .18s ease, visibility 0s linear 0s"
            : "opacity .18s ease, transform .18s ease, visibility 0s linear .18s",
        }}
      >
        <Link className="floating-nav-event" href="/event" onClick={close}><span className="header-event-dot" aria-hidden="true" /><T k="navEvent" /></Link>
        <Link href="/artworks" onClick={close}><T k="menuArtworks" /></Link>
        <Link href="/inquiry" onClick={close}><T k="footerInquiry" /></Link>
        <Link href="/taste" onClick={close}><T k="menuTaste" /></Link>
        <Link href="/artists" onClick={close}><T k="menuArtists" /></Link>
        <Link href="/exhibitions" onClick={close}><T k="menuExhibitions" /></Link>
        <Link href="/artworks/sold" onClick={close}><T k="menuSold" /></Link>
        <Link href="/about" onClick={close}><T k="menuAbout" /></Link>
        {/* Now this menu's only appearance on narrow screens (the header's own
            hamburger + slide-down panel were dropped as a duplicate) — Saved
            needs a way in here too, since .header-actions .text-button hides
            it below that breakpoint. */}
        {/* Phones hide the header's REC badge, so the visit record opens from here. */}
        <button type="button" className="floating-nav-visit" onClick={() => { close(); window.dispatchEvent(new Event(OPEN_VISIT_EVENT)); }}>
          <T k="visitTitle" />{visitCount ? <small>{lang === "ko" ? `작품 ${visitCount}점` : `${visitCount} ${visitCount === 1 ? "work" : "works"}`}</small> : null}
        </button>
        <Link className="floating-nav-favorites" href="/favorites" onClick={close}><T k="navFavorites" /></Link>
        {/* Phones drop 작가로 참여하기 from the crowded header (user, 2026-09-27),
            so it lives here instead; wider screens keep the header button. */}
        <Link className="floating-nav-apply" href="/apply" onClick={close}><T k="navApply" /></Link>
      </div>
      <button
        type="button"
        className="floating-nav-trigger"
        aria-expanded={open}
        aria-controls="floating-nav-panel"
        aria-label={open ? t("menuClose") : t("menuOpen")}
        tabIndex={visible ? 0 : -1}
        onClick={() => { setDeskOpen(false); setOpen((v) => !v); }}
      >
        <span className="menu-bar" style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }} />
        <span className="menu-bar" style={{ opacity: open ? 0 : 1 }} />
        <span className="menu-bar" style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }} />
      </button>
      <PoteDesk key={lang} open={deskOpen} visible={visible} onToggle={() => { setOpen(false); setDeskOpen((v) => !v); }} onClose={() => setDeskOpen(false)} />
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  // Remembers in-site moves for BackButton.
  useEffect(() => { if (pathname) notePath(pathname); }, [pathname]);
  return (
    <>
    <header className="site-header">
      <div className="site-header-brand">
        {/* English wordmark with one recording light shared by the REC readout. */}
        <Link className="brand brand-lockup" href="/" aria-label="Pote Gallery 포트 갤러리"><span className="brand-word"><span className="brand-en brand-text">POTE</span></span><span className="brand-word"><span className="brand-en brand-text">GALLERY</span></span><span className="brand-dot" aria-hidden="true" /></Link>
        <SessionRec />
        <VisitPanel />
      </div>
      {/* The horizontal nav and its mobile hamburger/slide-down panel used to
          live here, duplicating the same 5 links FloatingNav already shows —
          now that it's visible immediately instead of only after scrolling,
          it's the site's one nav and this header only needs its own actions. */}
      <div className="header-actions">
        {/* The season's exhibition (/event). Up here, not in the page body, so
            a promotion never competes with the artwork on the page itself. */}
        <Link className="header-event" href="/event"><span className="header-event-dot" aria-hidden="true" /><T k="navEvent" /></Link>
        <BgmToggle />
        <LanguageSelector />
        <Link className="text-button" href="/favorites"><T k="navFavorites" /></Link>
        <Link className="outline-button" href="/apply"><span className="apply-label-full"><T k="navApply" /></span><span className="apply-label-short"><T k="navApplyShort" /></span></Link>
      </div>
    </header>
    <FloatingNav />
    </>
  );
}
