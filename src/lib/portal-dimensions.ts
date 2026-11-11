// The portal writes dimensions as "material · width × height cm · year".
// Validate the complete size segment so a sign, suffix, or partial match
// cannot turn a malformed value into an apparently valid measurement.
const NUMBER = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
const SIZE_SEGMENT = new RegExp(
  String.raw`^\s*(?:\([^)]{1,20}\)\s*)?(${NUMBER})\s*[×x]\s*(${NUMBER})(?:\s*[×x]\s*(${NUMBER}))?\s*cm\s*$`,
  "i",
);

export function validPortalDimensions(details: string): boolean {
  const segment = details.split("·").find((part) => /cm/i.test(part));
  const match = segment?.match(SIZE_SEGMENT);
  if (!match) return false;
  return match.slice(1).filter((value): value is string => value !== undefined)
    .every((value) => {
      const cm = Number(value);
      return Number.isFinite(cm) && cm >= 0.1 && cm < 10000;
    });
}
