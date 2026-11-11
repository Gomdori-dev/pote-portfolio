import crypto from "node:crypto";
import { artists, type ArtistSlug } from "@/lib/artists";
import { artworkDimensionsCm, artworkPrice } from "@/lib/catalog";
import { KNOWN_COLORS } from "@/lib/korean-labels";
import { getSql } from "@/lib/db";
import { MAIL_FROM, MAIL_INBOX, getResend } from "@/lib/mail";
import type { SubmissionRecord } from "@/lib/artist-portal-db";
import { registrationError } from "@/lib/artwork-registration";

/**
 * Automatic first-pass review of an artist-portal upload. It never approves
 * anything by itself: it marks a row "pass" or "hold", fills a blank 주요 색
 * from the photo, and emails the owner a one-click approve link. The owner
 * still presses the button (decided 2026-09-27; full auto-approve can come
 * later once the verdicts have proven reliable).
 */

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_REVIEW_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type AiReview = {
  verdict: "pass" | "hold";
  /** Korean, one short sentence each; empty when verdict is "pass". */
  issues: string[];
  /** Fields the reviewer filled in, e.g. ["주요 색"]. */
  filled: string[];
  checkedAt: string;
  /** A persisted lease also leaves evidence if the platform stops the worker. */
  runId?: string;
  retryable?: boolean;
  phase?: "running" | "complete" | "failed";
};

type VisionResult = {
  showsPeopleOrAnimals: boolean;
  subjectLocation: "outside-artwork" | "inside-artwork" | "none";
  multipleArtworks: boolean;
  isArtworkPhoto: boolean;
  photoQualityOk: boolean;
  problem: string;
  palette: string[];
  descriptionKo: string;
  descriptionEn: string;
};

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://potegallery.com";
}

export function artistName(slug: string) {
  return artists[slug as ArtistSlug]?.name.ko ?? slug;
}

// --- one-click approve link -------------------------------------------------

function approveSecret() {
  const secret = process.env.ARTIST_SESSION_SECRET;
  if (!secret) throw new Error("ARTIST_SESSION_SECRET is not configured");
  return secret;
}

export function quickApproveToken(id: string): string {
  return crypto.createHmac("sha256", approveSecret()).update(`quick-approve:${id}`).digest("hex");
}

export function verifyQuickApproveToken(id: string, token: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(quickApproveToken(id), "hex"));
}

export function quickApproveUrl(id: string) {
  return `${siteUrl()}/admin/quick-approve?id=${id}&t=${quickApproveToken(id)}`;
}

// --- checks -----------------------------------------------------------------

function ruleIssues(submission: SubmissionRecord): string[] {
  const issues: string[] = [];
  if (submission.extras.medium === "photo" && registrationError(submission.extras, submission.price ?? "", Boolean(submission.extras.proof?.edge))) issues.push("사진은 서명과 번호·총 수량이 있는 실물 한정 에디션인지 확인해 주세요.");
  if (submission.status_key === "available" && submission.extras.pricing !== "inquiry" && artworkPrice(submission.price ?? undefined) === null) {
    issues.push(submission.price ? `가격 "${submission.price}"을 숫자로 읽을 수 없어요.` : "판매 중인데 가격이 없어요.");
  }
  if (!artworkDimensionsCm(submission.details_ko)) {
    issues.push(`크기를 읽을 수 없어요("${submission.details_ko}"). 공간에 걸어보기와 크기 필터가 빠져요.`);
  }
  if (/[가-힣]/.test(submission.title_en) || /[가-힣]/.test(submission.details_en)) {
    issues.push("영문 번역이 비어 한국어가 그대로 들어가 있어요.");
  }
  if (submission.image_urls.length === 0) issues.push("사진이 없어요.");
  if (submission.extras.condition === "issues") issues.push(`작가가 신고한 흠·수리 이력: ${submission.extras.conditionNoteKo ?? "설명 확인 필요"}`);
  if (submission.extras.condition === "unknown") issues.push("현재 작품 상태는 작가 확인이 필요해요.");
  return issues;
}

async function fetchImagePart(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  if (!response.ok) throw new Error(`image fetch ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image too large to review");
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { inlineData: { mimeType, data: bytes.toString("base64") } };
}

async function lookAtPhotos(submission: SubmissionRecord, wantPalette: boolean, wantDescription: boolean, signal: AbortSignal): Promise<VisionResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  signal.throwIfAborted();
  const images = await Promise.all(submission.image_urls.slice(0, MAX_REVIEW_IMAGES).map((url) => fetchImagePart(url, signal)));
  const colorList = KNOWN_COLORS.map((color) => color.ko).join(", ");

  const prompt = `온라인 미술관에 작가가 올린 작품 사진 ${images.length}장이다. 작품 제목: "${submission.title_ko}", 정보: "${submission.details_ko}".
작품 분야: ${submission.extras.medium ?? "미확인"}. 사진 작품으로 명시한 경우 작가가 직접 촬영한 풍경·정물·추상 사진의 실물 한정 에디션을 받는다. 인화 방식·용지와 실물 제작 여부는 사진만으로 확정하지 않는다.
첫 번째 사진이 대표 사진이다. 두 번째부터는 부분 확대, 측면, 걸어 둔 모습일 수 있으니 일부만 보여도 문제가 아니다.
다음을 판단해라.
- subjectLocation: 사진 촬영 현장에 실제 사람(얼굴·손·몸)이나 동물이 보이면 "outside-artwork". 작품 안에 그려진 얼굴·인물·동물·의인화된 형태만 보이면 "inside-artwork". 둘 다 없으면 "none". 실제 대상과 그려진 대상이 함께 있으면 "outside-artwork". 회화 속 뱀·곰·사람 얼굴과 청화백자에 그려진 용은 실제 동물이 아니다.
- showsPeopleOrAnimals: subjectLocation이 "outside-artwork"일 때만 true. "inside-artwork"이면 반드시 false. 그림의 소재를 사람·동물 촬영 제한으로 판단하지 마라.
- multipleArtworks: 대표 사진에 서로 다른 작품이 두 점 이상 함께 찍혀 있거나, 첨부 사진마다 서로 다른 작품이 보이면 true. 사진 사이의 구도·형태를 비교해 같은 작품의 전체·부분·측면 사진인지 확인해라. 한 작품을 여러 각도로 찍은 것은 해당하지 않는다.
- isArtworkPhoto: 회화·판화·공예·입체 작품을 보여주면 true. 사진 분야로 명시된 풍경·정물·추상 사진도 true. 사진 분야가 아닌 풍경·실내 스냅샷, 스크린샷, 문서는 false. 사람·동물 사진은 showsPeopleOrAnimals로 따로 표시한다.
- photoQualityOk: 대표 사진만 본다. 흐리지 않고, 작품 가장자리가 사진 밖으로 잘리지 않았고, 너무 어둡거나 심하게 기울지 않았으면 true. 사진 작품의 인화 여백 없이 전체 이미지로 제출한 경우 화면을 꽉 채운 것은 잘린 것이 아니다. 사진 작품에 액자·인화 여백이 없는 것만으로 실패시키지 마라.
- problem: 위에서 하나라도 문제가 있으면 무엇이 문제인지 한국어 한 문장. 작품 속에 그려진 인물·동물은 문제에 넣지 마라. 없으면 빈 문자열.
- palette: ${wantPalette ? `대표 사진의 작품에서 눈에 띄는 색 3개. 반드시 이 목록의 이름만 쓴다: ${colorList}` : "빈 배열"}
- descriptionKo: ${wantDescription ? "대표 사진에 실제로 보이는 것만으로 쓴 작품 설명 한국어 1~2문장(80자 안팎). 주요 색, 붓 자국·질감·크랙·광택 같은 표면 느낌, 눈에 보이는 형태를 담백하게 묘사한다. 작가의 의도·감정·의미를 지어내지 말고, '~한 느낌', '독특한', '감각적인' 같은 상투어도 쓰지 않는다." : "빈 문자열"}
- descriptionEn: ${wantDescription ? "descriptionKo와 같은 내용을 자연스러운 영어 1~2문장으로." : "빈 문자열"}`;

  const requestBody = JSON.stringify({
  contents: [{ parts: [{ text: prompt }, ...images] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            showsPeopleOrAnimals: { type: "BOOLEAN" },
            subjectLocation: { type: "STRING", enum: ["outside-artwork", "inside-artwork", "none"] },
            multipleArtworks: { type: "BOOLEAN" },
            isArtworkPhoto: { type: "BOOLEAN" },
            photoQualityOk: { type: "BOOLEAN" },
            problem: { type: "STRING" },
            palette: { type: "ARRAY", items: { type: "STRING" } },
            descriptionKo: { type: "STRING" },
            descriptionEn: { type: "STRING" },
          },
          required: ["showsPeopleOrAnimals", "subjectLocation", "multipleArtworks", "isArtworkPhoto", "photoQualityOk", "problem", "palette", "descriptionKo", "descriptionEn"],
        },
        maxOutputTokens: 1536,
      },
  });

  // Gemini answers 503/429 now and then when it is busy; retry a couple of times.
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    if (attempt > 0) await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 2_000 * attempt);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      body: requestBody,
    });
    if (response.ok || (response.status !== 503 && response.status !== 429)) break;
  }
  if (!response || !response.ok) throw new Error(`gemini responded ${response?.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("empty gemini response");
  return JSON.parse(text) as VisionResult;
}

/**
 * Reviews one pending submission, stores the result in `ai_review`, and fills
 * a blank palette and a blank description from the photo — 소품 included
 * (decided 2026-09-30). Null means another worker/edit superseded this run.
 * Storage failures throw, so callers must not email an unsaved success.
 */
export async function reviewSubmission(submission: SubmissionRecord, deadline = Date.now() + 40_000): Promise<AiReview | null> {
  const sql = getSql();
  const runId = crypto.randomUUID();
  const running: AiReview = {
    verdict: "hold", issues: ["자동 검토 진행 중입니다. 중단되면 정기 작업에서 다시 확인합니다."],
    filled: [], checkedAt: new Date().toISOString(), runId, retryable: true, phase: "running",
  };
  const claimed = await sql`
    UPDATE artwork_submissions SET ai_review = ${JSON.stringify(running)}::jsonb
    WHERE id = ${submission.id} AND status = 'pending'
      AND (ai_review->>'phase' IS DISTINCT FROM 'running'
        OR COALESCE(ai_review->>'checkedAt', '') < to_char((now() - interval '2 minutes') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      AND ai_review IS NOT DISTINCT FROM ${submission.ai_review ? JSON.stringify(submission.ai_review) : null}::jsonb
      AND image_urls = ${JSON.stringify(submission.image_urls)}::jsonb
      AND COALESCE(extras, '{}'::jsonb) = ${JSON.stringify(submission.review_extras ?? submission.extras)}::jsonb
      AND title_ko = ${submission.title_ko} AND title_en = ${submission.title_en}
      AND details_ko = ${submission.details_ko} AND details_en = ${submission.details_en}
      AND description_ko = ${submission.description_ko} AND palette_ko = ${submission.palette_ko}
      AND status_key = ${submission.status_key}
      AND price IS NOT DISTINCT FROM ${submission.price}
    RETURNING id
  `;
  if (!claimed.length) return null;
  console.info("artwork-review started", { id: submission.id, runId });
  const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  const issues = ruleIssues(submission);
  let retryable = false;
  const filled: string[] = [];
  const wantPalette = !submission.palette_ko.trim();
  const wantDescription = !submission.description_ko.trim();
  let palette: { ko: string; en: string }[] = [];
  let description: { ko: string; en: string } | null = null;

  try {
    const vision = await lookAtPhotos(submission, wantPalette, wantDescription, signal);
    const realSubjects = vision.subjectLocation === "outside-artwork";
    if (realSubjects) issues.push("작품 밖의 촬영 현장에 실제 사람이나 동물이 보여요. 그림 안에 그려진 인물·동물은 제외 대상이 아닙니다.");
    if (!["outside-artwork", "inside-artwork", "none"].includes(vision.subjectLocation)) issues.push("실제 촬영 대상과 작품 속 표현을 구분하지 못했어요. 사진을 직접 확인해 주세요.");
    if (vision.multipleArtworks) issues.push("서로 다른 작품이 한 제출에 묶여 있어요. ‘사진마다 별도 작품’으로 나눠 제출해야 각각 전시·판매할 수 있어요.");
    if (!vision.isArtworkPhoto) issues.push("작품 사진이 아닌 것 같아요.");
    if (!vision.photoQualityOk) issues.push("사진이 흐리거나 작품이 잘려 보여요.");
    if (vision.problem.trim() && (realSubjects || vision.multipleArtworks || !vision.isArtworkPhoto || !vision.photoQualityOk)) {
      issues.push(`AI 메모: ${vision.problem.trim()}`);
    }
    if (wantPalette) {
      palette = [...new Set(vision.palette)]
        .map((name) => KNOWN_COLORS.find((color) => color.ko === name.trim()))
        .filter((color): color is { ko: string; en: string } => Boolean(color))
        .slice(0, 3);
    }
    if (wantDescription && vision.descriptionKo.trim() && vision.descriptionEn.trim()) {
      description = { ko: vision.descriptionKo.trim(), en: vision.descriptionEn.trim() };
    }
  } catch (error) {
    retryable = true;
    // Never log request URLs: the Gemini credential is a query parameter.
    console.error("artwork-review vision failed", { id: submission.id, runId, error: error instanceof Error ? error.name : "UnknownError" });
    issues.push("AI 사진 검토에 실패했어요. 사진을 직접 확인해 주세요.");
  }

  const review: AiReview = {
    verdict: issues.length === 0 ? "pass" : "hold",
    issues,
    filled,
    checkedAt: new Date().toISOString(),
    runId, retryable, phase: retryable ? "failed" : "complete",
  };

  if (palette.length) review.filled.push("주요 색");
  if (description) review.filled.push("작품 설명");
  // One atomic write: an edit clearing the lease invalidates every old result,
  // including auto-filled copy. Approval also prevents a late reviewer write.
  const saved = await sql`
    UPDATE artwork_submissions SET ai_review = ${JSON.stringify(review)}::jsonb,
      palette_ko = CASE WHEN palette_ko = '' THEN ${palette.map((c) => c.ko).join(", ")} ELSE palette_ko END,
      palette_en = CASE WHEN palette_ko = '' AND ${palette.length > 0} THEN ${palette.map((c) => c.en).join(", ")} ELSE palette_en END,
      description_ko = CASE WHEN description_ko = '' THEN ${description?.ko ?? ""} ELSE description_ko END,
      description_en = CASE WHEN description_ko = '' AND ${Boolean(description)} THEN ${description?.en ?? ""} ELSE description_en END
    WHERE id = ${submission.id} AND status = 'pending' AND ai_review->>'runId' = ${runId}
      AND COALESCE(extras, '{}'::jsonb) = ${JSON.stringify(submission.review_extras ?? submission.extras)}::jsonb
      AND image_urls = ${JSON.stringify(submission.image_urls)}::jsonb
      AND title_ko = ${submission.title_ko} AND details_ko = ${submission.details_ko}
      AND description_ko = ${submission.description_ko} AND palette_ko = ${submission.palette_ko}
      AND price IS NOT DISTINCT FROM ${submission.price} AND status_key = ${submission.status_key}
    RETURNING id
  `;
  if (!saved.length) return null;
  console.info("artwork-review finished", { id: submission.id, runId, verdict: review.verdict, retryable });
  return review;
}

// --- email --------------------------------------------------------------------

function describe(submission: SubmissionRecord, review: AiReview) {
  const head = review.verdict === "pass" ? "✅ 검토 통과" : "⚠️ 확인 필요";
  const lines = [
    `${head} · ${artistName(submission.artist_slug)} · ${submission.title_ko}`,
    `${submission.details_ko}${submission.price ? ` · ${submission.price}` : ""}`,
    ...(submission.extras.condition ? [`  작품 상태: ${submission.extras.condition}${submission.extras.conditionNoteKo ? ` · ${submission.extras.conditionNoteKo}` : ""}`] : []),
    ...(submission.extras.medium === "photo" ? ["  사진 확인: 직접 촬영·판매 권한 / 풍경·정물·추상(실제 사람·동물 없음) / 실물 인화 방식·용지 / 인화·액자 크기 / 서명·에디션 번호·총 수량"] : []),
    ...(submission.extras.medium === "craft" ? ["  공예 확인: 직접 제작 / 재료·가로·세로·깊이·무게 / 설치·구성품 / 포장·파손·배송 조건"] : []),
    ...(submission.extras.proof?.edge ? [`  옆면·표면/흠 사진: ${submission.extras.proof.edge}`] : []),
    ...review.issues.map((issue) => `  - ${issue}`),
    ...(review.filled.length ? [`  (자동으로 채움: ${review.filled.join(", ")})`] : []),
    `  승인하기: ${quickApproveUrl(submission.id)}`,
  ];
  return lines.join("\n");
}

export async function sendToOwner(subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const result = await getResend().emails.send({ from: MAIL_FROM, to: MAIL_INBOX, subject, text });
    if (result.error) throw result.error;
  } catch (error) {
    console.error("artwork review email failed", error);
  }
}

export async function emailReview(submission: SubmissionRecord, review: AiReview) {
  const tag = review.verdict === "pass" ? "✅ 통과" : "⚠️ 확인 필요";
  await sendToOwner(
    `[Pote] ${tag} — ${artistName(submission.artist_slug)} 작가 새 작품: ${submission.title_ko}`,
    `${describe(submission, review)}\n\n승인 버튼을 누르면 바로 사이트에 걸려요. 전체 목록: ${siteUrl()}/admin/submissions`,
  );
}

export async function emailDigest(items: { submission: SubmissionRecord; review: AiReview }[]) {
  const passed = items.filter((item) => item.review.verdict === "pass").length;
  await sendToOwner(
    `[Pote] 승인 대기 ${items.length}점 (통과 ${passed} · 확인 필요 ${items.length - passed})`,
    `${items.map((item) => describe(item.submission, item.review)).join("\n\n")}\n\n전체 목록: ${siteUrl()}/admin/submissions`,
  );
}

export function parseAiReview(value: unknown): AiReview | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed && (parsed.verdict === "pass" || parsed.verdict === "hold") && Array.isArray(parsed.issues)) {
      return {
        verdict: parsed.verdict,
        issues: parsed.issues.filter((item: unknown): item is string => typeof item === "string"),
        filled: Array.isArray(parsed.filled) ? parsed.filled.filter((item: unknown): item is string => typeof item === "string") : [],
        checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : "",
        ...(typeof parsed.runId === "string" ? { runId: parsed.runId } : {}),
        ...(typeof parsed.retryable === "boolean" ? { retryable: parsed.retryable } : {}),
        ...(["running", "complete", "failed"].includes(parsed.phase) ? { phase: parsed.phase as AiReview["phase"] } : {}),
      };
    }
  } catch {
    // fall through
  }
  return null;
}
