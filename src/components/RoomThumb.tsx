"use client";

import { useState } from "react";
import Image from "next/image";
import { placeWork, sceneImage, type Scene } from "@/lib/room-scene";

/**
 * A work hung in one of the photographed rooms, as a plain picture: no wall
 * colour, light or frame controls (that is RoomPreview, on the detail page).
 * Light enough to render a whole catalogue grid of them.
 *
 * The scene is zoomed in around the work, not shown whole: in a full room a
 * 30cm piece is a speck. Everything scales together, so the work keeps its
 * true size next to the sofa or table in view — only the crop changes.
 */
export function RoomThumb({ image, alt, widthCm, heightCm, scene, zoomTarget = 0.46, thumbnail = false }: { image: string; alt: string; widthCm: number; heightCm: number; scene: Scene; zoomTarget?: number; thumbnail?: boolean }) {
  // The catalogue isn't consistently width-first; the photo decides which way
  // round the piece hangs (same rule as RoomPreview).
  const [landscape, setLandscape] = useState<boolean | null>(null);
  const [long, short] = [Math.max(widthCm, heightCm), Math.min(widthCm, heightCm)];
  const [w, h] = landscape === null ? [widthCm, heightCm] : landscape ? [long, short] : [short, long];
  const spot = placeWork(scene, w, h);
  const zoom = Math.min(3.2, Math.max(1, Math.min((zoomTarget * 100) / spot.widthPct, (zoomTarget * 1.2 * 100) / spot.heightPct)));
  // A hung work zooms about its centre; a standing one about the surface it
  // rests on, so the table stays in view instead of being cropped away.
  const originY = scene.placement === "standing" ? spot.topPct + spot.heightPct : spot.topPct + spot.heightPct / 2;

  return <div className="room-thumb" data-placement={scene.placement}>
    <div className="room-thumb-stage" style={{ transform: `scale(${zoom})`, transformOrigin: `50% ${originY}%` }}>
      <Image src={sceneImage(scene.key)} alt="" fill sizes={thumbnail ? "320px" : "(max-width:560px) 100vw, 720px"} style={{ objectFit: "cover", padding: 0 }} />
      <Image
        className="room-thumb-work"
        src={image}
        alt={alt}
        width={800}
        height={800}
        sizes={thumbnail ? "96px" : "(max-width:560px) 70vw, 360px"}
        loading="lazy"
        decoding="async"
        style={{ position: "absolute", left: `${spot.leftPct}%`, top: `${spot.topPct}%`, width: `${spot.widthPct}%`, height: `${spot.heightPct}%` }}
        ref={(el) => { if (el?.complete && el.naturalWidth > 0 && landscape === null) setLandscape(el.naturalWidth >= el.naturalHeight); }}
        onLoad={(event) => setLandscape(event.currentTarget.naturalWidth >= event.currentTarget.naturalHeight)}
      />
    </div>
  </div>;
}
