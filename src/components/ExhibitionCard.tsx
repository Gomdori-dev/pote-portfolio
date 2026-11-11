"use client";

import { useState } from "react";
import type { Exhibition } from "@/lib/exhibitions";
import { T, useT } from "@/lib/i18n";

export function ExhibitionCard({ exhibition }: { exhibition: Exhibition }) {
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);
  // The poster is the link now, instead of a "전시 홈페이지 보기" line under the
  // card: people click the picture anyway, and the line was one more thing to
  // read on a card that is already dense. Cards without a URL stay plain, so a
  // poster is only clickable when there is somewhere for it to go.
  const Frame = exhibition.bookingUrl ? "a" : "div";
  const frameProps = exhibition.bookingUrl
    ? { href: exhibition.bookingUrl, target: "_blank", rel: "noreferrer", "aria-label": `${exhibition.title} — ${t("exhibitionLinkLabel")}` }
    : {};
  return (
    <article className="exhibition-card">
      {exhibition.image && !imageFailed ? (
        <Frame className="exhibition-card-image is-linked" {...frameProps}>
          {/* eslint-disable-next-line @next/next/no-img-element -- images come from many different, unpredictable government/museum domains across the KCISA feed, so a fixed next/image remotePatterns allowlist isn't practical here */}
          <img alt="" loading="lazy" onError={() => setImageFailed(true)} src={exhibition.image} />
        </Frame>
      ) : (
        <Frame className="exhibition-card-image is-placeholder is-linked" {...frameProps}>
          <span className="brand placeholder-mark" aria-hidden="true"><span className="brand-text">P</span><span className="brand-dot">.</span></span>
          <small><T k="exhibitionImageMissing" /></small>
        </Frame>
      )}
      <p className="exhibition-card-meta">{[exhibition.institution, exhibition.genre].filter(Boolean).join(" · ")}</p>
      <h3>{exhibition.title}</h3>
      {exhibition.description ? <p className="exhibition-card-description">{exhibition.description}</p> : null}
      <p className="exhibition-card-detail">
        {t("exhibitionPeriodLabel")} {exhibition.startDate}
        {exhibition.endDate && exhibition.endDate !== exhibition.startDate ? ` – ${exhibition.endDate}` : ""}
      </p>
      <p className="exhibition-card-detail">{[exhibition.location, exhibition.fee].filter(Boolean).join(" · ")}</p>
    </article>
  );
}
