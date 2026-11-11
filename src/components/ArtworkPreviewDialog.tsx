"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Artwork } from "@/lib/artists";
import { artworkDimensionsCm } from "@/lib/catalog";
import { displayImageUrl, guessDisplayRatio } from "@/lib/display-image";
import { useLanguage, useT } from "@/lib/i18n";

type PreviewMode = "texture";

export function PreviewDialog({ artwork, image = artwork.image, mode, onClose }: { artwork: Artwork; image?: string; mode: PreviewMode; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [zoom, setZoom] = useState(2);
  const [focal, setFocal] = useState({ x: 50, y: 50 });
  // 처음엔 작게 짐작해 받고, 사진이 뜨면 실제 비율로 바로잡는다. 짐작이 맞으면 다시 받지 않는다.
  const [ratio, setRatio] = useState(() => guessDisplayRatio(artworkDimensionsCm(artwork.ko.details)));

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="artwork-preview-dialog" data-mode={mode} aria-modal="true" aria-labelledby={titleId} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="artwork-preview-panel">
      <div className="texture-dialog-heading">
        <div><p className="eyebrow">{t("texturePreviewEyebrow")}</p><h2 id={titleId}>{artwork[lang].title}</h2></div>
        <button type="button" onClick={onClose} aria-label={t("textureClose")} autoFocus>×</button>
      </div>
      <>
        <div className="texture-stage" tabIndex={0} role="group" aria-label={t("texturePreview")} aria-describedby={hintId}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse" && event.buttons === 0) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            setFocal({ x: Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100)) });
          }}
          onKeyDown={(event) => {
            const direction = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
            if (!direction) return;
            event.preventDefault();
            setFocal((point) => ({ x: Math.max(0, Math.min(100, point.x + direction[0])), y: Math.max(0, Math.min(100, point.y + direction[1])) }));
          }}>
          <Image alt={artwork[lang].title} fill unoptimized src={displayImageUrl(image, ratio)} onLoad={(event) => { const img = event.currentTarget; if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight); }} draggable={false} sizes="(max-width:700px) 92vw, 900px" style={{ transform: `scale(${zoom})`, transformOrigin: `${focal.x}% ${focal.y}%` }} />
        </div>
        <div className="texture-toolbar" role="group" aria-label={t("texturePreview")}>
          {/* Used to also have a "view full image" link straight to the raw
              file (target="_blank"). Instagram/Threads/Kakao's in-app
              browsers have no real tab chrome, so navigating to a bare
              image URL inside them triggers their native "download" sheet
              instead of just displaying it — and it kept reopening. The 1×–4×
              zoom above already shows the full photo, so the link was
              dropped rather than worked around. */}
          {[1, 2, 3, 4].map((level) => <button type="button" key={level} aria-pressed={zoom === level} onClick={() => { setZoom(level); setFocal({ x: 50, y: 50 }); }}>{level}×</button>)}
        </div>
        <p id={hintId} className="texture-help">{t("textureControlsHint")}</p>
      </>
    </div>
  </dialog>, document.body);
}
