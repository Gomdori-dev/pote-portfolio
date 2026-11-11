import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { artworks, type MoodKey } from "@/lib/artworks";

// i18n.tsx는 "use client" 모듈이라 서버 라우트에서 값을 직접 import할 수 없어, 언어 목록을 여기 그대로 둔다.
// (@/lib/i18n의 Lang 타입과 반드시 동일하게 유지할 것 — 2026-09-19에 ko/en 2개로 축소)
const LANG_CODES = ["ko", "en"] as const;

const GEMINI_MODEL = "gemini-3.1-flash-lite"; // 무료 티어 일일 한도가 더 넉넉함 (gemini-3.6-flash는 하루 20회로 매우 제한적)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const moodLabel: Record<MoodKey, string> = {
  quiet: "고요한",
  warm: "따뜻한",
  vivid: "선명한",
  delicate: "섬세한",
};

/** 등록된 작품 중 실제 판매가가 있는(문의가능) 작품만 골라 무드별 참고 시세를 만든다. 표본이 적을 수 있다는 점은 프롬프트에서 그대로 명시한다. */
function buildComparables() {
  const byMood = new Map<MoodKey, number[]>();
  for (const artwork of artworks) {
    if (artwork.statusKey !== "available" || !artwork.price) continue;
    const numeric = Number(artwork.price.replace(/[^0-9]/g, ""));
    if (!numeric) continue;
    const list = byMood.get(artwork.moodKey) ?? [];
    list.push(numeric);
    byMood.set(artwork.moodKey, list);
  }
  if (byMood.size === 0) return "아직 참고할 판매 데이터가 없습니다.";
  return [...byMood.entries()]
    .map(([mood, prices]) => {
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length / 10000) * 10000;
      return `- ${moodLabel[mood]}: ${prices.map((p) => p.toLocaleString()).join("원, ")}원 (평균 약 ${avg.toLocaleString()}원, 표본 ${prices.length}개)`;
    })
    .join("\n");
}

const TRANSLATION_ENTRY_SCHEMA = {
  type: "OBJECT",
  properties: {
    description: { type: "STRING" },
    snsCaption: { type: "STRING" },
    idealFor: { type: "STRING" },
  },
  required: ["description", "snsCaption", "idealFor"],
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isArtwork: { type: "BOOLEAN" },
    notArtworkReason: { type: "STRING" },
    suggestedMood: { type: "STRING", enum: ["quiet", "warm", "vivid", "delicate"] },
    priceRangeMin: { type: "INTEGER" },
    priceRangeMax: { type: "INTEGER" },
    priceNote: { type: "STRING" },
    translations: {
      type: "OBJECT",
      properties: Object.fromEntries(LANG_CODES.map((code) => [code, TRANSLATION_ENTRY_SCHEMA])),
      required: LANG_CODES,
    },
  },
  required: [
    "isArtwork",
    "notArtworkReason",
    "suggestedMood",
    "priceRangeMin",
    "priceRangeMax",
    "priceNote",
    "translations",
  ],
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Hashing both sides first gives equal-length buffers for timingSafeEqual.
function sameKey(a: string, b: string) {
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

const PREMIUM_MATERIAL_HINTS = ["금박", "가금분", "금분", "자개", "옻칠", "은박", "천연", "수제"];

export async function POST(request: Request) {
  const studioKey = request.headers.get("x-studio-key");
  const expectedKey = process.env.ARTIST_STUDIO_PASSWORD;
  if (!expectedKey || !studioKey || !sameKey(studioKey, expectedKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "gemini_not_configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const imageBase64 = body?.imageBase64;
  const mimeType = body?.mimeType;
  const medium = typeof body?.medium === "string" ? body.medium : "";
  const size = typeof body?.size === "string" ? body.size : "";
  const photoWork = body?.workMedium === "photo";
  const moodKey = typeof body?.moodKey === "string" ? (body.moodKey as MoodKey) : undefined;

  if (typeof imageBase64 !== "string" || !imageBase64 || typeof mimeType !== "string" || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: "missing_image" }, { status: 400 });
  }

  const hasPremiumMaterial = PREMIUM_MATERIAL_HINTS.some((hint) => medium.includes(hint));

  const prompt = `너는 신진 작가의 작품 판매를 돕는 보조 도구다. 원래 한국 전통회화(동양화) 작가를 위해 만들어졌지만, 디지털 일러스트 등 다른 매체의 그림 작가, 그리고 디오라마·조형·공예 같은 입체 작품 작가도 함께 사용한다. 설명을 쓸 때 실제 이미지에 보이는 매체와 스타일을 그대로 반영하고, 동양화라고 단정짓지 마라.
${photoWork ? "이번 요청은 작가가 직접 촬영한 풍경·정물·추상 사진의 실물 한정 에디션이다. 실제 풍경·정물 사진이어도 예술 사진으로 인정하되 실제 사람·동물이 있는 사진은 거절한다. 서명·인화 방식·용지·에디션 수량·판매 권한은 이미지로 확인했다고 쓰지 마라. 가격 근거가 없으면 priceRangeMin/Max를 0으로 쓰고 priceNote에 사진 에디션 참고 시세 없음이라고 표시해라. 이후 회화 호당가격 규칙을 적용하지 마라." : ""}

가장 먼저 판단할 것: 이 이미지가 예술 작품인가? 여기에는 물감으로 그린 회화를 찍은 사진뿐 아니라, 디지털 일러스트, 디지털 페인팅, 드로잉처럼 파일 자체가 원본인 그림, 그리고 디오라마(축소 풍경·장면 모형), 조각, 조형물, 도자·한지·목공 같은 공예품처럼 손으로 만든 입체 작품을 찍은 사진도 전부 포함된다. 실물이든 디지털이든, 평면이든 입체든 "창작된 작품"이면 작품으로 인정해라. 입체 작품은 설명에서 그림이라고 부르지 말고 실제 형태(디오라마, 조형 작품 등)대로 불러라.
- 인물 셀카, ${photoWork ? "실제 사람·반려동물이 찍힌 사진" : "실제 풍경/음식/반려동물 스냅샷(모형이 아닌 진짜 장소·사물)"}, 스크린샷, 문서, 영수증처럼 창작된 그림이 전혀 아닌 사진만 isArtwork를 false로 하고, notArtworkReason에 왜 작품으로 보이지 않는지 한국어 한 문장으로 설명해라. 이 경우 priceRangeMin/priceRangeMax는 0으로, suggestedMood는 "quiet"로, translations의 모든 언어 항목은 전부 빈 문자열로 채워라.
- 그림·일러스트·입체 작품${photoWork ? "·풍경/정물/추상 예술 사진" : ""}이 맞으면(실물이든 디지털이든) isArtwork를 true로 하고 notArtworkReason은 빈 문자열로 두고, 아래 항목을 만들어라.

1. suggestedMood: 이미지의 전체적인 분위기를 quiet(고요한)/warm(따뜻한)/vivid(선명한)/delicate(섬세한) 중 하나로 판단해라. 작가가 직접 지정한 분위기가 있어도, 실제 이미지를 보고 네가 판단한 값을 넣어라 — 이건 참고용 추천이라 작가 지정값과 달라도 된다.
2. priceRangeMin, priceRangeMax: 원화 기준 참고 가격 범위 (정수, 원 단위) — 아래 "가격 산정 방법"을 따라라.
3. priceNote: 이 가격 범위를 어떻게 산정했는지 반드시 한국어로 설명 (작가 본인만 보는 항목이라 번역하지 않는다).
4. translations: 아래 2개 언어(${LANG_CODES.join(", ")}) 전부에 대해 각각 description(구매자에게 보여줄 감성적이고 진솔한 작품 설명, 2~3문장), snsCaption(인스타그램용 짧은 홍보 캡션, 해시태그 2~4개 포함), idealFor(이 작품이 어떤 공간·어떤 성향의 사람에게 어울리는지 한 문장)를 각 언어의 자연스러운 표현으로 작성해라. 기계 번역투가 아니라 그 언어 원어민이 쓸 법한 자연스러운 문장으로 써라. ko 항목이 원본 기준이고, en은 그 내용을 자연스러운 영어로 다시 쓴 것이어야 한다.

작품 정보:
- 재료/기법: ${medium || "정보 없음"}
- 크기: ${size || "정보 없음"}
- 작가가 직접 지정한 분위기: ${moodKey ? moodLabel[moodKey] ?? moodKey : "정보 없음"}

가격 산정 방법 (이 순서로 계산해라):
0. 입체 작품(디오라마·조각·조형·공예)이면 호수제를 쓰지 마라. 대신 크기(가로×세로×깊이), 보이는 세부 묘사의 밀도와 제작 난이도, 재료를 보고 한국 공예·입체 작품 시장의 신진 작가 수준(대략 소품 10만~50만원, 중형 50만~200만원)에서 범위를 잡고, priceNote에 "입체 작품이라 호수 대신 크기와 제작 난이도를 기준으로 잡았다"고 밝혀라. 아래 1~3단계는 평면 작품에만 적용한다.
1. 먼저 크기를 기준으로 한다. 한국 미술시장의 표준 "호수제"(예: 1호 ≈ 22.7×15.8cm, 3호 ≈ 27.3×22.0cm, 6호 ≈ 41.0×31.8cm, 10호 ≈ 53.0×45.5cm, 15호 ≈ 65.1×53.0cm 등)를 기준으로, 주어진 크기(가로×세로cm)에 가장 가까운 호수를 추정해라. 크기 정보가 없으면 이미지 비율로 소품(약 3~6호) 수준으로 가정해라.
2. 무명·신진 작가의 호당 가격은 통상 3만원~10만원 사이로 알려져 있다. 추정한 호수에 이 범위를 곱해 1차 가격대를 계산해라.
3. 재료/기법에 금박, 가금분, 자개, 옻칠, 은박처럼 원가가 높은 고급 재료가 언급되어 있으면(${hasPremiumMaterial ? "이번 작품에는 해당 재료가 감지됨" : "이번 작품에는 해당 없음"}), 1차 가격대에 20~50% 정도를 가산해라. 해당 재료 언급이 없으면 가산하지 마라.
4. 아래 "같은 갤러리 내 실제 판매 데이터"는 최종 가격대가 터무니없이 벗어나지 않는지 확인하는 보조 참고용으로만 사용해라. 표본이 매우 적으므로 이 데이터만으로 가격을 결정하지 마라.

같은 갤러리 내 실제 판매 데이터 (보조 참고용, 표본 적음):
${buildComparables()}

주의사항:
- 가격은 반드시 범위로만 제시하고 단정하지 마라.
- 평면 작품의 priceNote에는 "크기를 기준으로 호수를 추정하고, 무명 작가 평균 호당 가격을 곱했으며(재료가 고급이면 그만큼 가산했다)"는 계산 근거를 담고, 이게 절대적 평가가 아니라 참고용이라는 점과 작가 경력·수상 이력·희소성 등은 반영되지 않았다는 점을 명시해라.
- 가격이 작가의 기대보다 낮게 나올 수 있으니, 작가의 자존감을 해치지 않는 담백한 톤으로 이유를 설명해라. 절대 작품의 예술적 가치를 평가하듯 말하지 마라.
- priceNote와 notArtworkReason은 순수 한국어로만 작성해라. 영어 단어를 한글 문장 사이에 섞어 쓰지 말고 자연스러운 한글로 써라. 이모지는 어디에도 쓰지 마라.`;

  try {
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text().catch(() => "");
      console.error("gemini request failed", geminiResponse.status, errorText);
      return NextResponse.json({ error: "gemini_failed" }, { status: 502 });
    }

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      console.error("gemini empty response", JSON.stringify(data));
      return NextResponse.json({ error: "gemini_empty_response" }, { status: 502 });
    }

    const parsed = JSON.parse(text);
    if (parsed?.isArtwork === false) {
      return NextResponse.json(
        { ok: false, error: "not_artwork", reason: parsed.notArtworkReason || "" },
        { status: 422 },
      );
    }
    if (photoWork) {
      parsed.priceRangeMin = 0;
      parsed.priceRangeMax = 0;
      parsed.priceNote = "사진 한정 에디션의 참고 시세가 없어 가격을 제안하지 않습니다. 인화 방식·크기·에디션 수량과 작가의 판매가를 확인해 주세요.";
    }
    return NextResponse.json({ ok: true, result: parsed });
  } catch (error) {
    console.error("artist tools generation failed", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
