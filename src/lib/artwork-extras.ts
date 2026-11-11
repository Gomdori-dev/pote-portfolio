/**
 * 작가 포털 "액자·설치" 칸에서 받는 작품 부가 정보(2026-09-25 추가).
 * artwork_submissions.extras(JSONB)에 저장되고, 작품 상세 페이지에 행으로 보인다.
 *
 * 사실 항목은 선택지·숫자·짧은 기호(에디션 "3/20")로 받는다.
 * 상태 설명은 conditionNoteKo/En으로 번역해 두 언어에 함께 제공한다.
 */
export const FRAME_KEYS = ["framed", "ready", "needs", "na", "negotiable"] as const;
export type FrameKey = (typeof FRAME_KEYS)[number];
export const FRAME_MATERIALS = ["wood", "metal", "other"] as const;
export type FrameMaterial = (typeof FRAME_MATERIALS)[number];

export type ArtworkExtras = {
  medium?: "painting" | "print" | "craft" | "photo";
  photoProcess?: "inkjet" | "silver" | "ctype" | "other";
  photoPaper?: "cotton" | "fiber" | "resin" | "hanji" | "other";
  workKind?: "original" | "limited" | "open" | "reproduction";
  condition?: "clear" | "issues" | "unknown";
  conditionNoteKo?: string;
  conditionNoteEn?: string;
  signature?: "signed" | "unsigned" | "planned";
  signatureLocation?: "front" | "back" | "other";
  pricing?: "fixed" | "inquiry";
  authorized?: boolean;
  installation?: "ready" | "needs" | "na";
  certificateAvailability?: "yes" | "no" | "arrange";
  frame?: FrameKey;
  frameMaterial?: FrameMaterial;
  framedWidthCm?: number;
  framedHeightCm?: number;
  depthCm?: number;
  edition?: string;
  hangingReady?: boolean;
  certificate?: boolean;
  /** 실물 확인 사진(09-28 고객 임장 P0): 서명·뒷면·옆면 접사. 값은 Vercel Blob 공개 주소. */
  proof?: ProofPhotos;
};

/** 서명 위치, 뒷면(캔버스 틀·표기), 옆면·표면(두께·질감·흠) — 구매자가 입금 전에 가장 많이 묻는 세 컷. */
export const PROOF_KEYS = ["signature", "back", "edge"] as const;
export type ProofKey = (typeof PROOF_KEYS)[number];
export type ProofPhotos = Partial<Record<ProofKey, string>>;

export const PROOF_LABEL_KEY = {
  signature: "proofSignature",
  back: "proofBack",
  edge: "proofEdge",
} as const satisfies Record<ProofKey, string>;

/** 포털이 올린 Blob 주소만 받는다. 다른 주소를 넣으면 상세에 남의 이미지가 뜰 수 있다. */
function blobUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 600) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export const FRAME_LABEL_KEY = {
  framed: "frameFramed",
  ready: "frameReady",
  needs: "frameNeeds",
  na: "frameNA",
  negotiable: "frameNegotiable",
} as const satisfies Record<FrameKey, string>;

export const FRAME_MATERIAL_LABEL_KEY = {
  wood: "frameMaterialWood",
  metal: "frameMaterialMetal",
  other: "frameMaterialOther",
} as const satisfies Record<FrameMaterial, string>;

function cm(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 10) / 10 : undefined;
}

/**
 * DB 값이든 폼 값이든 받아서 알려진 필드만, 올바른 형태로만 남긴다. 모르는 값은 버린다.
 * 액자가 "포함"이 아니면 액자 재질·액자 포함 크기는 의미가 없으니 지운다.
 */
export function parseArtworkExtras(raw: unknown): ArtworkExtras {
  let source: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) source = parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: ArtworkExtras = {};
  const choices = {
    medium: ["painting", "print", "craft", "photo"],
    photoProcess: ["inkjet", "silver", "ctype", "other"],
    photoPaper: ["cotton", "fiber", "resin", "hanji", "other"],
    workKind: ["original", "limited", "open", "reproduction"],
    condition: ["clear", "issues", "unknown"], signature: ["signed", "unsigned", "planned"],
    signatureLocation: ["front", "back", "other"],
    pricing: ["fixed", "inquiry"], installation: ["ready", "needs", "na"],
    certificateAvailability: ["yes", "no", "arrange"],
  } as const;
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    if ((choices[key] as readonly unknown[]).includes(source[key])) Object.assign(out, { [key]: source[key] });
  }
  for (const key of ["conditionNoteKo", "conditionNoteEn"] as const) {
    if (typeof source[key] === "string" && source[key].trim()) out[key] = source[key].trim().slice(0, 1000);
  }
  if (source.authorized === true || source.authorized === "true") out.authorized = true;
  if (FRAME_KEYS.includes(source.frame as FrameKey)) out.frame = source.frame as FrameKey;
  if (out.frame === "framed") {
    if (FRAME_MATERIALS.includes(source.frameMaterial as FrameMaterial)) out.frameMaterial = source.frameMaterial as FrameMaterial;
    const w = cm(source.framedWidthCm);
    const h = cm(source.framedHeightCm);
    if (w && h) {
      out.framedWidthCm = w;
      out.framedHeightCm = h;
    }
  }
  const depth = cm(source.depthCm);
  if (depth) out.depthCm = depth;
  if (typeof source.edition === "string") {
    const edition = source.edition.trim().slice(0, 20);
    if (/^[\w\s/.\-#]+$/.test(edition)) out.edition = edition;
  }
  if (source.hangingReady === true || source.hangingReady === "true" || source.hangingReady === "on") out.hangingReady = true;
  if (source.certificate === true || source.certificate === "true" || source.certificate === "on") out.certificate = true;
  if (out.certificateAvailability) out.certificate = out.certificateAvailability === "yes";
  if (out.installation) out.hangingReady = out.installation === "ready";
  if (source.proof && typeof source.proof === "object" && !Array.isArray(source.proof)) {
    const proof: ProofPhotos = {};
    for (const key of PROOF_KEYS) {
      const url = blobUrl((source.proof as Record<string, unknown>)[key]);
      if (url) proof[key] = url;
    }
    if (Object.keys(proof).length) out.proof = proof;
  }
  return out;
}

/** 올라온 순서(서명 → 뒷면 → 옆면)대로 [키, 주소] 목록. 없으면 빈 배열. */
export function proofPhotos(extras: ArtworkExtras | undefined): [ProofKey, string][] {
  return PROOF_KEYS.flatMap((key) => (extras?.proof?.[key] ? [[key, extras.proof[key]] as [ProofKey, string]] : []));
}

export function hasExtras(extras: ArtworkExtras | undefined): extras is ArtworkExtras {
  return !!extras && Object.keys(extras).length > 0;
}
