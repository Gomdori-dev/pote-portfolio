// Carry only inquiry context; no arbitrary return URL or personal data.
export function inquiryContext(params: { get(name: string): string | null }): string {
  const query = new URLSearchParams();
  for (const key of ["artwork", "artworks", "intent"] as const) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const draft = params.get("draft");
  if (draft && /^[a-zA-Z0-9-]{1,64}$/.test(draft)) query.set("draft", draft);
  return query.size ? `?${query}` : "";
}
