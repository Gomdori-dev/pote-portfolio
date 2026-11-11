"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Artwork } from "@/lib/artists";
import { useT } from "@/lib/i18n";

type PreviewMode = "texture";
const PreviewDialog = dynamic(() => import("./ArtworkPreviewDialog").then((mod) => mod.PreviewDialog), { ssr: false });

// The card's "실제 공간 연출 보기" button was retired on 2026-09-25: the
// catalogue's room chips now hang every work in the room directly, and the
// detail page has the full preview behind a thumbnail strip.
// 원본 파일을 새 탭으로 여는 "크게 보기" 링크는 2026-09-27에 없앴다. 원본이 그대로
// 노출되고, 줄인 사본(/api/display-image)은 열면 다운로드된다. 사진을 누르면 이 확대 창이 열린다.
export function ArtworkPreview({ artwork, image, open, onOpenChange }: { artwork: Artwork; image?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useT();
  const [ownMode, setOwnMode] = useState<PreviewMode | null>(null);
  const mode = open === undefined ? ownMode : open ? "texture" : null;
  const setMode = (next: PreviewMode | null) => { if (onOpenChange) onOpenChange(next !== null); else setOwnMode(next); };
  return <>
    <div className="art-card-tools">
      <button className="art-detail-trigger" type="button" onClick={() => setMode("texture")} aria-haspopup="dialog">{t("texturePreview")}</button>
    </div>
    {mode ? <PreviewDialog artwork={artwork} image={image} mode={mode} onClose={() => setMode(null)} /> : null}
  </>;
}
