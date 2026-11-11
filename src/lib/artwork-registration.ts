import type { ArtworkExtras } from "./artwork-extras";
import type { DictKey } from "./i18n";

export const FACT_LABELS = {
  medium: { painting: "mediumPainting", print: "mediumPrint", craft: "mediumCraft", photo: "mediumPhoto" },
  photoProcess: { inkjet: "photoProcessInkjet", silver: "photoProcessSilver", ctype: "photoProcessCtype", other: "photoProcessOther" },
  photoPaper: { cotton: "photoPaperCotton", fiber: "photoPaperFiber", resin: "photoPaperResin", hanji: "photoPaperHanji", other: "photoPaperOther" },
  workKind: { original: "workKindOriginal", limited: "workKindLimited", open: "workKindOpen", reproduction: "workKindReproduction" },
  condition: { clear: "conditionClear", issues: "conditionIssues", unknown: "conditionUnknown" },
  signature: { signed: "signatureSigned", unsigned: "signatureUnsigned", planned: "signaturePlanned" },
  pricing: { fixed: "pricingFixed", inquiry: "pricingInquiry" },
  installation: { ready: "installationReady", needs: "installationNeeds", na: "installationNA" },
  certificateAvailability: { yes: "certificateYes", no: "certificateNo", arrange: "certificateArrange" },
} as const satisfies Record<string, Record<string, DictKey>>;

/** Validate factual answers on the server; optional photos never establish authenticity. */
export function registrationError(extras: ArtworkExtras, price: string, hasConditionPhoto: boolean, newWork = false): DictKey | null {
  if (newWork && !extras.medium) return "registrationMissing";
  if (extras.workKind === "open" || extras.workKind === "reproduction") return "registrationNotAccepted";
  if (extras.medium === "photo" && (extras.workKind !== "limited" || extras.signature !== "signed")) return "registrationPhotoError";
  if (extras.medium === "photo" && (!extras.photoProcess || !extras.photoPaper || (extras.frame === "framed" && (!extras.framedWidthCm || !extras.framedHeightCm)))) return "registrationPhotoInfoError";
  if (extras.medium === "print" && extras.workKind !== "limited") return "registrationEditionError";
  if (extras.medium === "craft" && !extras.depthCm) return "registrationDepthError";
  if (!extras.workKind || !extras.condition || !extras.signature || !extras.pricing || !extras.installation || !extras.certificateAvailability || !extras.authorized || !extras.frame) return "registrationMissing";
  if (extras.signature === "signed" && !extras.signatureLocation) return "registrationMissing";
  if (extras.pricing === "fixed" && (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:원)?$/.test(price.replace(/\s/g, "")) || Number(price.replace(/\D/g, "")) <= 0 || !Number.isSafeInteger(Number(price.replace(/\D/g, ""))))) return "registrationPriceError";
  if (extras.workKind === "limited" && !/^\d+\s*\/\s*\d+$/.test(extras.edition ?? "")) return "registrationEditionError";
  if (extras.workKind === "limited") {
    const [number, total] = extras.edition!.split("/").map(Number);
    if (number < 1 || total < number || !Number.isSafeInteger(total)) return "registrationEditionError";
  }
  if (extras.frame === "na" && !extras.depthCm) return "registrationDepthError";
  if (extras.condition === "issues" && (!(extras.conditionNoteKo || extras.conditionNoteEn)?.trim() || !hasConditionPhoto)) return "registrationConditionError";
  return null;
}

export function validRegistrationYear(year: string): boolean {
  return /^(?:미상|unknown)$/i.test(year) || /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 2100;
}
