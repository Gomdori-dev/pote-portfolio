import { artists, type Artwork } from "@/lib/artworks";
import { safeArtworkHref } from "@/lib/artwork-route";
import type { Lang } from "@/lib/i18n";

export type DeskLink = { href: string; label: string };
export type DeskAnswer = { text: string; links: DeskLink[] };

const compact = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Who runs Pote — the owner chose to be named (2026-09-27). Shared with the AI curator's knowledge. */
export const ABOUT_POTE: Record<Lang, string> = {
  ko: "포트 갤러리는 김지현 대표가 직접 운영하는 온라인 갤러리예요. 신진 작가의 원화를 소개하고 구매자와 작가를 이어 드려요.",
  en: "Pote Gallery is run by its founder, Jihyun Kim. It introduces emerging artists' original works and connects buyers directly with the artists.",
};
/** The owner-confirmed name origin; shared by the AI curator and its fallback. */
export const POTE_NAME_ORIGIN: Record<Lang, string> = {
  ko: "Pote는 프랑스어로 ‘단짝 친구’라는 뜻이에요. Pote의 소리가 한글로 ‘뽀또’, ‘뽀뜨’, ‘포트’처럼 들릴 수 있어서 포트 갤러리라고 지었어요. 항구라는 뜻에서 지은 이름은 아니에요.",
  en: "Pote is French slang for a close friend or buddy. Its sound can be rendered in Korean like ‘뽀또’, ‘뽀뜨’ or ‘포트’, which inspired the name 포트 갤러리 (Pote Gallery). The name was not chosen to mean a harbor.",
};
const ABOUT_QUESTION = /대표(?!\s?작)|운영자|운영하는\s?사람|사장님?|주인|누가\s?운영|founder|owner|who\s+(?:runs|owns|started)\s+(?:pote|this\s+(?:site|gallery))|ceo/i;
const ORIGIN_QUESTION = /(?:이름|name).{0,12}(?:뜻|의미|유래|mean|meaning|origin)|(?:뜻|의미|유래).{0,12}(?:포트|pote)|왜.{0,12}(?:포트|pote)|(?:why|origin).{0,24}(?:pote|port\s+gallery)/i;

/** Only public catalog fields are used. Never infer popularity, availability, or a missing price. */
export function answerArtworkQuestion(question: string, lang: Lang, catalog: Artwork[], contextSlug?: string): DeskAnswer {
  if (ORIGIN_QUESTION.test(question)) return { text: POTE_NAME_ORIGIN[lang], links: [] };
  if (ABOUT_QUESTION.test(question)) return { text: ABOUT_POTE[lang], links: [] };
  const q = compact(question);
  const matches = catalog.filter((work) => {
    const title = compact(work[lang].title);
    const alternate = compact(work[lang === "ko" ? "en" : "ko"].title);
    return (title.length >= 2 && q.includes(title)) || (alternate.length >= 2 && q.includes(alternate));
  });

  // Prefer a fully named work over a shorter title embedded inside it.
  const longest = Math.max(0, ...matches.map((work) => compact(work[lang].title).length));
  const named = matches.filter((work) => compact(work[lang].title).length === longest);
  const context = catalog.find((work) => work.slug === contextSlug);
  const contextual = context && /이\s?(?:그림|작품)|현재\s?작품|this\s?(?:work|artwork)|가격|크기|재료|작가|구매|판매|설명|price|size|material|artist|available/i.test(question);
  const work = named.length === 1 ? named[0] : named.length === 0 && contextual ? context : undefined;

  if (named.length > 1) {
    return {
      text: lang === "ko" ? "같은 이름의 작품이 여러 점 있어요. 아래에서 작품을 골라 확인해 주세요." : "Several works match that name. Choose one below to see its details.",
      links: named.slice(0, 4).map((item) => ({ href: safeArtworkHref(item), label: `${artists[item.artistSlug].name[lang]} · ${item[lang].title}` })),
    };
  }

  if (work) {
    const title = work[lang].title;
    const details = work[lang].details;
    const price = work.price;
    const sold = work.statusKey === "sold";
    const wantsPrice = /가격|얼마|금액|price|cost|how much/i.test(question);
    const wantsSize = /크기|사이즈|규격|재료|기법|연도|size|dimension|material|year/i.test(question);
    const wantsStatus = /구매|판매|가능|품절|상태|buy|available|sold/i.test(question);
    const wantsArtist = /작가|그린\s?사람|누가\s?그렸|artist|who (?:made|painted|created)/i.test(question);
    let text: string;
    if (wantsPrice) {
      text = sold
        ? lang === "ko" ? `「${title}」은 판매 완료된 작품이에요.` : `“${title}” has been sold.`
        : price ? lang === "ko" ? `「${title}」의 표시 가격은 ${price}입니다. 배송비는 별도이며, 구매 전 문의에서 작품 상태와 배송을 확인해 드립니다.` : `The listed price for “${title}” is ${price}. Shipping is separate; please inquire to confirm the work and delivery.`
        : lang === "ko" ? `「${title}」의 가격은 현재 공개된 정보에 없어요. 문의로 확인해 주세요.` : `A price for “${title}” is not currently published. Please ask through the inquiry form.`;
    } else if (wantsArtist) {
      const artist = artists[work.artistSlug];
      text = lang === "ko" ? `「${title}」의 작가는 ${artist.name.ko}입니다.` : `“${title}” is by ${artist.name.en}.`;
    } else if (wantsSize) {
      text = lang === "ko" ? `「${title}」의 등록 정보는 ${details}입니다.` : `The listed details for “${title}” are: ${details}.`;
    } else if (wantsStatus) {
      text = lang === "ko" ? `「${title}」의 현재 표시 상태는 ‘${work.ko.status}’입니다. 실제 구매 가능 여부는 문의 후 확인해 드립니다.` : `“${title}” is listed as “${work.en.status}”. Please inquire to confirm current availability.`;
    } else {
      text = `${title}: ${work[lang].description} ${details}`;
    }
    const links = [{ href: safeArtworkHref(work), label: lang === "ko" ? "작품 상세 보기" : "View artwork" }];
    if (wantsArtist) links.push({ href: `/artists/${work.artistSlug}`, label: lang === "ko" ? "작가 소개 보기" : "View artist" });
    if (!sold) links.push({ href: `/inquiry?artwork=${encodeURIComponent(work.slug)}`, label: lang === "ko" ? "이 작품 문의하기" : "Ask about this work" });
    return { text, links };
  }

  const artist = Object.values(artists).find((item) => {
    const ko = compact(item.name.ko);
    const en = compact(item.name.en);
    return (ko.length >= 2 && q.includes(ko)) || (en.length >= 2 && q.includes(en));
  });
  if (artist) {
    return {
      text: lang === "ko" ? `${artist.name.ko} 작가의 소개와 공개 작품을 작가 페이지에서 볼 수 있어요.` : `You can see ${artist.name.en}'s profile and published works on their artist page.`,
      links: [{ href: `/artists/${artist.slug}`, label: lang === "ko" ? "작가 페이지 보기" : "View artist" }],
    };
  }

  return {
    text: lang === "ko" ? "질문과 일치하는 공개 작품 정보를 찾지 못했어요. 작품 목록에서 찾아보거나 문의로 남겨 주세요." : "I couldn't find matching information in the published works. Please browse the catalog or send an inquiry.",
    links: [{ href: "/artworks", label: lang === "ko" ? "작품 목록" : "Browse works" }, { href: "/inquiry", label: lang === "ko" ? "직접 문의" : "Send an inquiry" }],
  };
}
