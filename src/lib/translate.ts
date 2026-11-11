const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type BilingualFields = { title: string; description: string; details: string; palette: string; condition?: string };

export class ArtworkTranslationError extends Error {
  constructor() {
    super("Artwork translation is unavailable");
    this.name = "ArtworkTranslationError";
  }
}

export function isTranslationMissing(source: string, translated: unknown, target: "ko" | "en" = "en"): boolean {
  if (!source.trim()) return false;
  return typeof translated !== "string" || !translated.trim() || (target === "en" && /[\u1100-\u11ff\u3130-\u318f가-힣]/.test(translated));
}

function preserveStructuredDetails(source: string, translated: string, target: "ko" | "en"): string {
  const parts = source.split(/\s*·\s*/);
  if (parts.length !== 3 || !/^\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*cm$/i.test(parts[1])) return translated;
  const sizeInTranslation = translated.match(/\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*cm/i);
  const material = (sizeInTranslation ? translated.slice(0, sizeInTranslation.index) : translated.split(/[·,]/)[0])
    .replace(/[\s·,;:]+$/g, "").trim();
  const year = /^(?:미상|unknown)$/i.test(parts[2]) ? (target === "ko" ? "미상" : "Unknown") : parts[2];
  return material ? `${material} · ${parts[1]} · ${year}` : translated;
}

/** Translate the artist's chosen input language into the other site language. */
async function translateFields(input: BilingualFields, target: "ko" | "en"): Promise<BilingualFields> {
  if (!process.env.GEMINI_API_KEY) {
    throw new ArtworkTranslationError();
  }

  // A "소품" (small piece) submission through /artist-portal may skip the
  // description entirely (see its "소품" checkbox) — don't ask Gemini to
  // translate a field that isn't there, since a schema that requires
  // `description` back would force the model to invent one from nothing,
  // which is exactly what the prompt below tells it not to do.
  const hasDescription = input.description.trim().length > 0;
  const hasPalette = input.palette.trim().length > 0;
  const hasCondition = Boolean(input.condition?.trim());

  const prompt = target === "en"
    ? `다음은 신진 작가가 직접 쓴 작품 정보(한국어)다. 자연스러운 영어로 번역해라. 원문의 의미를 바꾸지 말고 없는 내용을 추가하지 마라. 숫자, cm 단위, 크기 표기와 제작 연도는 그대로 유지해라.`
    : `The following artwork information was written by the artist in English. Translate it into natural Korean. Preserve the artist's meaning without adding facts. Keep all numbers, cm units, dimensions, and the year unchanged.`;

  const content = `${hasCondition ? `Condition report (translate exactly, preserve every defect and repair): ${input.condition}\n` : ""}${target === "en" ? "제목" : "Title"}: ${input.title}
${hasDescription ? `${target === "en" ? "설명" : "Description"}: ${input.description}\n` : ""}${target === "en" ? "재료·크기·연도" : "Medium · size · year"}: ${input.details}${hasPalette ? `
${target === "en" ? "주요 색상(쉼표로 구분, 같은 순서·같은 개수로 짧은 색 이름만)" : "Main colours (comma-separated, same order and count, short colour names only)"}: ${input.palette}` : ""}`;

  // Gemini sometimes answers 429/503 for a moment; one retry keeps an
  // approved work from going live with Korean in its English fields.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\n${content}` }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                ...(hasDescription ? { description: { type: "STRING" } } : {}),
                details: { type: "STRING" },
                ...(hasPalette ? { palette: { type: "STRING" } } : {}),
                ...(hasCondition ? { condition: { type: "STRING" } } : {}),
              },
              required: ["title", "details", ...(hasDescription ? ["description"] : []), ...(hasPalette ? ["palette"] : []), ...(hasCondition ? ["condition"] : [])],
            },
            maxOutputTokens: 2048,
          },
        }),
      });
      if (!response.ok) throw new Error(`gemini responded ${response.status}`);
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") throw new Error("empty gemini response");
      const parsed = JSON.parse(text);
      if (["title", "details", ...(hasDescription ? ["description"] : []), ...(hasPalette ? ["palette"] : []), ...(hasCondition ? ["condition"] : [])]
        .some((key) => isTranslationMissing(input[key as keyof BilingualFields] ?? "", parsed?.[key], target))) {
        throw new Error("incomplete translation");
      }
      if (hasCondition && (typeof parsed.condition !== "string" || !parsed.condition.trim())) throw new Error("incomplete condition translation");
      return { title: parsed.title, description: hasDescription ? parsed.description : "", details: preserveStructuredDetails(input.details, parsed.details, target), palette: hasPalette ? parsed.palette : "", ...(hasCondition ? { condition: parsed.condition } : {}) };
    } catch (error) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      console.error(`translate to ${target} failed`, error instanceof Error ? error.name : "unknown error");
      throw new ArtworkTranslationError();
    }
  }
  throw new ArtworkTranslationError();
}

export const translateToEnglish = (ko: BilingualFields) => translateFields(ko, "en");
export const translateToKorean = (en: BilingualFields) => translateFields(en, "ko");
