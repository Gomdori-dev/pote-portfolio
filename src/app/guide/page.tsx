"use client";

import Link from "next/link";
import { Suspense } from "react";
import { GuideInquiryLinks } from "./GuideInquiryLinks";
import { SiteHeader } from "@/components/SiteHeader";
import { T, type DictKey } from "@/lib/i18n";

const QA: { q: DictKey; a: DictKey }[] = [
  { q: "guideQPay", a: "guideAPay" },
  { q: "guideQSplit", a: "guideASplit" },
  { q: "guideQShip", a: "guideAShip" },
  { q: "guideQOverseas", a: "guideAOverseas" },
  { q: "guideQShipFee", a: "guideAShipFee" },
  { q: "guideQFrame", a: "guideAFrame" },
  { q: "guideQAuth", a: "guideAAuth" },
  { q: "guideQRefund", a: "guideARefund" },
  { q: "guideQDiffer", a: "guideADiffer" },
  { q: "guideQDamage", a: "guideADamage" },
  { q: "guideQPrice", a: "guideAPrice" },
];

const LEGAL: DictKey[] = ["guideLegal1", "guideLegal2", "guideLegal3"];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="inner-page guide-page">
        <section className="page-intro compact">
          <p className="eyebrow dark"><T k="guideEyebrow" /></p>
          <h1><T k="guideHeading" /></h1>
          <p><T k="guideIntro" /></p>
          <Suspense fallback={null}><GuideInquiryLinks /></Suspense>
        </section>

        <dl className="guide-qa">
          {QA.map(({ q, a }) => (
            <div key={q}>
              <dt><T k={q} /></dt>
              <dd><T k={a} /></dd>
            </div>
          ))}
        </dl>

        <section className="guide-legal">
          <h2><T k="guideLegalHeading" /></h2>
          <ul>
            {LEGAL.map((k) => <li key={k}><T k={k} /></li>)}
          </ul>
        </section>

        <section className="guide-contact">
          <h2><T k="guideContactHeading" /></h2>
          <p><T k="guideContactBody" /></p>
          <Suspense fallback={<Link className="primary-button" href="/inquiry"><T k="footerInquiry" /></Link>}><GuideInquiryLinks /></Suspense>
        </section>
      </main>
    </>
  );
}
