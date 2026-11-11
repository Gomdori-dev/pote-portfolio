"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * Site-wide background music. The <audio> lives in the root layout (above
 * route content) so client-side navigation never remounts it; the on/off
 * control is `BgmToggle`, in the header next to 이벤트.
 *
 * It starts by itself (user, 2026-09-25). Browsers refuse audible autoplay
 * until the visitor has interacted with the page, so: try at once, and if
 * that is refused, start on the first tap, click or key press anywhere.
 * Turning it off is remembered (localStorage) so it never restarts on the
 * next page or the next visit against the visitor's wishes.
 *
 * The track itself is picked at random on every fresh mount -- a hard
 * refresh or a new visit, never a same-tab route change -- rather than kept
 * to the current season or a remembered pick (user, 2026-09-27: "브금
 * 4개니까 새로고침·재방문마다 랜덤으로"). Picking one from the panel still
 * changes it live for the rest of the visit; it just isn't saved as next
 * time's default any more.
 *
 * Work tools, not the gallery visit -- no music there (user, 2026-09-27:
 * "관리자페이지에선 음악 안나오게 해야지 작가페이지랑 음악이 나옴"). The
 * public artist bios at /artists are untouched; only the portal/studio/admin
 * work surfaces are excluded.
 */
const NO_BGM_PREFIXES = ["/admin", "/artist-portal", "/artist-studio"];
function isNoBgmPath(pathname: string | null) {
  return !!pathname && NO_BGM_PREFIXES.some((p) => pathname.startsWith(p));
}

const STORAGE_KEY = "pote-bgm";
const VOLUME_KEY = "pote-bgm-volume";
const TRACKS = [
  { src: "/audio/pote-spring.mp3?v=3", title: "siteBgmTitleSpring" },
  { src: "/audio/pote-summer.mp3", title: "siteBgmTitleSummer" },
  { src: "/audio/pote-autumn.mp3", title: "siteBgmTitleAutumn" },
  { src: "/audio/pote-winter.mp3?v=3", title: "siteBgmTitleWinter" },
] as const;
const DEFAULT_VOLUME = 0.6;
let activeTrackIndex = 0;
const trackListeners = new Set<() => void>();
const subscribeTrackIndex = (listener: () => void) => {
  trackListeners.add(listener);
  return () => { trackListeners.delete(listener); };
};
const getTrackIndex = () => activeTrackIndex;
function publishTrackIndex(index: number) {
  activeTrackIndex = index;
  trackListeners.forEach((listener) => listener());
}

type Bgm = { playing: boolean; waiting: boolean; toggle: () => void; volume: number; setVolume: (value: number) => void; trackIndex: number; selectTrack: (index: number) => void };
const BgmContext = createContext<Bgm>({ playing: false, waiting: false, toggle: () => {}, volume: DEFAULT_VOLUME, setVolume: () => {}, trackIndex: 0, selectTrack: () => {} });

/** The visitor's own level (2026-09-27), remembered like the on/off choice. */
function readVolume() {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_KEY));
    return window.localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

function readOff() {
  try { return window.localStorage.getItem(STORAGE_KEY) === "off"; } catch { return false; }
}
function writeOff(off: boolean) {
  try {
    if (off) window.localStorage.setItem(STORAGE_KEY, "off");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode: the choice just isn't remembered */ }
}

export function SiteBgm({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const trackIndex = useRef(0);
  const selectedTrack = useSyncExternalStore(subscribeTrackIndex, getTrackIndex, () => 0);
  const [playing, setPlaying] = useState(false);
  // True while the browser is holding autoplay back until the first tap:
  // the header toggle pulses so the music (and its switch) can be found.
  const [waiting, setWaiting] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const pathname = usePathname();
  const noBgm = isNoBgmPath(pathname);

  useEffect(() => {
    const index = Math.floor(Math.random() * TRACKS.length);
    trackIndex.current = index;
    publishTrackIndex(index);
    if (audio.current) audio.current.src = TRACKS[index].src;
  }, []);

  const start = useCallback(() => {
    const element = audio.current;
    if (!element || !element.paused || isNoBgmPath(window.location.pathname)) return Promise.resolve();
    element.volume = volumeRef.current;
    return element.play();
  }, []);

  const setVolume = useCallback((value: number) => {
    const level = Math.min(1, Math.max(0, value));
    volumeRef.current = level;
    setVolumeState(level);
    if (audio.current) audio.current.volume = level;
    try { window.localStorage.setItem(VOLUME_KEY, String(level)); } catch { /* not remembered */ }
  }, []);

  useEffect(() => {
    volumeRef.current = readVolume();
    setVolumeState(volumeRef.current);
    if (readOff() || noBgm) return;
    // Only these grant the "user activation" play() needs. On a phone that is
    // the finger lifting (pointerup/touchend/click), not touching down: the
    // first version listened to touchstart, was refused, then stopped
    // listening, so on mobile the music never started (user, 2026-09-25).
    // So keep listening until a play() actually succeeds.
    const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    const detach = () => events.forEach((name) => window.removeEventListener(name, onGesture, true));
    const onGesture = (event: Event) => {
      // A press on the header toggle itself is handled by the toggle.
      if (event.target instanceof Element && event.target.closest(".site-bgm-wrap")) return;
      if (readOff() || isNoBgmPath(window.location.pathname)) { detach(); setWaiting(false); return; }
      start().then(() => { detach(); setWaiting(false); }).catch(() => {});
    };
    start().catch(() => {
      setWaiting(true);
      events.forEach((name) => window.addEventListener(name, onGesture, { capture: true, passive: true }));
    });
    return detach;
  }, [start, noBgm]);

  // Entering a work-tool page pauses it (without touching the visitor's own
  // on/off choice); leaving one resumes it, unless they had turned it off.
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (noBgm) {
      if (!element.paused) element.pause();
    } else if (element.paused && !readOff()) {
      void start().catch(() => {});
    }
  }, [noBgm, start]);

  // 휴대폰에서 다른 앱으로 가거나 화면을 꺼도 음악이 계속 나왔다(사용자, 2026-09-28).
  // 사이트가 안 보이면 멈추고, 다시 보이면 멈추기 전에 나오던 경우에만 이어서 튼다.
  useEffect(() => {
    let resumeOnReturn = false;
    const hide = () => {
      const element = audio.current;
      if (!element || element.paused) return;
      resumeOnReturn = true;
      element.pause();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hide(); return; }
      if (!resumeOnReturn) return;
      resumeOnReturn = false;
      if (!readOff() && !isNoBgmPath(window.location.pathname)) void start().catch(() => setWaiting(true));
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hide);
    };
  }, [start]);

  const toggle = useCallback(() => {
    const element = audio.current;
    if (!element || noBgm) return;
    setWaiting(false);
    if (element.paused) {
      writeOff(false);
      void start().catch(() => {});
    } else {
      writeOff(true);
      element.pause();
    }
  }, [start, noBgm]);

  const selectTrack = useCallback((index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= TRACKS.length) return;
    trackIndex.current = index;
    publishTrackIndex(index);
    const element = audio.current;
    if (!element) return;
    const resume = !element.paused;
    element.src = TRACKS[index].src;
    element.load();
    element.volume = volumeRef.current;
    if (resume) void element.play().catch(() => setWaiting(true));
  }, []);

  const advanceTrack = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    trackIndex.current = (trackIndex.current + 1) % TRACKS.length;
    publishTrackIndex(trackIndex.current);
    element.src = TRACKS[trackIndex.current].src;
    element.load();
    element.volume = volumeRef.current;
    void element.play().catch(() => setWaiting(true));
  }, []);

  return <BgmContext.Provider value={{ playing, waiting, toggle, volume, setVolume, trackIndex: selectedTrack, selectTrack }}>
    {children}
    <audio ref={audio} src={TRACKS[0].src} preload="none" onEnded={advanceTrack}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
  </BgmContext.Provider>;
}

/**
 * Header control: animated bars while playing, still and dimmed when off,
 * with a volume slider underneath (user, 2026-09-27).
 *
 * With a mouse, a click still switches the music on/off and the slider shows
 * on hover or keyboard focus. A phone has no hover, so there a tap opens the
 * slider panel (turning the music on first if it was off), and the panel has
 * its own off button.
 */
const subscribeHydration = () => () => {};

export function BgmToggle() {
  // Static 404 HTML has no request pathname. Defer path-dependent controls
  // until hydration so /admin and other missing tool URLs match that HTML.
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const { playing, waiting, toggle, volume, setVolume, trackIndex, selectTrack } = useContext(BgmContext);
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const label = t(playing ? "siteBgmOff" : "siteBgmOn");
  const hidden = isNoBgmPath(pathname);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!(event.target instanceof Node && wrap.current?.contains(event.target))) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", close, true); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!hydrated || hidden) return null;

  const press = () => {
    if (window.matchMedia("(hover: none)").matches) {
      if (!playing) toggle();
      setOpen((value) => !value || !playing);
      return;
    }
    toggle();
  };

  return <div className="site-bgm-wrap" ref={wrap} data-open={open}>
    <button className="site-bgm" type="button" onClick={press} aria-pressed={playing} aria-label={label} title={label} data-playing={playing} data-waiting={waiting && !playing}>
      <span className="site-bgm-bars" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
    <div className="site-bgm-panel">
      <label className="site-bgm-track-picker">
        <span>{t("siteBgmChooseTrack")}</span>
        <select aria-label={t("siteBgmChooseTrack")} value={trackIndex} onChange={(event) => selectTrack(Number(event.target.value))}>
          {TRACKS.map((track, index) => <option key={track.src} value={index}>{t(track.title)}</option>)}
        </select>
      </label>
      <label>
        <span>{t("siteBgmVolume")}</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} aria-valuetext={`${Math.round(volume * 100)}%`} style={{ "--bgm-fill": `${Math.round(volume * 100)}%` } as React.CSSProperties} />
        <output>{Math.round(volume * 100)}</output>
      </label>
      <button className="site-bgm-panel-toggle" type="button" onClick={() => { toggle(); if (playing) setOpen(false); }}>{label}</button>
    </div>
  </div>;
}
