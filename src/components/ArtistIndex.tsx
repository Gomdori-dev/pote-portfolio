"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type IndexEntry = {
  slug: string;
  name: string;
  /** The artist's own material line, taken from their work so it stays factual. */
  medium: string;
  works: number;
  /** Their photograph, used with permission. Falls back to the work when an
   *  artist has not given one, so the page never waits on a missing file. */
  portrait?: string;
  /** Left out when the artist has sent no picture yet: the preview shows their name instead. */
  cover?: string;
  coverAlt: string;
};

/**
 * 작가 이야기 as an exhibition catalogue index: a line per artist, and whoever
 * you are on shown large beside it.
 *
 * The portrait, not the work: this page is about the people, which is what
 * separates it from /artworks — their work is one click away on their own
 * page. Every photograph here is published with that artist's permission. An
 * artist who has not given one falls back to a piece of their work.
 *
 * Every entry stays a link, so the row is a plain anchor and hovering only
 * changes which picture is shown — nothing here depends on JavaScript to be
 * reachable. The preview is a stack of images with one made visible rather than
 * a single swapped `src`, so moving down the list cross-fades instead of
 * flashing an empty box while the next file loads.
 */
export function ArtistIndex({ entries }: { entries: IndexEntry[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="artist-index">
      <ol className="artist-index-list">
        {entries.map((entry, i) => (
          <li key={entry.slug}>
            <Link
              className="artist-index-row"
              data-active={i === active}
              href={`/artists/${entry.slug}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
            >
              {/* A mark, not a number. "01, 02, 03" reads as a ranking to anyone
                  who does not know the site, and Pote does not rank its artists
                  (PRODUCT_BRIEF.md) — the same reason the catalogue sort is
                  called 오늘의 순서 and not 추천순. */}
              <span className="artist-index-mark" aria-hidden="true">◆</span>
              <span className="artist-index-rule" aria-hidden="true" />
              <span className="artist-index-name">{entry.name}</span>
              <span className="artist-index-medium">{entry.medium}</span>
              <span className="artist-index-count">{entry.works}</span>
              {/* Phone layout only: the list has no room for a preview beside it. */}
              <span className="artist-index-thumb" aria-hidden="true">
                {entry.portrait ?? entry.cover ? <Image src={(entry.portrait ?? entry.cover)!} alt="" fill sizes="80px" /> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="artist-index-preview" aria-hidden="true">
        {entries.map((entry, i) => (
          <span className="artist-index-plate" data-portrait={!!entry.portrait} data-shown={i === active} key={entry.slug}>
            {/* Eager, not lazy: the plate behind this one is hidden, and a lazy image
                  would not start loading until it was revealed — so the first hover
                  onto each artist would blank before it cross-faded. Four portraits
                  at roughly 200KB each is a fair price for that not happening. */}
            {entry.portrait ?? entry.cover
              ? <Image src={(entry.portrait ?? entry.cover)!} alt={entry.coverAlt} fill loading="eager" sizes="(max-width:900px) 0px, 40vw" />
              : <span className="artist-index-plate-name">{entry.name}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
