import type { Artwork, MoodKey } from "./artworks";

export type ReasonKey = "color" | "texture" | "form" | "story";
export type TasteSession = {
  version: 2;
  slugs: string[];
  step: number;
  choices: MoodKey[];
  reasons: ReasonKey[];
  choosingReason: boolean;
};

// Round-robin across shuffled artist pools so catalog size cannot give one
// artist more slots. Within a pool, prefer the least-seen mood.
export function createTasteSession(works: Artwork[], random = Math.random): TasteSession {
  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const pools = new Map<string, Artwork[]>();
  for (const work of shuffle(works)) {
    if (!pools.has(work.artistSlug)) pools.set(work.artistSlug, []);
    pools.get(work.artistSlug)!.push(work);
  }
  const queues = shuffle([...pools.values()]);
  const scores: Record<MoodKey, number> = { quiet: 0, warm: 0, vivid: 0, delicate: 0 };
  const slugs: string[] = [];
  const limit = Math.min(12, works.length);
  while (slugs.length < limit) {
    for (const queue of queues) {
      if (!queue.length || slugs.length >= limit) continue;
      const least = Math.min(...queue.map((work) => scores[work.moodKey]));
      const index = queue.findIndex((work) => scores[work.moodKey] === least);
      const [work] = queue.splice(index, 1);
      slugs.push(work.slug);
      scores[work.moodKey]++;
    }
  }
  return { version: 2, slugs, step: 0, choices: [], reasons: [], choosingReason: false };
}

export function restoreTasteSession(raw: string | null, works: Artwork[]): TasteSession | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as TasteSession;
    const known = new Set(works.map((work) => work.slug));
    if (saved?.version !== 2 || !Array.isArray(saved.slugs)
      || saved.slugs.length !== Math.min(12, works.length)
      || new Set(saved.slugs).size !== saved.slugs.length
      || !saved.slugs.every((slug) => known.has(slug))
      || !Number.isInteger(saved.step) || saved.step < 0 || saved.step > saved.slugs.length
      || typeof saved.choosingReason !== "boolean"
      || (saved.choosingReason && saved.step === saved.slugs.length)
      || !Array.isArray(saved.choices) || !saved.choices.every((mood) => ["quiet", "warm", "vivid", "delicate"].includes(mood))
      || !Array.isArray(saved.reasons) || !saved.reasons.every((reason) => ["color", "texture", "form", "story"].includes(reason))
      || saved.choices.length > saved.step + Number(saved.choosingReason)
      || (saved.choosingReason && saved.choices.length === 0)
      || saved.reasons.length > saved.choices.length - Number(saved.choosingReason)) return null;
    return saved;
  } catch {
    return null;
  }
}
