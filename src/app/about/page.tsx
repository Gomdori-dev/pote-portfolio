"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { T, type DictKey } from "@/lib/i18n";

const VALUES: { title: DictKey; body: DictKey }[] = [
  { title: "aboutValue1Title", body: "aboutValue1Body" },
  { title: "aboutValue2Title", body: "aboutValue2Body" },
  { title: "aboutValue3Title", body: "aboutValue3Body" },
];

const STEPS: { title: DictKey; body: DictKey }[] = [
  { title: "aboutStep1Title", body: "aboutStep1Body" },
  { title: "aboutStep2Title", body: "aboutStep2Body" },
  { title: "aboutStep3Title", body: "aboutStep3Body" },
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="inner-page about-page">
        <section className="page-intro">
          <p className="eyebrow dark"><T k="aboutEyebrow" /></p>
          <h1><T k="aboutHeading" /></h1>
          <p><T k="aboutIntro" /></p>
        </section>

        <section className="about-name">
          <p className="section-number"><T k="aboutNameLabel" /></p>
          <h2><T k="aboutNameHeading" /></h2>
          <p><T k="aboutNameBody" /></p>
        </section>

        <section className="about-block">
          <p className="section-number"><T k="aboutValuesLabel" /></p>
          <h2><T k="aboutValuesHeading" /></h2>
          <ol className="about-cards">
            {VALUES.map(({ title, body }, index) => (
              <li key={title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3><T k={title} /></h3>
                <p><T k={body} /></p>
              </li>
            ))}
          </ol>
        </section>

        <section className="about-block">
          <p className="section-number"><T k="aboutStepsLabel" /></p>
          <h2><T k="aboutStepsHeading" /></h2>
          <ol className="about-cards about-steps">
            {STEPS.map(({ title, body }, index) => (
              <li key={title}>
                <span aria-hidden="true">STEP {index + 1}</span>
                <h3><T k={title} /></h3>
                <p><T k={body} /></p>
              </li>
            ))}
          </ol>
          <Link className="about-text-link" href="/guide"><T k="aboutGuideLink" /> →</Link>
        </section>

        <section className="about-block about-artists">
          <p className="section-number"><T k="aboutArtistLabel" /></p>
          <h2><T k="aboutArtistHeading" /></h2>
          <p><T k="aboutArtistBody" /></p>
          <Link className="outline-button" href="/apply"><T k="navApply" /></Link>
        </section>

        <section className="guide-contact">
          <h2><T k="aboutContactHeading" /></h2>
          <p><T k="aboutContactBody" /></p>
          <Link className="primary-button" href="/inquiry"><T k="footerInquiry" /></Link>
          <Link className="back-link" href="/artworks">← <T k="menuArtworks" /></Link>
        </section>
      </main>
    </>
  );
}
