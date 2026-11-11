"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ExhibitionCard } from "@/components/ExhibitionCard";
import { CuratorPlaylist } from "@/components/CuratorPlaylist";
import { ScrollRow } from "@/components/ScrollRow";
import { SiteHeader } from "@/components/SiteHeader";
import { useKoreanToday } from "@/hooks/useKoreanToday";
import { MOOD_DICT_KEY, MOOD_ORDER, getArtist, type Artwork, type MoodKey } from "@/lib/artists";
import { createTasteSession, restoreTasteSession, type ReasonKey, type TasteSession } from "@/lib/taste-session";
import { recommendExhibitions, type Exhibition } from "@/lib/exhibitions";
import { T, useLanguage, useT } from "@/lib/i18n";

const reasonOrder: ReasonKey[] = ["color", "texture", "form", "story"];
const reasonLabelKey: Record<ReasonKey, "tasteReasonColor" | "tasteReasonTexture" | "tasteReasonForm" | "tasteReasonStory"> = {
  color: "tasteReasonColor",
  texture: "tasteReasonTexture",
  form: "tasteReasonForm",
  story: "tasteReasonStory",
};

/**
 * Approximate hex for each Korean palette-color label used across
 * artworks.ts, so the quiz image can sit in a soft gallery-spotlight glow
 * tinted to match the work on screen — a lighting cue, not a literal
 * color swatch, so the mapping only needs to be "in the family".
 */
const paletteGlow: Record<string, string> = {
  검정: "#2a2622", 금색: "#c9a24a", 남색: "#2d4468", 노랑: "#d1a53a", 녹색: "#4a7d5c",
  먹색: "#2b2f2b", 버건디: "#7d2639", 보라: "#7a5a8a", 분홍: "#c9607f", 붉은색: "#a63c3c",
  빨강: "#b9453f", 산호색: "#d97e64", 석류색: "#9c3b3f", 아이보리: "#d8c9a3", 연두: "#9bb84f",
  연보라: "#a48fc4", 주황: "#cc7238", 진주색: "#d6c9b3", 청록: "#348083", 청색: "#3568a0",
  초록: "#3f7d55", 황토색: "#b9803f", 회녹색: "#7f8c76", 흰색: "#d8cfb8",
  갈색: "#7a5234", 베이지: "#cdb99a", 블랙: "#2a2622", 올리브: "#7d7a45", 자홍: "#b0407a",
  크림: "#e0d4b4", 파랑: "#3568a0", 퍼플: "#7a5a8a", 핑크: "#c9607f", 화이트: "#d8cfb8", 회색: "#8a8a86",
  상아색: "#d8c9a3", 연갈색: "#cdb99a", 미색: "#e0d4b4", 옥색: "#7fbfa8", 검붉은색: "#7d2639", 황록색: "#7d7a45",
  적갈색: "#8a3f2a", 겨자: "#c19a2e", 자주: "#8a2f5f", 황토: "#b9803f", 하늘빛: "#8fb7d6",
};

function glowStyle(palette: string[]): CSSProperties {
  const colors = palette.map((name) => paletteGlow[name] ?? "#a8752a");
  return {
    "--glow-a": colors[0] ?? "#a8752a",
    "--glow-b": colors[1] ?? "#7d5a2a",
    "--glow-c": colors[2] ?? "#4a4030",
  } as CSSProperties;
}

const PROGRESS_KEY = "pote-taste-progress";

// 이보다 긴 설명만 줄여 보이고 "더 보기"를 단다(대략 4줄).
const DESC_CLAMP_CHARS = 90;

export function TasteQuiz({
  artworks,
  exhibitions,
  todayIso: initialDate,
}: {
  artworks: Artwork[];
  exhibitions: Exhibition[];
  todayIso: string;
}) {
  const todayIso = useKoreanToday(initialDate);
  // Only work that can actually be bought/browsed goes into the quiz, same
  // rule the rest of the site applies to `orderedArtworks()`.
  const displayArtworks = artworks.filter((artwork) => artwork.statusKey === "available");
  const [session, setSession] = useState<TasteSession | null>(null);
  const step = session?.step ?? 0;
  const choices = session?.choices ?? [];
  const reasons = session?.reasons ?? [];
  const isChoosingReason = session?.choosingReason ?? false;
  const sample = session?.slugs.map((slug) => displayArtworks.find((work) => work.slug === slug)!) ?? [];
  const { lang } = useLanguage();
  const t = useT();
  const artwork = sample[step];
  const curatorArtist = artwork ? getArtist(artwork.artistSlug) : null;
  const [photo, setPhoto] = useState<{ slug: string; ratio: number } | null>(null);
  // 긴 작가 설명은 몇 줄만 보이다가 "더 보기"로 펼친다. 이 화면은 한 화면 높이로
  // 고정돼 있어, 긴 글이 그대로 나오면 아래 "오늘의 감정에" 칸을 덮었다(사용자, 2026-09-28).
  const [openDesc, setOpenDesc] = useState<string | null>(null);
  const measurePhoto = useCallback((image: HTMLImageElement | null) => {
    if (!artwork || !image?.complete || !image.naturalWidth) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    setPhoto((current) => current?.slug === artwork.slug && current.ratio === ratio ? current : { slug: artwork.slug, ratio });
  }, [artwork]);
  const photoRatio = photo?.slug === artwork?.slug ? photo?.ratio ?? 1 : 1;

  useEffect(() => {
    let saved: TasteSession | null = null;
    try { saved = restoreTasteSession(window.sessionStorage.getItem(PROGRESS_KEY), displayArtworks); } catch { /* Storage is optional. */ }
    const initial = saved ?? createTasteSession(displayArtworks);
    queueMicrotask(() => setSession(initial));
    // Deliberately mount-only: `artworks` (and so `displayArtworks`) comes from
    // a server-fetched prop that doesn't change after the initial render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    try {
      window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(session));
    } catch {
      // sessionStorage unavailable (private mode, etc.) — progress just won't survive navigation.
    }
  }, [session]);
  const moodScores = MOOD_ORDER.reduce((scores, mood) => ({ ...scores, [mood]: choices.filter((choice) => choice === mood).length }), {} as Record<MoodKey, number>);
  const resultMood: MoodKey = choices.length
    ? MOOD_ORDER.reduce((leading, mood) => moodScores[mood] >= moodScores[leading] ? mood : leading, "quiet")
    : "quiet";
  const reasonScores = reasonOrder.reduce((scores, reason) => ({ ...scores, [reason]: reasons.filter((item) => item === reason).length }), {} as Record<ReasonKey, number>);
  const leadingReason = reasons.length
    ? reasonOrder.reduce((leading, reason) => reasonScores[reason] >= reasonScores[leading] ? reason : leading, "color")
    : null;
  const recommended = displayArtworks.filter((item) => item.moodKey === resultMood);
  const recommendedExhibitions = useMemo(
    () => recommendExhibitions(resultMood, exhibitions, todayIso).slice(0, 4),
    [resultMood, exhibitions, todayIso],
  );
  const advance = () => {
    setSession((current) => current && ({ ...current, step: current.step + 1, choosingReason: false }));
  };
  const choose = (liked: boolean) => {
    if (liked && artwork) {
      setSession((current) => current && ({ ...current, choices: [...current.choices, artwork.moodKey], choosingReason: true }));
      return;
    }
    advance();
  };
  const chooseReason = (reason: ReasonKey) => {
    setSession((current) => current && ({ ...current, reasons: [...current.reasons, reason], step: current.step + 1, choosingReason: false }));
  };

  if (!session) return <><SiteHeader /><main className="taste-page taste-quiz-page" aria-busy="true"><header className="quiz-header"><p className="eyebrow dark"><T k="tasteFinderEyebrow" /></p><h1><T k="tasteFinderHeading" /></h1></header></main></>;

  if (!artwork && choices.length === 0) return <><SiteHeader /><main className="taste-page"><section className="taste-result">
    <p className="eyebrow dark"><T k="tasteResultEyebrow" /></p>
    <h1><T k="tasteNoChoicesHeading" /></h1><p><T k="tasteNoChoicesBody" /></p>
    <div className="result-actions"><button onClick={() => { setSession(createTasteSession(displayArtworks)); window.scrollTo({ top: 0, behavior: "smooth" }); }}><T k="tasteRetry" /></button><Link className="primary-button" href="/artworks"><T k="tasteViewAll" /></Link></div>
  </section></main></>;

  return <><SiteHeader /><main className={`taste-page${artwork ? " taste-quiz-page" : ""}${artwork && openDesc === artwork.slug ? " taste-quiz-open" : ""}`}>
    {artwork ? <>
      <div className="quiz-view">
        <div className="quiz-layout" style={{ "--quiz-photo-ratio": photoRatio } as CSSProperties}>
          {/* The count rides on the eyebrow line rather than a line of its own.
              This layout is fighting for every vertical pixel to keep the quiz
              inside one viewport, but a 12-question quiz with no visible end is
              one people quit halfway through, and a visitor who quits never
              reaches a recommendation. On the eyebrow row it costs no height. */}
          <header className="quiz-header"><p className="eyebrow dark quiz-eyebrow-row"><T k="tasteFinderEyebrow" /><span className="quiz-step-count">{step + 1} / {sample.length}</span></p><h1><T k="tasteFinderHeading" /></h1></header>
          <div className="quiz-image" key={artwork.slug} style={glowStyle(artwork.ko.palette)}><Image src={artwork.image} alt={artwork[lang].title} fill preload sizes="(max-width:900px) 90vw,620px" ref={measurePhoto} onLoad={(event) => measurePhoto(event.currentTarget)} /></div>
          <div className="quiz-side">
            <aside className="quiz-curator" key={artwork.slug}>
              <p className="quiz-curator-label"><T k="curatorNoteLabel" /></p>
              <h3>{artwork[lang].title}</h3>
              {curatorArtist ? <p className="quiz-curator-artist">{curatorArtist.name[lang]}</p> : null}
              <p className={`quiz-curator-desc${openDesc === artwork.slug ? "" : " is-clamped"}`}>{artwork[lang].description}</p>
              {artwork[lang].description.length > DESC_CLAMP_CHARS ? <button type="button" className="quiz-desc-toggle" aria-expanded={openDesc === artwork.slug} onClick={() => setOpenDesc(openDesc === artwork.slug ? null : artwork.slug)}><T k={openDesc === artwork.slug ? "quizDescLess" : "quizDescMore"} /></button> : null}
              <dl className="quiz-curator-meta">
                <div><dt><T k="detailInfo" /></dt><dd>{artwork[lang].details}</dd></div>
                <div><dt><T k="detailPalette" /></dt><dd>{artwork[lang].palette.join(" · ")}</dd></div>
              </dl>
            </aside>
            {isChoosingReason ? <section className="quiz-reason" aria-live="polite"><p className="eyebrow dark"><T k="tasteReasonEyebrow" /></p><h2><T k="tasteReasonPrompt" /></h2><div className="quiz-reason-options">{reasonOrder.map((reason) => <button key={reason} onClick={() => chooseReason(reason)}>{t(reasonLabelKey[reason])}</button>)}</div><button className="quiz-reason-skip" onClick={advance}><T k="tasteReasonSkip" /></button></section> : <div className="quiz-actions"><button type="button" onClick={() => choose(false)}><T k="tasteNo" /></button><button type="button" className="like-choice" onClick={() => choose(true)}><T k="tasteYes" /></button></div>}
          </div>
        </div>
      </div>
    </> : <section className="taste-result"><p className="eyebrow dark"><T k="tasteResultEyebrow" /></p><h1><T k="tasteResultPrefix" /><em>{t(MOOD_DICT_KEY[resultMood])}</em><T k="tasteResultSuffix" /></h1><p><T k="tasteResultBody" /></p>{leadingReason ? <p className="taste-result-reason"><span><T k="tasteReasonResultLabel" /></span><strong>{t(reasonLabelKey[leadingReason])}</strong></p> : null}<ScrollRow className="result-artworks">{recommended.map((item) => <Link href={`/artworks/${item.slug}`} key={item.slug}><Image src={item.image} alt={item[lang].title} width={220} height={220} /><span>{item[lang].title}</span></Link>)}</ScrollRow>{recommended.length > 1 ? <p className="swipe-hint"><T k="swipeHint" /></p> : null}
      <div className="exhibition-recommend">
        <p className="eyebrow dark"><T k="exhibitionEyebrow" /></p>
        <h2><T k="exhibitionHeading" /></h2>
        <p className="exhibition-note"><T k="exhibitionNote" /></p>
        {lang !== "ko" && recommendedExhibitions.length > 0 ? <p className="exhibition-note"><T k="exhibitionKoreanOnly" /></p> : null}
        {recommendedExhibitions.length > 0 ? <>
          <div className="exhibition-grid">
            {recommendedExhibitions.map((item) => <ExhibitionCard exhibition={item} key={`${item.title}__${item.institution}`} />)}
          </div>
          <p className="exhibition-source"><T k="exhibitionSource" /></p>
        </> : <p className="exhibition-empty"><T k="exhibitionEmpty" /></p>}
      </div>
      <div className="result-actions"><button onClick={() => { setSession(createTasteSession(displayArtworks)); window.scrollTo({ top: 0, behavior: "smooth" }); }}><T k="tasteRetry" /></button><Link className="primary-button" href="/artworks"><T k="tasteViewAll" /></Link></div></section>}
  </main><CuratorPlaylist catalog={artworks} singleMobile /></>;
}
