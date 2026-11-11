import { cache } from "react";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { artworks, getArtwork } from "@/lib/artworks";
import type { Artwork, ArtistSlug, StatusKey } from "@/lib/artists";
import { DatabaseNotConfiguredError, getSql } from "@/lib/db";
import { STATUS_LABEL, getApprovedSubmissions } from "@/lib/dynamic-artworks";
import { getSubmissionById } from "@/lib/artist-portal-db";
import { parseArtworkExtras, proofPhotos, type ArtworkExtras, type ProofKey, type ProofPhotos } from "@/lib/artwork-extras";
import { applyStaticProofPhotos, getStaticProofPhotos, removeProofFiles, setStaticProofPhoto, setSubmissionProofPhoto } from "@/lib/artwork-proof-photos";
import { applyStaticCopyEdits, getStaticCopyEdits } from "@/lib/artwork-copy-edits";
import { applyStaticMainImages, getStaticMainImages } from "@/lib/artwork-main-images";
import { applyRegistrationDetails, getRegistrationDetails } from "@/lib/artwork-registration-details";

/**
 * 사이트에 걸린 작품을 내리기·다시 걸기·판매완료·삭제하는 기능(2026-09-27).
 *
 * 권한: 운영자("admin")는 모든 작품을, 작가는 **자기 작품만** 바꿀 수 있다. 소유 확인은
 * 브라우저가 보낸 값이 아니라 서버가 작품 원본(정적 카탈로그의 artistSlug, DB 행의
 * artist_slug)을 직접 읽어서 로그인한 작가와 비교한다(`performWorkAction`).
 *
 * 저장: `artwork_controls` 한 표가 정적 작품(artworks.ts)과 포털 작품
 * ("submission-<uuid>") 모두의 내림·삭제·판매 상태를 덮어쓴다. 정적 작품은 실행 중에
 * 코드에서 지울 수 없으니 "삭제"는 영구히 숨기는 것(deleted)이고, 포털 작품의 삭제는
 * DB 행과 사진 파일을 실제로 지운다. 판매 상태는 포털 작품이면 그 행의 status_key를
 * 바꾼다.
 */

export type WorkAction = "hide" | "show" | "sold" | "available" | "delete";
export const WORK_ACTIONS: WorkAction[] = ["hide", "show", "sold", "available", "delete"];
export type WorkActor = "admin" | ArtistSlug;

type ControlRow = { slug: string; artist_slug: string; hidden: boolean; deleted: boolean; status_key: string | null };

const STATUS_KEYS: StatusKey[] = ["available", "sold", "pending"];
const SUBMISSION_PREFIX = "submission-";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DB가 아예 없거나(설정 전) 표가 아직 없으면 작품을 그대로 보여준다. 하지만 DB가 있는데 조회만
 * 실패(일시 장애·시간 초과)했다면 빈 목록으로 대체하지 않고 오류를 던진다 — 빈 목록이면 내린·삭제한
 * 작품이 다시 공개되기 때문이다. 던지면 Next는 직전에 정상 생성된 페이지를 그대로 유지한다.
 */
export const getArtworkControls = cache(async (): Promise<Map<string, ControlRow>> => {
  try {
    const rows = (await getSql()`SELECT slug, artist_slug, hidden, deleted, status_key FROM artwork_controls`) as ControlRow[];
    return new Map(rows.map((row) => [row.slug, row]));
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError || (error as { code?: string })?.code === "42P01") {
      console.warn("artwork-controls: no controls table available, showing every work", error);
      return new Map();
    }
    console.error("artwork-controls: could not load controls; refusing to re-publish taken-down works", error);
    throw error;
  }
});

function withStatus(artwork: Artwork, statusKey: StatusKey): Artwork {
  if (artwork.statusKey === statusKey) return artwork;
  return {
    ...artwork,
    statusKey,
    ko: { ...artwork.ko, status: STATUS_LABEL[statusKey].ko },
    en: { ...artwork.en, status: STATUS_LABEL[statusKey].en },
  };
}

/** Drops taken-down / deleted works and applies status overrides. */
export function applyControls(list: Artwork[], controls: Map<string, ControlRow>): Artwork[] {
  return list.flatMap((artwork) => {
    const control = controls.get(artwork.slug);
    if (!control) return [artwork];
    if (control.hidden || control.deleted) return [];
    const statusKey = STATUS_KEYS.find((key) => key === control.status_key);
    return [statusKey ? withStatus(artwork, statusKey) : artwork];
  });
}

type Owner =
  | { kind: "static"; artistSlug: ArtistSlug }
  | { kind: "submission"; artistSlug: string; id: string; imageUrls: string[]; extras: ArtworkExtras };

async function findOwner(slug: string): Promise<Owner | null> {
  const staticWork = getArtwork(slug);
  if (staticWork) return { kind: "static", artistSlug: staticWork.artistSlug };
  if (!slug.startsWith(SUBMISSION_PREFIX)) return null;
  const id = slug.slice(SUBMISSION_PREFIX.length);
  if (!UUID.test(id)) return null;
  const row = await getSubmissionById(id);
  return row ? { kind: "submission", artistSlug: row.artist_slug, id: row.id, imageUrls: row.image_urls, extras: row.extras } : null;
}

export type WorkActionResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" | "invalid_action" };

export async function performWorkAction(slug: string, action: WorkAction, actor: WorkActor): Promise<WorkActionResult> {
  if (!WORK_ACTIONS.includes(action)) return { ok: false, error: "invalid_action" };
  const owner = await findOwner(slug);
  if (!owner) return { ok: false, error: "not_found" };
  // 작가는 자기 작품만. 이 한 줄이 "다른 작가 작품은 절대 못 건드린다"를 지킨다.
  if (actor !== "admin" && owner.artistSlug !== actor) return { ok: false, error: "forbidden" };

  const sql = getSql();
  const existing = (await sql`SELECT slug, artist_slug, hidden, deleted, status_key FROM artwork_controls WHERE slug = ${slug}`) as ControlRow[];
  const current = existing[0] ?? { slug, artist_slug: owner.artistSlug, hidden: false, deleted: false, status_key: null };
  // 작가가 지운 정적 작품은 작가 화면에서 사라지고, 되살리기는 운영자만 한다.
  if (current.deleted && actor !== "admin") return { ok: false, error: "not_found" };

  if (action === "delete" && owner.kind === "submission") {
    await sql`DELETE FROM artwork_submissions WHERE id = ${owner.id}`;
    await sql`DELETE FROM artwork_controls WHERE slug = ${slug}`;
    if (owner.imageUrls.length) {
      await del(owner.imageUrls).catch((error) => console.warn("artwork-controls: photo files were not removed", error));
    }
    await removeProofFiles(proofPhotos(owner.extras).map(([, url]) => url));
  } else {
    const next = { ...current };
    if (action === "hide") next.hidden = true;
    if (action === "show") {
      next.hidden = false;
      next.deleted = false;
    }
    if (action === "delete") {
      next.hidden = true;
      next.deleted = true;
    }
    if (action === "sold" || action === "available") {
      if (owner.kind === "submission") {
        await sql`UPDATE artwork_submissions SET status_key = ${action} WHERE id = ${owner.id}`;
      } else {
        next.status_key = action;
      }
    }
    await sql`
      INSERT INTO artwork_controls (slug, artist_slug, hidden, deleted, status_key, updated_by, updated_at)
      VALUES (${slug}, ${owner.artistSlug}, ${next.hidden}, ${next.deleted}, ${next.status_key}, ${actor}, now())
      ON CONFLICT (slug) DO UPDATE SET hidden = ${next.hidden}, deleted = ${next.deleted}, status_key = ${next.status_key},
        updated_by = ${actor}, updated_at = now()
    `;
  }

  // Catalog pages are statically cached; refresh the whole tree like the approve route does.
  revalidatePath("/", "layout");
  return { ok: true };
}

export type ManagedWork = {
  slug: string;
  artistSlug: string;
  title_ko: string;
  title_en: string;
  description_ko: string;
  description_en: string;
  details_ko: string;
  details_en: string;
  price: string;
  image: string;
  statusKey: StatusKey;
  hidden: boolean;
  deleted: boolean;
  /** 실물 확인 사진(서명·뒷면·옆면). 포털 "내 작품 관리"에서 더하고 바꾼다. */
  proof: ProofPhotos;
  extras: ArtworkExtras;
};

/**
 * Works shown on the site (static + approved portal works) with their current
 * control state, for the management lists. `artistSlug` limits it to one
 * artist (the portal); null lists everyone (admin). Artists never see works
 * they deleted.
 */
export async function listManagedWorks(artistSlug: ArtistSlug | null): Promise<ManagedWork[]> {
  const [controls, approved, staticProof, copyEdits, mainImages, registration] = await Promise.all([getArtworkControls(), getApprovedSubmissions(), getStaticProofPhotos(), getStaticCopyEdits(), getStaticMainImages(), getRegistrationDetails()]);
  const all = applyRegistrationDetails(applyStaticProofPhotos([...applyStaticMainImages(applyStaticCopyEdits(artworks, copyEdits), mainImages), ...approved], staticProof), registration);
  return all
    .filter((artwork) => artistSlug === null || artwork.artistSlug === artistSlug)
    .map((artwork) => {
      const control = controls.get(artwork.slug);
      const statusKey = STATUS_KEYS.find((key) => key === control?.status_key) ?? artwork.statusKey;
      return {
        slug: artwork.slug,
        artistSlug: artwork.artistSlug,
        title_ko: artwork.ko.title,
        title_en: artwork.en.title,
        description_ko: artwork.ko.description,
        description_en: artwork.en.description,
        details_ko: artwork.ko.details,
        details_en: artwork.en.details,
        price: artwork.price ?? "",
        image: artwork.image,
        statusKey,
        hidden: Boolean(control?.hidden),
        deleted: Boolean(control?.deleted),
        proof: artwork.extras?.proof ?? {},
        extras: artwork.extras ?? {},
      };
    })
    .filter((work) => artistSlug === null || !work.deleted);
}

/**
 * 이미 걸린 작품의 실물 확인 사진 한 칸을 올리거나 바꾸거나(`upload`) 지운다(`upload` 없음).
 * `performWorkAction`과 같은 규칙으로 서버가 작품 주인을 확인한 뒤에만 파일을 올린다.
 * 바뀌거나 지워진 옛 파일은 Blob에서도 지운다.
 */
export async function changeProofPhoto(
  slug: string,
  key: ProofKey,
  upload: ((artistSlug: string) => Promise<string>) | null,
  actor: WorkActor,
): Promise<WorkActionResult> {
  const owner = await findOwner(slug);
  if (!owner) return { ok: false, error: "not_found" };
  if (actor !== "admin" && owner.artistSlug !== actor) return { ok: false, error: "forbidden" };
  if (actor !== "admin" && (await getArtworkControls()).get(slug)?.deleted) return { ok: false, error: "not_found" };
  if (!upload && key === "edge") {
    const facts = owner.kind === "submission" ? owner.extras : parseArtworkExtras((await getRegistrationDetails()).get(slug)?.extras);
    if (facts.condition === "issues") return { ok: false, error: "invalid_action" };
  }

  const url = upload ? await upload(owner.artistSlug) : null;
  let replaced: string | null;
  try {
    replaced = owner.kind === "submission"
      ? await setSubmissionProofPhoto(owner.id, owner.extras, key, url)
      : await setStaticProofPhoto(slug, owner.artistSlug, key, url, actor);
  } catch (error) {
    await removeProofFiles([url]); // don't leave the just-uploaded file behind
    throw error;
  }
  if (replaced !== url) await removeProofFiles([replaced]);
  revalidatePath("/", "layout");
  return { ok: true };
}
