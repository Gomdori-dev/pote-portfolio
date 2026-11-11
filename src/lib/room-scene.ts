import type { RoomKey } from "./discovery";

/**
 * The photographed rooms in public/rooms, and where a work sits in each.
 * Shared by the full RoomPreview on the detail page and the light RoomThumb
 * used in the catalogue and the detail page's thumbnail strip, so a work sits
 * at the same spot and the same scale in both.
 */
export type SceneKey = "living" | "bedroom" | "cafe" | "gallery" | "console" | "shelf";
export type Placement = "wall" | "standing";
export type Scene = { key: SceneKey; placement: Placement };

// `anchor` is the wall height (% from the top of the photo) a hung work is
// centred on, or the surface line a standing work rests on. Wall rooms share
// one reference width so a work is the same size in every room; a table or
// shelf keeps its own, because how big a work can be there is physical.
export const SCENE_GEOMETRY: Record<SceneKey, { widthCm: number; anchor: number }> = {
  living: { widthCm: 340, anchor: 40 },
  bedroom: { widthCm: 300, anchor: 38 },
  cafe: { widthCm: 320, anchor: 38 },
  gallery: { widthCm: 380, anchor: 38 },
  console: { widthCm: 150, anchor: 75 },
  shelf: { widthCm: 130, anchor: 81 },
};
export const WALL_REFERENCE_CM = SCENE_GEOMETRY.living.widthCm;

// "어디에 걸까요" room → the photo that shows it. There is no study or hallway
// photo: a quiet gallery wall stands in for the study, and hallway works are
// small ones, which read best standing on the console.
export const SCENE_FOR_ROOM: Record<RoomKey, Scene> = {
  living: { key: "living", placement: "wall" },
  bedroom: { key: "bedroom", placement: "wall" },
  shop: { key: "cafe", placement: "wall" },
  study: { key: "gallery", placement: "wall" },
  entrance: { key: "console", placement: "standing" },
};

// The detail page's thumbnail strip, in order.
export const STRIP_SCENES: Scene[] = [
  { key: "living", placement: "wall" },
  { key: "bedroom", placement: "wall" },
  { key: "cafe", placement: "wall" },
  { key: "gallery", placement: "wall" },
  { key: "console", placement: "standing" },
];

// A three-dimensional work (a diorama, a sculpture — the artist chose "입체
// 작품 · 액자 해당 없음" in the portal). Its photos show the piece in the
// studio with the wall and stand behind it, so pasting one into a room photo
// reads as a poster propped on the table, not the object: these works get no
// room preview, only their own photos (ArtworkDetailView).
export function isStandingWork(extras: { frame?: string } | undefined): boolean {
  return extras?.frame === "na";
}

export function sceneImage(key: SceneKey): string {
  return `/rooms/${key}${key === "console" || key === "shelf" ? "-day" : ""}.webp`;
}

export function sceneNightImage(key: SceneKey): string {
  const version = key === "console" || key === "shelf" ? "" : "-v2";
  return `/rooms/${key}-night${version}.webp`;
}

/**
 * Where the work lands, in % of the 5:4 photo — the same arithmetic as
 * RoomPreview with no frame. Large works are capped so they never fill the
 * wall edge to edge.
 */
export function placeWork(scene: Scene, w: number, h: number) {
  const geometry = SCENE_GEOMETRY[scene.key];
  const reference = scene.placement === "standing" ? geometry.widthCm : WALL_REFERENCE_CM;
  const scaleW = Math.min(100 / reference, 62 / w, (58 * 0.8) / h);
  const widthPct = w * scaleW;
  const heightPct = h * (scaleW / 0.8);
  const bottomPct = scene.placement === "standing" ? 100 - geometry.anchor : 100 - geometry.anchor - heightPct / 2;
  const topPct = 100 - bottomPct - heightPct;
  return { leftPct: (100 - widthPct) / 2, topPct, widthPct, heightPct };
}

export function parseScene(value: string | null): Scene | null {
  if (!value) return null;
  return STRIP_SCENES.find((scene) => scene.key === value) ?? null;
}
