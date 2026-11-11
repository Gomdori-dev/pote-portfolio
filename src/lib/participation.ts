import type { DictKey } from "./i18n";

export const WORK_TYPE_LABEL = {
  original: "optionWorkOriginal", edition: "optionWorkEdition", craft: "optionWorkCraft", photo: "optionWorkPhoto",
  print: "optionWorkPrint", digital: "optionWorkDigital", ai: "optionWorkAi",
} as const satisfies Record<string, DictKey>;
export type WorkType = keyof typeof WORK_TYPE_LABEL;
export const ACCEPTED_WORK_TYPES = ["original", "edition", "craft", "photo"] as const;
export function acceptedWorkType(value: unknown): value is (typeof ACCEPTED_WORK_TYPES)[number] {
  return typeof value === "string" && (ACCEPTED_WORK_TYPES as readonly string[]).includes(value);
}
