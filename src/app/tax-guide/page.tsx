"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useLanguage } from "@/lib/i18n";

// Artist tax guide, promised on Threads (2026-09-22). Every answer is a
// general rule taken from the statute or an NTS ruling and carries its source,
// so nothing here reads as advice for a specific artist. Checked 2026-09-23;
// re-check the expense rates every May when 홈택스 publishes the new year.
//
// Copy lives here rather than in i18n.tsx's dict because it is long,
// page-specific and has citations attached to each answer.
type L = { ko: string; en: string };
const ASOF: L = { ko: "2026년 9월 23일 기준", en: "As of 23 September 2026" };

const INTRO: L = {
  ko: "포트 갤러리에서 작품이 팔리면 대금은 작가님 계좌로 바로 들어가고, 그 돈은 작가님의 소득입니다. 아래 내용은 법령과 국세청 자료에 나와 있는 일반적인 기준을 정리한 것입니다. 작가님 개인 상황에 대한 세무 판단은 아니므로, 헷갈리면 맨 아래 무료 상담 창구에 꼭 물어보세요.",
  en: "When a work sells through Pote Gallery, the money goes straight to your account and it is your income. Below are the general rules as set out in Korean tax law and National Tax Service (NTS) material. This is not advice on your own situation — if in doubt, use the free help lines at the bottom.",
};

const QA: { q: L; a: L; src: string }[] = [
  {
    q: { ko: "작품을 팔면 어떤 소득이 되나요?", en: "What kind of income is it?" },
    a: {
      ko: "작가가 자기 작품을 계속·반복해서 판매하면 국세청 해석상 사업소득입니다(업종코드 940200 '화가 및 관련예술가'). 가끔 한 번 창작 대가를 받는 정도라면 기타소득이 될 수도 있습니다. 몇 점, 얼마부터라는 숫자 기준은 법에 없고 실제 활동을 보고 판단합니다.",
      en: "If you sell your own work on a continuing, repeated basis, the NTS treats it as business income (industry code 940200, painters and related artists). An occasional one-off payment for a creative work can instead be 'other income'. The law sets no count or amount threshold — it depends on the facts.",
    },
    src: "국세청 사전-2021-법규소득-1877 · 소득세법 제19조①, 제21조①15호",
  },
  {
    q: { ko: "'서화 양도 기타소득' 규정이 적용되나요?", en: "Does the artwork-transfer 'other income' rule apply?" },
    a: {
      ko: "한 점 6천만 원 이상 서화를 팔 때 적용되는 기타소득 규정은, 판매일 현재 살아 있는 국내 작가의 작품을 대상에서 뺍니다. 그래서 작가 본인이 자기 작품을 파는 경우에는 보통 해당하지 않습니다.",
      en: "The rule taxing sales of artworks worth ₩60 million or more as 'other income' excludes works by domestic artists who are alive on the date of sale, so it normally does not apply to artists selling their own work.",
    },
    src: "소득세법 제21조② · 소득세법 시행령 제41조⑭",
  },
  {
    q: { ko: "부가가치세를 내야 하나요?", en: "Do I charge VAT?" },
    a: {
      ko: "미술 창작품은 부가가치세가 면제됩니다. 골동품은 면세 대상에서 빠집니다.",
      en: "Original works of art are exempt from VAT. Antiques are not covered by the exemption.",
    },
    src: "부가가치세법 제26조①16호 · 부가가치세법 시행령 제43조",
  },
  {
    q: { ko: "사업자등록을 해야 하나요?", en: "Do I need to register as a business?" },
    a: {
      ko: "판매가 사업소득에 해당하면 소득세법상 사업자등록(면세사업자) 대상입니다. 본인이 해당하는지는 국세상담센터 126에 먼저 물어보는 것이 가장 정확합니다. 면세사업자로 등록하면 매년 2월 10일까지 전년도 수입을 신고하는 사업장현황신고를 합니다.",
      en: "If your sales count as business income, the Income Tax Act requires business registration (as a VAT-exempt business). Call the NTS line 126 to check whether that applies to you. Registered exempt businesses file a business status report by 10 February each year.",
    },
    src: "소득세법 제168조① · 제78조①",
  },
  {
    q: { ko: "언제, 어떻게 신고하나요?", en: "When and how do I file?" },
    a: {
      ko: "종합소득세는 다음 해 5월 1일부터 31일까지 홈택스에서 신고합니다. 참고로 업종코드 940200의 2025년 귀속 경비율은 단순경비율 68%, 기준경비율 16.6%입니다. 어떤 경비율을 쓸 수 있는지는 수입 금액에 따라 달라지니 홈택스에서 확인하세요.",
      en: "Comprehensive income tax is filed on 홈택스 (Hometax) from 1 to 31 May of the following year. For code 940200, the 2025 expense rates are 68% (simple rate) and 16.6% (standard rate); which one you may use depends on your revenue — check on Hometax.",
    },
    src: "소득세법 제70조① · 홈택스 기준·단순경비율 조회(940200, 2025 귀속)",
  },
  {
    q: { ko: "포트 갤러리에 보낸 10%는 비용으로 인정되나요?", en: "Is the 10% I pay Pote Gallery a deductible expense?" },
    a: {
      ko: "판매를 위해 쓴 통상적인 비용은 필요경비가 될 수 있다는 것이 일반 원칙입니다. 수수료를 보낸 이체 내역과 판매 기록을 5년 동안 보관해 두세요. 개별 인정 여부는 상담 창구에서 확인하시길 권합니다.",
      en: "As a general rule, ordinary costs incurred to make a sale can be necessary expenses. Keep the transfer record of the fee and your sale records for five years, and confirm your own case with a help line.",
    },
    src: "소득세법 제27조① · 제160조의2",
  },
  {
    q: { ko: "포트 갤러리가 세금을 떼나요?", en: "Does Pote Gallery withhold tax?" },
    a: {
      ko: "아니요. 원천징수는 소득을 지급하는 사람이 하는데, 포트 갤러리는 판매 대금을 받거나 전달하지 않습니다. 구매자가 작가님께 직접 입금합니다.",
      en: "No. Withholding is done by whoever pays the income, and Pote Gallery never receives or passes on the sale price — the buyer pays you directly.",
    },
    src: "소득세법 제127조①",
  },
];

const PROVIDE: L = {
  ko: "작품이 팔리면 포트 갤러리가 판매일, 작품, 판매 금액, 배송 기록을 정리해서 작가님께 드립니다. 신고할 때 근거 자료로 쓰세요.",
  en: "When a work sells, Pote Gallery sends you a record of the sale date, the work, the price and the delivery, for your filing.",
};

const HELP: { name: L; detail: L; href?: string }[] = [
  { name: { ko: "국세상담센터 126", en: "NTS help line 126" }, detail: { ko: "국번 없이 126 · 평일 9~18시 · 무료", en: "Dial 126 · weekdays 9:00–18:00 · free" } },
  { name: { ko: "마을세무사", en: "Village tax advisers (마을세무사)" }, detail: { ko: "행정안전부가 연결하는 무료 세무 상담", en: "Free tax advice arranged by the Ministry of the Interior" }, href: "https://www.mois.go.kr/frt/sub/a06/b07/villagetax/screen.do" },
  { name: { ko: "홈택스", en: "Hometax" }, detail: { ko: "경비율 조회, 사업자등록, 신고", en: "Expense rates, registration and filing" }, href: "https://hometax.go.kr" },
];

const T = {
  eyebrow: { ko: "ARTIST TAX GUIDE", en: "ARTIST TAX GUIDE" },
  heading: { ko: "작가 세금 안내", en: "Tax guide for artists" },
  source: { ko: "근거", en: "Source" },
  provideHeading: { ko: "포트 갤러리가 드리는 것", en: "What we give you" },
  helpHeading: { ko: "무료로 물어볼 수 있는 곳", en: "Free help" },
  disclaimer: { ko: "이 페이지는 일반적인 안내이며 세무 자문이 아닙니다. 법령은 바뀔 수 있으니 신고 전에 홈택스와 상담 창구에서 최신 내용을 확인하세요.", en: "This page is general information, not tax advice. Rules change — check Hometax or a help line before you file." },
  back: { ko: "참여 조건 보기", en: "See the terms" },
} satisfies Record<string, L>;

export default function TaxGuidePage() {
  const { lang } = useLanguage();
  return (
    <>
      <SiteHeader />
      <main className="inner-page guide-page tax-guide-page">
        <section className="page-intro compact">
          <p className="eyebrow dark">{T.eyebrow[lang]}</p>
          <h1>{T.heading[lang]}</h1>
          <p>{INTRO[lang]}</p>
          <p className="tax-asof">{ASOF[lang]}</p>
        </section>

        <dl className="guide-qa">
          {QA.map(({ q, a, src }) => (
            <div key={q.ko}>
              <dt>{q[lang]}</dt>
              <dd>{a[lang]}<small className="tax-source">{T.source[lang]} · {src}</small></dd>
            </div>
          ))}
        </dl>

        <section className="guide-legal">
          <h2>{T.provideHeading[lang]}</h2>
          <ul><li>{PROVIDE[lang]}</li></ul>
        </section>

        <section className="guide-legal">
          <h2>{T.helpHeading[lang]}</h2>
          <ul>
            {HELP.map(({ name, detail, href }) => (
              <li key={name.ko}>
                {href ? <a href={href} target="_blank" rel="noreferrer"><strong>{name[lang]}</strong> ↗</a> : <strong>{name[lang]}</strong>}
                <br />{detail[lang]}
              </li>
            ))}
          </ul>
        </section>

        <section className="guide-contact">
          <p className="tax-disclaimer">{T.disclaimer[lang]}</p>
          <Link className="back-link" href="/apply">← {T.back[lang]}</Link>
        </section>
      </main>
    </>
  );
}
