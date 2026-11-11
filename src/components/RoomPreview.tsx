"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { sceneImage, sceneNightImage, SCENE_GEOMETRY, type Scene, type SceneKey } from "@/lib/room-scene";

// Background rooms are visual references, not surveyed interiors.
// Was 2: at the on-screen scale a normal-sized wall photo renders at, 2cm of
// frame is 2–4px — thin enough that browser sub-pixel rounding could round
// one edge to a different width than its opposite edge, and thin enough that
// a light wood tone against a light wall all but disappeared. 3.2cm plus the
// hairline outline below (see .rp-frame) keeps it a frame at any wall color.
const FRAME_CM = 3.2;
type RoomKey = SceneKey;
type Room = { key: RoomKey; label: "roomPresetLiving" | "roomPresetBedroom" | "roomPresetCafe" | "roomPresetGallery" | "roomSurfaceTable" | "roomSurfaceShelf"; widthCm: number; anchor: number };
const ROOMS: Room[] = [
  { key: "living", label: "roomPresetLiving", ...SCENE_GEOMETRY.living },
  { key: "bedroom", label: "roomPresetBedroom", ...SCENE_GEOMETRY.bedroom },
  { key: "cafe", label: "roomPresetCafe", ...SCENE_GEOMETRY.cafe },
  { key: "gallery", label: "roomPresetGallery", ...SCENE_GEOMETRY.gallery },
];
const SURFACES: Room[] = [
  { key: "console", label: "roomSurfaceTable", ...SCENE_GEOMETRY.console },
  { key: "shelf", label: "roomSurfaceShelf", ...SCENE_GEOMETRY.shelf },
];

type Material = "none" | "wood" | "metal" | "matte";
type Texture = "default" | "plaster" | "fabric" | "smooth";
// Was 5 steps (off/morning/day/afternoon/night) — collapsed to a plain
// on/off switch (2026-09-20): "off" keeps the daytime room photo as-is,
// "night" (labelled ON) swaps in the lit interior + lamp glow.
type Light = "off" | "night";

const TEXTURES: Texture[] = ["default", "plaster", "fabric", "smooth"];
const TEXTURE_LABEL = { default: "roomWallDefault", plaster: "roomWallPlaster", fabric: "roomWallFabric", smooth: "roomWallSmooth" } as const;
const LIGHTS: Light[] = ["off", "night"];
const LIGHT_LABEL = { off: "roomLightOff", night: "roomLightNight" } as const;

const WALL_COLORS = ["#e9e2d3", "#8b9a83", "#c98a5c", "#3f4a4a", "#aeb8bf"];
const FRAME_COLORS: Record<Exclude<Material, "none">, string[]> = {
  wood: ["#a9835c", "#5c3a22", "#e8e2d3", "#231d16"],
  metal: ["#b9bcc0", "#1c1c1c", "#c9a227", "#8a5a34"],
  matte: ["#f2efe6", "#1a1a1a", "#8b8b86", "#7f8c74"],
};
const MATERIALS: Material[] = ["none", "wood", "metal", "matte"];


const MATERIAL_LABEL = { none: "roomFrameNone", wood: "roomFrameWood", metal: "roomFrameMetal", matte: "roomFrameMatte" } as const;

// OFF recolours the fixed architectural wall plane. It deliberately does not
// infer a wall from pixel colours: pale bedding and reflective objects are too
// close to plaster in a photograph, while leaf gaps can expose the old wall.
const OFF_WALL_MASK: Record<RoomKey, string> = {
  living: "linear-gradient(to bottom, #fff 0 68%, transparent 68%)",
  cafe: "linear-gradient(to bottom, #fff 0 74%, transparent 74%)",
  gallery: "linear-gradient(to bottom, #fff 0 71%, transparent 71%)",
  // The left stack is opaque porcelain/books, while the vase is transparent:
  // keep only the opaque stack out of the recoloured wall and let the chosen
  // wall tone naturally show through the glass and foliage.
  console: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='white' width='100' height='79'/%3E%3Crect fill='black' x='0' y='69' width='20' height='11'/%3E%3Cpath fill='black' d='M3 65C3 63 5 62 10 62C15 62 17 64 17 66C17 69 15 70 10 70C5 70 3 68 3 65Z'/%3E%3C/svg%3E\")",
  shelf: "linear-gradient(to bottom, #fff 0 68%, transparent 68%)",
  bedroom: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath fill='white' d='M8 0H100V53H94C91 55 89 57 86 58H72C66 58 60 60 54 62C48 64 43 67 39 73C37 77 34 78 31 75C28 71 23 69 18 69H8Z'/%3E%3C/svg%3E\")",
};

function nightWallMask(left: number, right: number, solidUntil: number, fadeUntil: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="100%"><stop offset="0%" stop-color="white"/><stop offset="${solidUntil}%" stop-color="white"/><stop offset="${fadeUntil}%" stop-color="transparent"/></linearGradient></defs><rect x="${left}" y="0" width="${right - left}" height="100" fill="url(#fade)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ON uses photographic night rooms. Limit each finish to the architectural
// wall panel, then fade it before the furniture — never draw a synthetic bed
// or sofa contour on top of the photograph.
const NIGHT_WALL_MASK: Record<RoomKey, string> = {
  living: nightWallMask(10, 96, 60, 74),
  bedroom: nightWallMask(8, 100, 58, 73),
  cafe: nightWallMask(10, 95, 64, 78),
  gallery: nightWallMask(8, 92, 62, 77),
  console: nightWallMask(0, 100, 64, 79),
  shelf: nightWallMask(0, 100, 64, 79),
};

/** The dimension guides are drawn straight onto the wall, so on a charcoal or
 *  navy pick they have to flip to light ink to stay readable. */
function isDark(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (color: string) => void }) {
  const custom = !colors.includes(value);
  return (
    <div className="rp-swatches" role="group" aria-label={label}>
      {colors.map((color, index) => (
        <button className="rp-swatch" key={color} type="button" style={{ background: color }} aria-pressed={value === color} aria-label={`${label} ${index + 1}`} onClick={() => onPick(color)} />
      ))}
      {/* a <label> carries no role, so the selected state is styling only —
          the control's own state is the colour input's value */}
      <label className="rp-picker" data-active={custom}>
        <input type="color" value={value} aria-label={`${label} ${colors.length + 1}`} onInput={(event) => onPick(event.currentTarget.value)} onChange={(event) => onPick(event.target.value)} />
      </label>
    </div>
  );
}

/**
 * `scene` lets the detail page's thumbnail strip pick the room from outside;
 * `onSceneChange` reports a room picked with the controls in here, so the
 * strip's highlight follows. Wall colour, light and frame are kept either way.
 */
export function RoomPreview({ image, alt, widthCm, heightCm, compact = false, scene, onSceneChange, below }: { image: string; alt: string; widthCm: number; heightCm: number; compact?: boolean; scene?: Scene; onSceneChange?: (scene: Scene) => void; below?: ReactNode }) {
  const t = useT();
  const [wallColor, setWallColor] = useState(WALL_COLORS[0]);
  const [material, setMaterial] = useState<Material>("none");
  const [texture, setTexture] = useState<Texture>("default");
  const [light, setLight] = useState<Light>("off");
  // Switching the light swaps the room photo in one frame while the wall
  // colour, texture and shadows used to ease over 0.2–0.35s, so the old state
  // lingered as a ghost. For the frame of a light change every transition is
  // off (data-instant); colour and frame picks still ease as before.
  const [instant, setInstant] = useState(false);
  const switchLight = useCallback((next: Light) => {
    setInstant(true);
    setLight(next);
    // A timer, not requestAnimationFrame: rAF pauses in a background tab and
    // would leave colour picks without their ease until the tab is shown.
    window.setTimeout(() => setInstant(false), 60);
  }, []);
  // Each placement remembers its selected space while other options change.
  const [room, setRoom] = useState<RoomKey>(scene?.placement === "wall" ? scene.key : "living");
  const [placement, setPlacement] = useState<"wall" | "standing">(scene?.placement ?? "wall");
  const [surface, setSurface] = useState<RoomKey>(scene?.placement === "standing" ? scene.key : "console");
  // Adopt a new scene from the strip during render (not in an effect), the
  // same prop-sync pattern the catalogue search box uses.
  const [syncedScene, setSyncedScene] = useState(scene);
  if (scene && scene !== syncedScene) {
    setSyncedScene(scene);
    setPlacement(scene.placement);
    if (scene.placement === "wall") setRoom(scene.key); else setSurface(scene.key);
  }
  const pick = (next: Scene) => {
    setPlacement(next.placement);
    if (next.placement === "wall") setRoom(next.key); else setSurface(next.key);
    onSceneChange?.(next);
  };
  const [frameColor, setFrameColor] = useState({ wood: FRAME_COLORS.wood[0], metal: FRAME_COLORS.metal[0], matte: FRAME_COLORS.matte[0] });
  const [photoRatio, setPhotoRatio] = useState<number | null>(null);
  // onLoad alone is not enough: an image already in the browser cache finishes
  // loading before React attaches the handler, so the event never fires and the
  // shape correction below silently never runs — the work then gets drawn at the
  // catalogued proportions with the photo letterboxed inside it. A ref callback
  // runs on mount, so a cached image is measured there instead.
  const measure = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setPhotoRatio(el.naturalWidth / el.naturalHeight);
  }, []);

  // Both artists confirmed their catalogued measurements on 2026-09-14, so the
  // numbers are right and it is the photographs that are off — shot slightly
  // off-axis, which squeezes one side by up to 19%. That settles what had been
  // an open question: the work is drawn at its catalogued size, full stop.
  //
  // The photograph is still needed for one thing the catalogue cannot be
  // trusted on: which way round the piece hangs. The catalogue is not
  // consistently width-first (one 132 x 160cm entry is a landscape work), and
  // orientation is not something a 19% error can flip, so the pair is assigned
  // long-side-to-long-side with whatever axis the photo is longer on.
  const [w, h] = useMemo(() => {
    if (photoRatio === null) return [widthCm, heightCm];
    const [long, short] = [Math.max(widthCm, heightCm), Math.min(widthCm, heightCm)];
    return photoRatio >= 1 ? [long, short] : [short, long];
  }, [widthCm, heightCm, photoRatio]);

  const [labelW, labelH] = [w, h];
  const piece = (placement === "standing" ? SURFACES.find((item) => item.key === surface) : ROOMS.find((item) => item.key === room)) ?? ROOMS[0];
  // Fetch the ON photo as soon as a room is shown, so the first switch to
  // ON has it ready instead of flashing an empty wall while it downloads.
  useEffect(() => {
    const img = new window.Image();
    img.src = sceneNightImage(piece.key);
  }, [piece.key]);
  // Precise, per-photo wall silhouette (flood-filled below), used only for
  // ON — it follows the console/vase/lamp/curtain shapes that a crude
  // percentage rectangle (NIGHT_WALL_MASK) cannot, which is what let wall
  // colour/texture bleed onto furniture and stop short of the true wall
  // edges (2026-09-21 user report). OFF keeps its own simpler mask
  // (OFF_WALL_MASK) untouched — it repaints via a flat background-color
  // masked the same way, then the `rp-room-foreground` photo cutout is
  // composited on top to restore real furniture pixels, so it never needed
  // this precision; ON has no such foreground layer (the night photo bakes
  // furniture in), so the mask itself is the only thing protecting it.
  const [wallMask, setWallMask] = useState<{ key: RoomKey; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    const photo = new window.Image();
    photo.onload = () => {
      if (!active) return;
      const canvas = document.createElement("canvas");
      canvas.width = 700; canvas.height = 560;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(photo, 0, 0, 700, 560);
      const pixels = ctx.getImageData(0, 0, 700, 560).data;
      const output = ctx.createImageData(700, 560);
      const seed = 112 * 700 + 350;
      const offset = seed * 4;
      const rg = pixels[offset] - pixels[offset + 1];
      const gb = pixels[offset + 1] - pixels[offset + 2];
      const seen = new Uint8Array(700 * 560);
      const queue = new Int32Array(700 * 560);
      queue[0] = seed; seen[seed] = 1;
      let head = 0, tail = 1;
      // Connected neutral wall pixels preserve the photographed silhouettes
      // of leaves, furniture and lamps instead of colouring a rectangular patch.
      while (head < tail) {
        const index = queue[head++];
        const pos = index * 4;
        output.data[pos] = 255; output.data[pos + 1] = 255;
        output.data[pos + 2] = 255; output.data[pos + 3] = 255;
        const x = index % 700;
        for (const next of [index - 700, index + 700, x > 0 ? index - 1 : -1, x < 699 ? index + 1 : -1]) {
          if (next < 0 || next >= seen.length || seen[next]) continue;
          seen[next] = 1;
          const n = next * 4;
          const gradient = Math.max(Math.abs(pixels[n] - pixels[pos]), Math.abs(pixels[n + 1] - pixels[pos + 1]), Math.abs(pixels[n + 2] - pixels[pos + 2]));
          // Threshold loosened from 12: a plain stucco/plaster wall still has
          // enough natural shading (corners, trowel marks, soft shadow falloff)
          // to stop the flood fill partway across the photo. When that happens
          // the tint only reaches the connected side, and the untinted rest of
          // the same wall reads as a hard seam — as if the wall were torn paper.
          if (pixels[n + 1] < 105 || Math.abs(pixels[n] - pixels[n + 1] - rg) > 26 || Math.abs(pixels[n + 1] - pixels[n + 2] - gb) > 26 || gradient > 22) continue;
          queue[tail++] = next;
        }
      }
      ctx.putImageData(output, 0, 0);
      // Grow the filled region ~2px in every direction. This mask and the
      // (differently sized) background photo each get scaled into the same
      // box independently, and at a hard edge — wall meeting a cabinet top,
      // say — that independent rounding can leave a hairline sliver of the
      // original, un-tinted wall exposed as a stray pale seam. A couple of
      // extra painted pixels past every edge means that sliver lands on
      // already-tinted pixels instead of bare wall.
      const snapshot = document.createElement("canvas");
      snapshot.width = 700; snapshot.height = 560;
      const snapshotCtx = snapshot.getContext("2d");
      if (snapshotCtx) {
        snapshotCtx.putImageData(output, 0, 0);
        for (const [dx, dy] of [[0, 1], [0, 2], [1, 0], [-1, 0], [0, -1]] as const) ctx.drawImage(snapshot, dx, dy);
      }
      // Pale ceramics/books can share the wall hue. Exclude their known
      // photographed foreground silhouettes after connected-wall detection.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      const cut = (path: string) => ctx.fill(new Path2D(path));
      ctx.save(); ctx.scale(7, 5.6);
      // console/shelf need no hand-traced cutouts here: their flood fill now
      // runs on the same "-day.png" photo that's actually shown (see above),
      // so it already follows the real bowl/vase/plant/book silhouettes on
      // its own. Hand-traced polygons only existed to patch a mask that had
      // been traced from a *different* photo (the old ".webp"); against the
      // right photo they just cut wall or objects in the wrong place.
      if (piece.key === "living") {
        // The sheer curtain at the window is close enough to the wall's own
        // cream that the flood fill happily includes it as "wall" — so a
        // wall colour or finish picked here was painting the curtain fabric
        // too, which is exactly backwards (paint doesn't go on curtains).
        cut("M 0 0 L 7 0 L 7 68 L 0 68 Z");
        cut("M 5 59 L 12 59 L 14 69 L 5 69 Z");
        cut("M 13 64 L 23 64 L 23 69 L 13 69 Z");
        cut("M 83 58 Q 88 54 92 58 L 93 62 L 90 62 L 90 67 L 92 67 L 92 69 L 81 69 L 81 65 L 84 65 L 84 62 L 83 62 Z");
      }
      if (piece.key === "bedroom") {
        // Same fix as the living room's curtain, above: this one runs the
        // full height of the photo, right along the wall's own colour.
        cut("M 0 0 L 8 0 L 8 100 L 0 100 Z");
        cut("M 1 53 L 9 53 L 11 62 L 7 62 L 7 65 L 8 70 L 2 71 L 2 65 L 4 63 L 4 62 L 1 62 Z");
      }
      if (piece.key === "gallery") {
        // The concrete floor's warm grey sits close enough to the wall's own
        // tone that the faint baseboard shadow doesn't reliably stop the
        // flood fill, so a wall colour was leaking down onto the floor too.
        cut("M 0 71 L 100 71 L 100 100 L 0 100 Z");
      }
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      // Keep the edge exact around photographed foreground objects. Blurring
      // this mask left a translucent ring of the original pale wall around
      // bowls and vases whenever a dark wall colour was selected.
      setWallMask({ key: piece.key, url: canvas.toDataURL() });
    };
    // Must be the exact file rendered as --rp-scene-image below, not just
    // "<key>.webp": console/shelf show a distinct "-day.png" render (retouched
    // book spines), and a mask traced from the wrong photo drifts off the
    // real silhouettes of whatever moved between the two versions — the
    // flood fill was tracing bowls, vases and dishes that don't exist (or
    // sit elsewhere) in the photo actually on screen, leaving stray
    // unpainted wall or clipping into the real objects.
    photo.src = sceneImage(piece.key);
    return () => { active = false; };
  }, [piece.key]);
  // Zoom the whole scene together, so small works remain visible.
  const zoom = placement === "standing" ? Math.min(1.35, Math.max(1, 35 / Math.max(w, h))) : Math.min(1.15, Math.max(1, 30 / Math.max(w, h)));
  // For a wall hang, the first term used to be 100 / piece.widthCm — the
  // *selected room's* own width, not the artwork's. For a big canvas that
  // never bound (the artwork-size terms below were always tighter), but for
  // a small piece it did, and every room has a different width (300–380cm),
  // so the same work rendered at a different size in every room: switching
  // living → bedroom → cafe didn't read as "the same piece against a new
  // backdrop", it read as the piece itself changing. Standing surfaces
  // (a table, a shelf) keep their own width — how big the work can be
  // *there* really is a physical fact about that surface — but a wall is
  // just a backdrop, so every wall room shares one reference width (the
  // default living room's) and only the photo behind the work changes.
  const scaleW = Math.min(100 / (placement === "standing" ? piece.widthCm : ROOMS[0].widthCm), 62 / (w + FRAME_CM * 2), 58 * 0.8 / (h + FRAME_CM * 2));
  const scaleH = scaleW / 0.8;
  const heightPct = h * scaleH;
  const widthPct = w * scaleW;
  const bottomPct = placement === "standing" ? 100 - piece.anchor + (material === "none" ? 0 : FRAME_CM * scaleH) : 100 - piece.anchor - heightPct / 2;
  // Sample the same photographed wall light at the artwork's position, including
  // its frame. Resizing a work must not move the room's light sources with it.
  const frameX = material === "none" ? 0 : FRAME_CM * scaleW;
  const frameY = material === "none" ? 0 : FRAME_CM * scaleH;
  const litWidth = widthPct + frameX * 2;
  const litHeight = heightPct + frameY * 2;
  const litLeft = (100 - litWidth) / 2;
  const litTop = 100 - bottomPct - heightPct - frameY;
  const style = {
    "--rp-left": `${(100 - widthPct) / 2}%`,
    "--rp-width": `${widthPct}%`,
    "--rp-height": `${heightPct}%`,
    "--rp-bottom": `${bottomPct}%`,
    "--rp-frame-x": `${-FRAME_CM / w * 100}%`,
    "--rp-frame-y": `${-FRAME_CM / h * 100}%`,
    "--rp-scene-mask": OFF_WALL_MASK[piece.key],
    // Falls back to the coarse rectangle mask until the precise flood-filled
    // one finishes computing for this room (effect above), so switching
    // rooms never flashes an unmasked or fully-masked frame.
    "--rp-night-wall-mask": wallMask && wallMask.key === piece.key ? `url("${wallMask.url}")` : NIGHT_WALL_MASK[piece.key],
    "--rp-wall-color": wallColor,
    "--rp-foreground-image": `url("/rooms/${piece.key}-foreground.webp")`,
    "--rp-scene-image": `url("${sceneImage(piece.key)}")`,
    "--rp-night-image": `url("${sceneNightImage(piece.key)}")`,
    "--rp-light-size": `${10000 / litWidth}% ${10000 / litHeight}%`,
    "--rp-light-position": `${100 * litLeft / (100 - litWidth)}% ${100 * litTop / (100 - litHeight)}%`,
    "--rp-zoom": zoom,
    "--rp-origin-y": `${placement === "standing" ? piece.anchor - heightPct / 2 : piece.anchor}%`,
  } as React.CSSProperties;

  return (
    <div className="room-preview" data-placement={placement} style={style}>
      {/* `below` (the detail page's thumbnail strip) sits right under the
          picture, not under the long control list — on a phone that list
          pushed it a whole screen down. */}
      <div className="rp-stage-col">
      <div className="rp-wall" data-dark={isDark(wallColor) || light === "night"} data-wall-dark={isDark(wallColor)} data-light={light} data-instant={instant || undefined} data-room={piece.key}>
        <div className="rp-scene-stage">
        <div className="rp-room-photo" />
        <div className="rp-surface" data-texture={texture} />
        <div className="rp-photo-color" style={{ backgroundColor: wallColor }} />
        <div className="rp-room-foreground" aria-hidden="true" />
        <div className="rp-shade" />
        <div className="rp-tint" />
        <div className="rp-shell" data-material={material} style={{ aspectRatio: `${w}/${h}` }}>
          <div className="rp-frame"><div className="rp-mat" style={{ backgroundColor: frameColor[material === "none" ? "wood" : material] }} /></div>
          <div className="rp-bevel" />
          <div className="rp-canvas"><Image src={image} alt={alt} fill sizes="(max-width:900px) 45vw, 25vw" ref={measure} onLoad={(event) => setPhotoRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} /></div>
          <div className="rp-art-light" aria-hidden="true" />
        </div>

        <span className="rp-dim-w">{labelW}cm</span>
        <span className="rp-dim-h">{labelH}cm</span>

        </div>
      </div>

      {below}
      </div>

      <div className="rp-controls">
        <div className="rp-placement-switch" role="group" aria-label={t("roomPlacement")}>
          <button className="rp-material-btn" type="button" aria-pressed={placement === "wall"} onClick={() => pick({ key: room, placement: "wall" })}>{t("roomPlacementWall")}</button>
          <button className="rp-material-btn" type="button" aria-pressed={placement === "standing"} onClick={() => pick({ key: surface, placement: "standing" })}>{t("roomPlacementStanding")}</button>
        </div>
        <details className="rp-advanced" open={compact ? undefined : true}>
        <summary>{t("roomMoreOptions")}</summary>
        <p className="rp-option-label">{t("roomPreset")}</p>
        <div className="rp-materials" role="group" aria-label={t("roomPreset")}>
          {(placement === "standing" ? SURFACES : ROOMS).map((item) => <button className="rp-material-btn" key={item.key} type="button" aria-pressed={(placement === "standing" ? surface : room) === item.key} onClick={() => pick({ key: item.key, placement })}>{t(item.label)}</button>)}
        </div>

        <p className="rp-option-label">{t("roomLight")}</p>
        <div className="rp-materials" role="group" aria-label={t("roomLight")}>
          {LIGHTS.map((item) => <button className="rp-material-btn" key={item} type="button" aria-pressed={light === item} onClick={() => switchLight(item)}>{t(LIGHT_LABEL[item])}</button>)}
        </div>

        <p className="rp-option-label">{t("roomWallFinish")}</p>
        <div className="rp-materials" role="group" aria-label={t("roomWallFinish")}>
          {TEXTURES.map((item) => <button className="rp-material-btn" key={item} type="button" aria-pressed={texture === item} onClick={() => setTexture(item)}>{t(TEXTURE_LABEL[item])}</button>)}
        </div>

        <p className="rp-option-label">{t("roomWallColor")}</p>
        <Swatches label={t("roomWallColor")} colors={WALL_COLORS} value={wallColor} onPick={setWallColor} />

        <p className="rp-option-label">{t("roomFrameMaterial")}</p>
        <div className="rp-materials" role="group" aria-label={t("roomFrameMaterial")}>
          {MATERIALS.map((item) => <button className="rp-material-btn" key={item} type="button" aria-pressed={material === item} onClick={() => setMaterial(item)}>{t(MATERIAL_LABEL[item])}</button>)}
        </div>

        {material === "none" ? null : <>
          <p className="rp-option-label">{t("roomFrameColor")}</p>
          <Swatches label={t("roomFrameColor")} colors={FRAME_COLORS[material]} value={frameColor[material]} onPick={(color) => setFrameColor((prev) => ({ ...prev, [material]: color }))} />
        </>}

        </details>
        {/* no texture credit line: the sources are CC0 / public domain, which
            waive attribution. Provenance lives in public/textures/README.md. */}
        <p className="rp-note">{t("roomPhotoNote")}</p>
      </div>
    </div>
  );
}
