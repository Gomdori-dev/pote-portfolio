"use client";

import type { ImageLoaderProps } from "next/image";

/** Serve resized copies even when Vercel's image-optimization allowance is exhausted. */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  return `/api/display-image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
