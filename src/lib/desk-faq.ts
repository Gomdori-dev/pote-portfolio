import { guideCopy } from "@/lib/guide-copy";
import type { DeskAnswer } from "@/lib/desk-answer";
import type { Lang } from "@/lib/i18n";

const FAQ: { match: RegExp; answer: keyof typeof guideCopy }[] = [
  { match: /무료\s?배송|배송비|운송비|택배비|free shipping|shipping (?:fee|cost)|delivery (?:fee|cost)|how much.*(?:shipping|delivery)/, answer: "guideAShipFee" },
  { match: /해외|국외|international|overseas|outside korea/, answer: "guideAOverseas" },
  { match: /파손|깨졌|훼손|damage|broken/, answer: "guideADamage" },
  { match: /환불|반품|취소|refund|return|cancel/, answer: "guideARefund" },
  { match: /사진.*(?:다르|차이)|실물.*(?:다르|차이)|different from (?:the )?photo/, answer: "guideADiffer" },
  { match: /배송|발송|택배|운송|ship|deliver/, answer: "guideAShip" },
  { match: /액자|프레임|frame/, answer: "guideAFrame" },
  { match: /진품|진위|보증서|정품|certificate|authentic/, answer: "guideAAuth" },
  { match: /할부|분할|나눠서?\s?(?:내|입금|결제|보내)|instal+ment/, answer: "guideASplit" },
  { match: /결제|입금|계좌|카드|구매.*(?:방법|어떻게)|(?:방법|어떻게).*구매|payment|pay|credit card|how.*(?:buy|purchase)/, answer: "guideAPay" },
  { match: /가격.*(?:누가|정하|책정)|가격\s?정책|who sets (?:the )?price/, answer: "guideAPrice" },
];

/** The browser and API answer buying questions from the same published guide. */
export function answerBuyingQuestion(question: string, lang: Lang): DeskAnswer | null {
  // A recommendation mentioning shipping or a frame still needs the catalog.
  if (/추천|어울리|recommend|suggest/.test(question.toLocaleLowerCase())) return null;
  const found = FAQ.find(({ match }) => match.test(question.toLocaleLowerCase()));
  return found ? {
    text: guideCopy[found.answer][lang],
    links: [{ href: "/guide", label: lang === "ko" ? "구매 안내 보기" : "Buying guide" }],
  } : null;
}
