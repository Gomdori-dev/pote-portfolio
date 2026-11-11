"use client";

import { ArtworkPreview } from "@/components/ArtworkPreview";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArtworkCard } from "@/components/ArtworkCard";
import { ArtworkComments } from "@/components/ArtworkComments";
import { BackButton } from "@/components/BackButton";
import { RoomThumb } from "@/components/RoomThumb";
import { isStandingWork, parseScene, STRIP_SCENES, type Scene, type SceneKey } from "@/lib/room-scene";
import { useFavorites } from "@/hooks/useFavorites";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useArtworkViewTime } from "@/hooks/useVisit";
import { getArtist, type Artwork } from "@/lib/artists";
import { artworkPrice } from "@/lib/catalog";
import { artworkSizeForDisplay } from "@/lib/artwork-size";
import { detailsWithHo } from "@/lib/canvas-size";
import { T, useLanguage, useT, usePrice } from "@/lib/i18n";
import { OPERATOR_EMAIL } from "@/lib/site";
import { FRAME_LABEL_KEY, FRAME_MATERIAL_LABEL_KEY, PROOF_LABEL_KEY, proofPhotos } from "@/lib/artwork-extras";
import { FACT_LABELS } from "@/lib/artwork-registration";

const RoomPreview = dynamic(() => import("./RoomPreview").then((mod) => mod.RoomPreview));
const SCENE_LABEL: Record<SceneKey, "roomPresetLiving" | "roomPresetBedroom" | "roomPresetCafe" | "roomPresetGallery" | "roomSurfaceTable" | "roomSurfaceShelf"> = {
  living: "roomPresetLiving", bedroom: "roomPresetBedroom", cafe: "roomPresetCafe", gallery: "roomPresetGallery", console: "roomSurfaceTable", shelf: "roomSurfaceShelf",
};

/** Card-field copies (toCardArtwork), chosen by relatedArtworks in the page. */
export type RelatedArtworks = { own: Artwork[]; similar: Artwork[]; similarByLook: boolean };

export function ArtworkDetailView({ artwork, related }: { artwork: Artwork; related: RelatedArtworks }) {
  const { lang } = useLanguage();
  const t = useT();
  const formatPrice = usePrice();
  // null = the artwork photo; otherwise the room it is shown hanging in.
  const [scene, setScene] = useState<Scene | null>(null);
  const standing = isStandingWork(artwork.extras);
  // Every photo the artist uploaded, not just the first — a diorama needs its
  // angles. Static works have one.
  const workPhotos = artwork.images?.length ? artwork.images : [artwork.image];
  // 작가가 올린 실물 확인 사진(서명·뒷면·옆면)은 작품 사진 뒤에 이름표를 달고 붙는다.
  const proof = proofPhotos(artwork.extras);
  const photos = [...workPhotos, ...proof.map(([, src]) => src)];
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex] ?? artwork.image;
  // Keep the static artwork pages prerenderable. Reading this optional visual
  // preference after mount avoids a client-render bailout from useSearchParams.
  // The catalogue's room chips link here with ?view=room&scene=<room>, so the
  // page opens on the same room the visitor was just browsing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "room" && !standing) queueMicrotask(() => setScene(parseScene(params.get("scene")) ?? STRIP_SCENES[0]));
  }, [standing]);
  const { record } = useRecentlyViewed();
  useEffect(() => { record(artwork.slug); }, [artwork.slug, record]);
  // Time on this page feeds the visit record and its admission ticket.
  useArtworkViewTime(artwork);
  // The photo column is as tall as the (much longer) copy column beside it, so
  // the picture box is shaped to the photograph instead of stretching to fill:
  // otherwise `object-fit:contain` centres the image in all that height and
  // leaves the tab strip stranded far above it. The catalogued dimensions give
  // a close ratio for the first paint, the photograph itself the exact one.
  const [photoRatio, setPhotoRatio] = useState<number | null>(null);
  const [textureOpen, setTextureOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  // A cached image completes before React attaches onLoad, so the event never
  // fires; the ref callback runs on mount and measures it there instead.
  const measure = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setPhotoRatio(el.naturalWidth / el.naturalHeight);
  }, []);
  const copy = artwork[lang];
  // The preview is only honest at true scale, so a work whose dimensions we
  // can't read stays a plain photo rather than being drawn at a guessed size.
  const size = artworkSizeForDisplay(artwork);
  const sold = artwork.statusKey === "sold";
  const artist = getArtist(artwork.artistSlug);
  const { favorites, toggle } = useFavorites();
  const saved = favorites.includes(artwork.slug);

  /* Replaced a small "작품 사진 / 공간에 놓아보기" toggle that sat on top of
     the photo and read as part of it — people missed the room preview
     entirely. A shop-style thumbnail row is something everyone already
     knows to tap, and each thumbnail already shows the work in that
     room, so the feature is visible before anyone touches it. */
  const roomScenes = size && !standing ? STRIP_SCENES : [];
  const strip = photos.length > 1 || roomScenes.length ? <div className="detail-strip" role="group" aria-label={t("roomTabWall")}>
    {photos.map((src, index) => <button type="button" key={src} aria-pressed={!scene && photoIndex === index} onClick={() => { setScene(null); setPhotoIndex(index); }}>
      <span className="detail-strip-thumb detail-strip-photo"><Image src={src} alt="" fill sizes="96px" /></span>
      <span className="detail-strip-label">{index >= workPhotos.length ? <T k={PROOF_LABEL_KEY[proof[index - workPhotos.length][0]]} /> : index === 0 ? <T k="roomTabPhoto" /> : `${t("detailPhotoLabel")} ${index + 1}`}</span>
    </button>)}
    {size ? roomScenes.map((item) => <button type="button" key={item.key} aria-pressed={scene?.key === item.key} onClick={() => setScene(item)}>
      <span className="detail-strip-thumb"><RoomThumb image={artwork.image} alt="" widthCm={size.w} heightCm={size.h} scene={item} zoomTarget={0.5} thumbnail /></span>
      <span className="detail-strip-label"><T k={SCENE_LABEL[item.key]} /></span>
    </button>) : null}
  </div> : null;

  const saveButton = (placement: string) => <button className={`save-button detail-save-button ${placement} ${saved ? "saved" : ""}`} type="button" aria-label={`${copy.title} ${saved ? t("unsaveArtwork") : t("saveArtwork")}`} aria-pressed={saved} onClick={() => toggle(artwork.slug)}>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
          </button>;

  // A gift or a piece for the living room is usually sent to someone first
  // ("이거 어때?"). The phone's own share sheet where there is one, otherwise
  // the link goes to the clipboard with a short note.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${copy.title} · ${artist.name[lang]}`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch { /* no clipboard access: nothing more to offer */ }
  };
  const shareButton = (placement: string) => <span className={`detail-share ${placement}`}>
    <button className="detail-share-button" type="button" aria-label={`${copy.title} ${t("shareButton")}`} title={t("shareButton")} onClick={share}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3" /></svg>
    </button>
    {copied ? <span className="detail-share-note" role="status">{t("shareCopied")}</span> : null}
  </span>;

  const price = artworkPrice(artwork.price);
  // The proof photos sit after the work's own photos in the strip at the top.
  const showProof = () => { setScene(null); setPhotoIndex(workPhotos.length); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const relatedRow = (works: Artwork[]) => <div className="art-grid">{works.map((work) => <ArtworkCard key={work.slug} artwork={work} saved={favorites.includes(work.slug)} onSave={() => toggle(work.slug)} />)}</div>;

  return (
    <main className="artwork-detail">
      {/* Top right, clear of the picture: straight back to the list the visitor came from. */}
      <div className="detail-toolbar"><BackButton fallback="/artworks" label="backToList" /></div>
      <div className="detail-image detail-visual" style={{ "--detail-aspect": String(photoRatio ?? (size ? size.w / size.h : 4 / 3)) } as React.CSSProperties}>
        {size && scene
          ? <RoomPreview image={artwork.image} alt={`${artist.name[lang]} — ${copy.title}`} widthCm={size.w} heightCm={size.h} scene={scene} onSceneChange={setScene} below={strip} />
          : <div className="detail-photo"><Image quality={85} key={photo} src={photo} alt={`${artist.name[lang]} — ${copy.title}`} fill preload sizes="(max-width:900px) 100vw,55vw" ref={measure} onLoad={(event) => setPhotoRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} /><button type="button" className="detail-photo-link" onClick={() => setTextureOpen(true)} aria-haspopup="dialog" aria-label={t("texturePreview")} /></div>}
        {!scene ? strip : null}
        {/* Nothing sits on the picture: "view larger" lives under it, and a tap on the photo does the same. */}
        <ArtworkPreview artwork={artwork} image={photo} open={textureOpen} onOpenChange={setTextureOpen} />
      </div>
      <section className="detail-copy">
        {/* The artist's name is the link below; repeating it here said it twice. */}
        <p className="eyebrow dark">{t("selectedWorkTag")}</p>
        {/* 휴대폰에서는 하트·공유가 제목 바로 옆에 온다. 컴퓨터는 구매 버튼 줄의 것을 쓴다. */}
        <div className="detail-title-row"><h1>{copy.title}</h1>{shareButton("detail-share-title")}{saveButton("detail-save-title")}</div>
        {/* The price right under the title, before the buttons that name it. */}
        {sold ? <p className="detail-price sold"><T k="tagSold" /></p> : price !== null ? <p className="detail-price artwork-price">{formatPrice(price)}{lang === "en" ? <small className="price-reference">{t("priceKrwReference")} · {new Intl.NumberFormat("ko", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(price)}</small> : null}</p> : null}
        <p className="detail-artist-label">
          <Link className="ko" href={`/artists/${artist.slug}`}>{t("artistLabel")} {artist.name[lang]}</Link>
        </p>
        <dl>
          <div><dt><T k="detailInfo" /></dt><dd>{lang === "ko" && !standing && artwork.extras?.medium !== "photo" && artwork.extras?.medium !== "craft" ? detailsWithHo(copy.details) : copy.details}</dd></div>
        </dl>

        <div className="detail-actions">
          {!sold && <Link className="primary-button" href={`/inquiry?artwork=${artwork.slug}&intent=buy`}><T k="buyRequestButton" /></Link>}
          {!sold && <Link className="outline-button detail-offer-button" href={`/inquiry?artwork=${artwork.slug}&intent=offer`}><T k="offerButton" /></Link>}
          {saveButton("detail-save-actions")}
          {shareButton("detail-share-actions")}
        </div>
        {/* What a first-time buyer wants to know before pressing the button,
            right under it rather than in the table further down. */}
        {!sold && <ul className="detail-trust">
          <li><T k="detailTrustDirect" /></li>
          {proof.length ? <li><button type="button" className="detail-proof-link" onClick={showProof}>{t("detailTrustProof").replace("{items}", proof.map(([key]) => t(PROOF_LABEL_KEY[key])).join("·"))}</button></li> : null}
        </ul>}
        {!sold && <p className="inquiry-reassurance"><T k="inquiryNoCommitment" /> <Link href={`/inquiry?artwork=${artwork.slug}`}><T k="askOnlyLink" /></Link></p>}
        {copy.description ? <div className="detail-description-section">
          <p id="detail-description" className={`detail-description ${!descriptionOpen && copy.description.length > 180 ? "detail-description-collapsed" : ""}`}>{copy.description}</p>
          {copy.description.length > 180 ? <button className="detail-description-toggle" type="button" aria-expanded={descriptionOpen} aria-controls="detail-description" onClick={() => setDescriptionOpen(!descriptionOpen)}><T k={descriptionOpen ? "detailDescriptionCollapse" : "detailDescriptionExpand"} /></button> : null}
        </div> : null}
        {!sold && <section className="detail-transaction" aria-labelledby="detail-transaction-heading">
          <h2 id="detail-transaction-heading"><T k="detailTransactionHeading" /></h2>
          <dl>
            <div><dt><T k="detailTransactionShipping" /></dt><dd><T k="detailTransactionShippingValue" /></dd></div>
            {artist.saleExtras ? <div><dt><T k="detailSaleExtras" /></dt><dd>{artist.saleExtras[lang]}</dd></div> : null}
            {artist.afterCare ? <div><dt><T k="detailAfterCare" /></dt><dd>{artist.afterCare[lang]}</dd></div> : null}
            <div><dt><T k="detailFrame" /></dt><dd>{artwork.extras?.frame ? <T k={FRAME_LABEL_KEY[artwork.extras.frame]} /> : <T k="detailTransactionFrameUnknown" />}</dd></div>
            <div><dt><T k="detailTransactionHanging" /></dt><dd><T k={artwork.extras?.installation ? FACT_LABELS.installation[artwork.extras.installation] : artwork.extras?.hangingReady ? "detailHangingReady" : "detailTransactionHangingUnknown"} /></dd></div>
            <div><dt><T k="detailCertificate" /></dt><dd><T k={artwork.extras?.certificateAvailability ? FACT_LABELS.certificateAvailability[artwork.extras.certificateAvailability] : artwork.extras?.certificate ? "detailCertificateYes" : "detailTransactionCertificateUnknown"} /></dd></div>
            <div><dt><T k="registrationSignature" /></dt><dd><T k={artwork.extras?.signature ? FACT_LABELS.signature[artwork.extras.signature] : "registrationUnknown"} /></dd></div>
            <div><dt><T k="registrationCondition" /></dt><dd>
              <T k={artwork.extras?.condition ? FACT_LABELS.condition[artwork.extras.condition] : "registrationConditionUnknown"} />
              {artwork.extras?.condition === "issues" ? <small>{lang === "ko" ? artwork.extras.conditionNoteKo : artwork.extras.conditionNoteEn}</small> : null}
              {artwork.extras?.condition ? <small><T k="registrationConditionDeclared" /></small> : null}
            </dd></div>
            <div><dt><T k="detailTransactionCondition" /></dt><dd>{proof.length
              ? <><button type="button" className="detail-proof-link" onClick={showProof}>{t("detailProofShown").replace("{items}", proof.map(([key]) => t(PROOF_LABEL_KEY[key])).join("·"))}</button><small><T k="detailTransactionConditionValue" /></small></>
              : <><T k="detailTransactionConditionValue" /> <Link href={`/inquiry?artwork=${artwork.slug}&intent=photos`}><T k="detailProofRequest" /></Link></>}</dd></div>
            <div><dt><T k="detailSeller" /></dt><dd>{artist.name[lang]}{artist.sellerType ? <> · <T k={artist.sellerType === "business" ? "sellerBusiness" : "sellerIndividual"} /></> : null}</dd></div>
            <div><dt><T k="detailTransactionContact" /></dt><dd><T k="operatorName" /> · <a href={`mailto:${OPERATOR_EMAIL}`}>{OPERATOR_EMAIL}</a><small><T k="inquiryResponseTime" /></small></dd></div>
          </dl>
          <p><T k="detailTransactionSteps" /></p>
          <p><T k="registrationBeforePay" /></p>
          <Link href={`/guide?artwork=${encodeURIComponent(artwork.slug)}&intent=buy`}><T k="detailGuideLink" /></Link>
        </section>}
        <dl className="detail-extra-info">
          {/* 작가 포털 "액자·설치" 칸 — 값이 있을 때만 보인다(정적 작품에는 없음). */}
          {artwork.extras?.frame ? <div><dt><T k="detailFrame" /></dt><dd><T k={FRAME_LABEL_KEY[artwork.extras.frame]} />{artwork.extras.frameMaterial ? <> · <T k={FRAME_MATERIAL_LABEL_KEY[artwork.extras.frameMaterial]} /></> : null}</dd></div> : null}
          {artwork.extras?.framedWidthCm && artwork.extras.framedHeightCm ? <div><dt><T k="detailFramedSize" /></dt><dd>{artwork.extras.framedWidthCm} × {artwork.extras.framedHeightCm}cm</dd></div> : null}
          {artwork.extras?.depthCm ? <div><dt><T k={standing ? "detailDepth3d" : "detailDepth"} /></dt><dd>{artwork.extras.depthCm}cm</dd></div> : null}
          {artwork.extras?.workKind ? <div><dt><T k="registrationKind" /></dt><dd><T k={FACT_LABELS.workKind[artwork.extras.workKind]} /></dd></div> : null}
          {artwork.extras?.medium ? <div><dt><T k="registrationMedium" /></dt><dd><T k={FACT_LABELS.medium[artwork.extras.medium]} /></dd></div> : null}
          {artwork.extras?.medium === "photo" && artwork.extras.photoProcess ? <div><dt><T k="registrationPhotoProcess" /></dt><dd><T k={FACT_LABELS.photoProcess[artwork.extras.photoProcess]} /></dd></div> : null}
          {artwork.extras?.medium === "photo" && artwork.extras.photoPaper ? <div><dt><T k="registrationPhotoPaper" /></dt><dd><T k={FACT_LABELS.photoPaper[artwork.extras.photoPaper]} /></dd></div> : null}
          {artwork.extras?.pricing === "inquiry" ? <div><dt><T k="detailPrice" /></dt><dd><T k="pricingInquiry" /></dd></div> : null}
          {artwork.extras?.edition && (!artwork.extras.workKind || artwork.extras.workKind === "limited") ? <div><dt><T k="detailEdition" /></dt><dd>{artwork.extras.edition}</dd></div> : null}
          {artwork.extras?.hangingReady && !artwork.extras.installation ? <div><dt><T k="detailHanging" /></dt><dd><T k="detailHangingReady" /></dd></div> : null}
          {artwork.extras?.certificate && !artwork.extras.certificateAvailability ? <div><dt><T k="detailCertificate" /></dt><dd><T k="detailCertificateYes" /></dd></div> : null}
          {copy.mood ? <div><dt><T k="detailMood" /></dt><dd>{copy.mood}</dd></div> : null}
          {copy.palette.length ? <div><dt><T k="detailPalette" /></dt><dd>{copy.palette.join(" · ")}</dd></div> : null}
          {copy.status ? <div><dt><T k="detailStatus" /></dt><dd>{copy.status}</dd></div> : null}
          {artist.sellerType ? <div><dt><T k="detailSeller" /></dt><dd><T k={artist.sellerType === "business" ? "sellerBusiness" : "sellerIndividual"} /></dd></div> : null}
        </dl>
        <ArtworkComments slug={artwork.slug} />
        {artist.sellerType === "business" && artist.business ? (
          <details className="seller-info">
            {/* 제20조②는 "청약 전 제공"을 요구하며 상시 노출을 요구하지 않는다.
                제목은 보이고 내용만 접히므로 찾는 사람은 한 번에 열 수 있다. */}
            <summary><T k="sellerInfoHeading" /></summary>
            <dl>
              <div><dt><T k="sellerInfoName" /></dt><dd>{artist.business.name}</dd></div>
              {artist.business.regNo ? <div><dt><T k="sellerInfoRegNo" /></dt><dd>{artist.business.regNo}</dd></div> : null}
              <div><dt><T k="sellerInfoAddress" /></dt><dd>{artist.business.address}</dd></div>
              <div><dt><T k="sellerInfoContact" /></dt><dd>{artist.business.contact}</dd></div>
            </dl>
            <p><T k="sellerInfoNote" /></p>
          </details>
        ) : null}
        {sold ? null : (
          <section className="detail-guide">
            <h2><T k="detailGuideHeading" /></h2>
            <ul>
              <li><T k="detailGuideShip" /></li>
              <li><T k="detailGuideAuth" /></li>
              <li><T k="detailGuideRefund" /></li>
              {artist.sellerType === "individual" ? <li><T k="sellerIndividualNote" /></li> : null}
            </ul>
            <Link href={`/guide?artwork=${encodeURIComponent(artwork.slug)}&intent=buy`}><T k="detailGuideLink" /></Link>
          </section>
        )}
        {sold && <p className="sold-note"><T k="soldNote" /></p>}
        <p className="detail-image-rights"><T k="imageRightsNotice" /></p>
        <BackButton className="detail-back-foot" fallback="/artworks" label="backToList" />
      </section>
      {!sold && <aside className="detail-mobile-cta" aria-label={t("detailMobileActions")}>
        <span className={price !== null ? "detail-mobile-price artwork-price" : "detail-mobile-price"}>{price !== null ? formatPrice(price) : t("detailMobilePriceUnknown")}</span>
        <div>
          <Link href={`/inquiry?artwork=${artwork.slug}`}><T k="detailMobileAsk" /></Link>
          <Link href={`/inquiry?artwork=${artwork.slug}&intent=buy`}><T k="detailMobileBuy" /></Link>
        </div>
      </aside>}
      {/* Two ways on: more by this artist, then other artists' works close in
          colour and mood (see relatedArtworks in the page). Each row only
          disappears when there is nothing to put in it. */}
      {related.own.length > 0 ? (
        <section className="detail-related">
          <div className="section-heading"><h2><T k="relatedWorks" /></h2><Link href={`/artists/${artist.slug}`}>{artist.name[lang]} →</Link></div>
          {relatedRow(related.own)}
        </section>
      ) : null}
      {related.similar.length > 0 ? (
        <section className="detail-related">
          <div className="section-heading"><h2><T k={related.similarByLook ? "relatedSimilarLook" : "relatedSimilar"} /></h2><Link href="/artworks"><T k="exhibitionWorksLink" /></Link></div>
          {relatedRow(related.similar)}
        </section>
      ) : null}
    </main>
  );
}
