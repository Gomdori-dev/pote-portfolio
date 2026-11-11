"use client";

import Image from "next/image";
import Link from "next/link";
import { safeArtworkHref } from "@/lib/artwork-route";
import { getArtist, type Artwork } from "@/lib/artists";
import { T, useLanguage, usePrice, useT } from "@/lib/i18n";
import { artworkPrice } from "@/lib/catalog";
import { artworkSizeForDisplay } from "@/lib/artwork-size";
import { RoomThumb } from "@/components/RoomThumb";
import type { RoomKey } from "@/lib/discovery";
import { SCENE_FOR_ROOM } from "@/lib/room-scene";
import type { CSSProperties } from "react";

// Rough rendered width of a title in em: Hangul/CJK ~1em, capitals and digits
// ~0.66em, other Latin ~0.55em, spaces ~0.3em. Compact cards divide their width
// by this to shrink a long title onto one line.
function titleEm(title: string): number {
  let em = 0;
  for (const ch of title) em += /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3\u4e00-\u9fff]/.test(ch) ? 1 : /[A-Z0-9]/.test(ch) ? 0.66 : ch === " " ? 0.3 : 0.55;
  return Math.max(em, 4);
}

/**
 * `room` (from /artworks' "어디에 걸까요" chips) shows the work hung in that
 * room instead of the bare photo, and opens the detail page on the same room.
 */
/**
 * The material · size line sits under the artist (2026-10-21 user request,
 * replacing the 09-26 "detail page only" decision).
 */
/**
 * `compact` (homepage): title on one line (shrunk to fit), artist and price
 * right under it — no gap pushing the price to the bottom of the row. The save
 * heart stays beside the title; it never sits on the picture.
 */
export function ArtworkCard({ artwork, saved, onSave, selectable, selected, onToggleSelect, room, compact }: { artwork: Artwork; saved?: boolean; onSave?: () => void; selectable?: boolean; selected?: boolean; onToggleSelect?: () => void; room?: RoomKey | null; compact?: boolean }) {
  compact = compact ?? true;
  const { lang } = useLanguage();
  const t = useT();
  const formatPrice = usePrice();
  const artist = getArtist(artwork.artistSlug);
  const size = artworkSizeForDisplay(artwork);
  const scene = room && size ? SCENE_FOR_ROOM[room] : null;
  const baseHref = safeArtworkHref(artwork);
  const href = scene ? `${baseHref}?view=room&scene=${scene.key}` : baseHref;
  const copy = artwork[lang];
  // "재료 · 크기 · 연도" from details; the year is left for the detail page.
  const spec = copy.details.split(" · ").map((part) => part.trim()).filter((part) => part && !/^\d{4}$/.test(part)).join(" · ");

  return <article className={`art-card ${artwork.statusKey === "sold" ? "sold" : ""} ${compact ? "compact" : ""}`}>
    <div className={`art-visual ${scene ? "in-room" : ""}`}>
      <Link aria-label={`${copy.title} ${t("detailLink")}`} className="art-visual-link" href={href} />
      {scene && size
        ? <RoomThumb image={artwork.image} alt={copy.title} widthCm={size.w} heightCm={size.h} scene={scene} />
        : <Image className="artwork-image" quality={85} src={artwork.image} alt={copy.title} fill sizes="(max-width:560px) 82vw, (max-width:900px) 40vw, 25vw" />}
    </div>
    {/* Picture → title → artist → price. The texture zoom and the
        material · size · year line live on the detail page only, so the
        card stays quiet (2026-09-26 user decision). */}
    <div className="art-info">
      {/* 하트는 제목 바로 오른쪽에 둔다 (2026-09-27 사용자 요청). */}
      <div className="art-title-row">
        {/* Only rendered on the favorites page, for batching several saved
            works into one inquiry instead of sending them one at a time.
            Beside the title, never on the picture. */}
        {selectable ? <label className="art-select"><input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label={`${copy.title} ${t("selectForInquiry")}`} /></label> : null}
        <h3 style={compact ? { "--title-em": titleEm(copy.title) } as CSSProperties : undefined} title={compact ? copy.title : undefined}><Link href={href}>{copy.title}</Link></h3>
        {onSave ? <button className={`save-button ${saved ? "saved" : ""}`} type="button" onClick={onSave} aria-label={`${copy.title} ${saved ? t("unsaveArtwork") : t("saveArtwork")}`} aria-pressed={saved}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button> : null}
      </div>
      <Link className="art-artist-name" href={`/artists/${artist.slug}`}>{artist.name[lang]}</Link>
      {spec ? <span className="art-spec" title={spec}>{spec}</span> : null}
      {/* A sold work says so where its price would be: plain text under the
          picture, not a badge on it. */}
      {artwork.statusKey === "sold" ? <span className="art-sold-label"><T k="tagSold" /></span> : artworkPrice(artwork.price) !== null ? <strong className="artwork-price">{formatPrice(artworkPrice(artwork.price)!)}</strong> : artwork.extras?.pricing === "inquiry" ? <span><T k="pricingInquiry" /></span> : null}
    </div>

  </article>;
}
