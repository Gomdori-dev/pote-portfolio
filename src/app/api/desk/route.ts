import { NextResponse } from "next/server";
import { getAllArtworks } from "@/lib/all-artworks";
import { askDeskAI, type DeskTurn } from "@/lib/desk-ai";
import { answerArtworkQuestion } from "@/lib/desk-answer";
import { answerBuyingQuestion } from "@/lib/desk-faq";
import { allow, clientIp } from "@/lib/rate-limit";

// A brake on one visitor hammering the free Gemini quota. The quota itself is
// the hard cap, and past this limit the keyword desk still answers.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 30;

function parseHistory(value: unknown): DeskTurn[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) return null;
  const turns: DeskTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { by, text } = item as Record<string, unknown>;
    if ((by !== "visitor" && by !== "desk") || typeof text !== "string" || text.length > 1200) return null;
    turns.push({ by, text });
  }
  return turns.slice(-8);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 16384) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { question, lang, contextSlug, history: rawHistory } = body as Record<string, unknown>;
  const history = parseHistory(rawHistory);
  if (typeof question !== "string" || !question.trim() || question.length > 200 || (lang !== "ko" && lang !== "en") || (contextSlug !== undefined && (typeof contextSlug !== "string" || contextSlug.length > 100)) || !history) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const quick = contextSlug ? null : answerBuyingQuestion(question.trim(), lang);
  if (quick) return NextResponse.json({ ...quick, ai: false }, { headers: { "Cache-Control": "no-store" } });
  const catalog = await getAllArtworks();
  const ai = allow(`desk:${clientIp(request)}`, PER_WINDOW, WINDOW_MS) ? await askDeskAI({ question: question.trim(), lang, catalog, contextSlug: contextSlug as string | undefined, history }) : null;
  const answer = ai ?? answerArtworkQuestion(question.trim(), lang, catalog, contextSlug as string | undefined);
  return NextResponse.json({ ...answer, ai: !!ai }, { headers: { "Cache-Control": "no-store" } });
}
