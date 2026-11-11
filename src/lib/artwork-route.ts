/** Normalize external IDs before handing a single path segment to Next Link. */
export function safeArtworkHref(source: { slug?: unknown; id?: unknown } | null | undefined): string {
  const parse = (value: unknown, depth = 0): string | null => {
    if (depth > 2) return null;
    if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
    if (typeof value === "string") {
      const id = value.trim();
      return /^[\p{L}\p{N}_-]+$/u.test(id) ? id : null;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const item = value as { slug?: unknown; id?: unknown };
      return parse(item.slug, depth + 1) ?? parse(item.id, depth + 1);
    }
    return null;
  };
  const id = parse(source?.slug) ?? parse(source?.id);
  return id === null ? "/artworks" : `/artworks/${encodeURIComponent(id)}`;
}
