"use client";

import { ArtistIndex } from "@/components/ArtistIndex";
import { ArtistsNavigation } from "@/components/ArtistsNavigation";
import { SiteHeader } from "@/components/SiteHeader";
import { artists, type Artwork } from "@/lib/artists";
import { T, useLanguage } from "@/lib/i18n";

export function ArtistsIndexClient({ artworks }: { artworks: Artwork[] }) {
  const { lang } = useLanguage();

  return <><SiteHeader /><main className="inner-page">
    <header className="page-intro"><p className="eyebrow dark"><T k="artistsIndexEyebrow" /></p><h1><T k="artistsIndexHeading" /></h1><p><T k="artistsIndexIntro" /></p></header>
    <ArtistsNavigation />
    {/* The material line comes off each artist's own work rather than being
        written here, so it stays factual and already translated. */}
    <ArtistIndex entries={[
      { slug: "jihyeseung", portrait: "/artists/jihyeseung/portrait.jpg", name: lang === "ko" ? "지혜승" : "Ji Hye Seung", cover: "/artists/jihyeseung/pomegranate.jpg", coverAlt: "지혜승 — Pomegranate" },
      { slug: "hoohoo", portrait: "/artists/hoohoo/portrait.jpg", name: lang === "ko" ? "후후/HooHoo" : "HooHoo", cover: "/artists/hoohoo/permeare-77.jpg", coverAlt: "후후/HooHoo — Permeare 77" },
      { slug: "haerang", portrait: "/artists/haerang/portrait.jpg", name: "해랑이유미", cover: "/artists/haerang/panic-2.jpg", coverAlt: "해랑이유미 — Panic Ⅱ" },
      { slug: "hedon139", portrait: "/artists/hedon139/portrait.jpg", name: artists.hedon139.name[lang], cover: "/artists/hedon139/luxuria-2.jpg", coverAlt: "Hedon139 — Seven Hevils: Luxuria 2" },
      { slug: "kyunghoonmin", portrait: "/artists/kyunghoonmin/portrait.jpg", name: artists.kyunghoonmin.name[lang], cover: "/artists/kyunghoonmin/traces-of-time-1.jpg", coverAlt: "민경훈 — Traces of time" },
      { slug: "seunghojang", portrait: "/artists/seunghojang/portrait.jpg", name: artists.seunghojang.name[lang], cover: "/artists/seunghojang/see1277.jpg", coverAlt: "장승호 — see1277" },
      { slug: "eunyeollee", portrait: "/artists/eunyeollee/portrait.jpg", name: artists.eunyeollee.name[lang], cover: "/artists/eunyeollee/portrait.jpg", coverAlt: artists.eunyeollee.name[lang] },
      { slug: "luxx", portrait: "/artists/luxx/portrait.jpg", name: artists.luxx.name[lang], cover: "/artists/luxx/portrait.jpg", coverAlt: artists.luxx.name[lang] },
      { slug: "myungheejung", portrait: "/artists/myungheejung/portrait.jpg", name: artists.myungheejung.name[lang], cover: "/artists/myungheejung/portrait.jpg", coverAlt: artists.myungheejung.name[lang] },
      { slug: "yulhwi", portrait: "/artists/yulhwi/portrait.jpg", name: artists.yulhwi.name[lang], cover: "/artists/yulhwi/portrait.jpg", coverAlt: artists.yulhwi.name[lang] },
      { slug: "pita", portrait: "/artists/pita/portrait.jpg", name: artists.pita.name[lang], cover: "/artists/pita/portrait.jpg", coverAlt: artists.pita.name[lang] },
      { slug: "cheongunsim", portrait: "/artists/cheongunsim/portrait.jpg", name: artists.cheongunsim.name[lang], cover: "/artists/cheongunsim/portrait.jpg", coverAlt: artists.cheongunsim.name[lang] },
      { slug: "woon", portrait: "/artists/woon/portrait.jpg", name: artists.woon.name[lang], cover: "/artists/woon/portrait.jpg", coverAlt: artists.woon.name[lang] },
      { slug: "qiuchichen", portrait: "/artists/qiuchichen/portrait.jpg", name: artists.qiuchichen.name[lang], cover: "/artists/qiuchichen/portrait.jpg", coverAlt: artists.qiuchichen.name[lang] },
      { slug: "jaeheeyoon", portrait: "/artists/jaeheeyoon/portrait.jpg", name: artists.jaeheeyoon.name[lang], cover: "/artists/jaeheeyoon/portrait.jpg", coverAlt: artists.jaeheeyoon.name[lang] },
      { slug: "sunsookhur", portrait: "/artists/sunsookhur/portrait.jpg", name: artists.sunsookhur.name[lang], cover: "/artists/sunsookhur/portrait.jpg", coverAlt: artists.sunsookhur.name[lang] },
      { slug: "hyunkilee", portrait: "/artists/hyunkilee/portrait.jpg", name: artists.hyunkilee.name[lang], cover: "/artists/hyunkilee/portrait.jpg", coverAlt: artists.hyunkilee.name[lang] },
      { slug: "jihunchoi", portrait: "/artists/jihunchoi/portrait.jpg", name: artists.jihunchoi.name[lang], cover: "/artists/jihunchoi/portrait.jpg", coverAlt: artists.jihunchoi.name[lang] },
      { slug: "wonsikjeong", portrait: "/artists/wonsikjeong/portrait.jpg", name: artists.wonsikjeong.name[lang], cover: "/artists/wonsikjeong/portrait.jpg", coverAlt: artists.wonsikjeong.name[lang] },
    ].map((entry) => {
      const mine = artworks.filter((artwork) => artwork.artistSlug === entry.slug);
      return { ...entry, works: mine.length, medium: (mine[0]?.[lang].details ?? "").split("·")[0].trim() };
    })} />
  </main></>;
}
