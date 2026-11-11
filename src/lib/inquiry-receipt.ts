import type { DictKey } from "./i18n";

const ROW_KEYS = [
  "inquiryReceiptArtwork", "detailPrice", "fieldOfferPrice", "fieldPayMethod",
  "fieldInquiryType", "fieldName", "fieldPhoneOptional", "fieldMessage",
  "collaborationOrganization", "collaborationProject", "collaborationTimeline",
  "collaborationLocation", "collaborationBudget", "collaborationReference",
] as const satisfies readonly DictKey[];
export type ReceiptRowKey = typeof ROW_KEYS[number];
const TYPES = new Set([
  "buy", "offer", "availability", "details", "photos", "delivery", "other",
  "collaboration", "collaboration_exhibition", "collaboration_popup",
  "collaboration_brand", "collaboration_content", "collaboration_space",
  "collaboration_commission", "collaboration_education",
]);

export type InquiryReceipt = {
  ref: string;
  type: string;
  email: string;
  rows: [ReceiptRowKey, string][];
  hasArtworks: boolean;
  createdAt: number;
};

// Ignore language, guide-draft tokens and tracking parameters. Different
// works/intents retain separate receipts; reordering a selection changes none.
export function inquiryReceiptKey(params: { get(name: string): string | null }): string {
  const works = [...new Set((params.get("artworks") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].sort();
  return `pote-inquiry-receipt:v1:${JSON.stringify([params.get("artwork") ?? "", works, params.get("intent") ?? ""])}`;
}

export function parseInquiryReceipt(raw: string): InquiryReceipt | null {
  try {
    if (raw.length > 24_000) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)
      || typeof value.ref !== "string" || !/^P\d{4}-[A-Z0-9]{4}$/.test(value.ref)
      || !TYPES.has(value.type)
      || typeof value.email !== "string" || value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)
      || typeof value.hasArtworks !== "boolean"
      || !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0 || value.createdAt > Date.now() + 60_000
      || !Array.isArray(value.rows) || value.rows.length === 0 || value.rows.length > 20) return null;
    const rows: [ReceiptRowKey, string][] = [];
    for (const row of value.rows) {
      if (!Array.isArray(row) || row.length !== 2 || !ROW_KEYS.includes(row[0])
        || typeof row[1] !== "string" || row[1].length > 6000
        || rows.some(([key]) => key === row[0])) return null;
      rows.push([row[0], row[1]]);
    }
    if (!rows.some(([key]) => key === "fieldInquiryType")) return null;
    return { ref: value.ref, type: value.type, email: value.email, hasArtworks: value.hasArtworks, createdAt: value.createdAt, rows };
  } catch { return null; }
}

export function readInquiryReceipt(key: string): InquiryReceipt | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const receipt = parseInquiryReceipt(raw);
    if (!receipt) window.sessionStorage.removeItem(key);
    return receipt;
  } catch { return null; }
}

export function saveInquiryReceipt(key: string, receipt: InquiryReceipt): boolean {
  try {
    const raw = JSON.stringify(receipt);
    if (!parseInquiryReceipt(raw)) return false;
    window.sessionStorage.setItem(key, raw);
    return true;
  } catch { return false; }
}

export function clearInquiryReceipt(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}
