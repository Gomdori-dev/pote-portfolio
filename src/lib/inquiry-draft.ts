// Unsent values stay in this tab for 30 minutes. Never store consent or send automatically.
const TTL = 30 * 60 * 1000;
export const DRAFT_FIELDS = { name: 120, email: 254, phone: 40, message: 6000, offer: 15, organization: 160, project: 200, timeline: 200, location: 200, budget: 200, referenceUrl: 1000 } as const;
export type InquiryDraft = { at: number; type: string; pay: string; fields: Record<string, string> };
const TYPES = /^(buy|offer|availability|details|photos|delivery|other|collaboration(?:_exhibition|_popup|_brand|_content|_space|_commission|_education)?)$/;
const keyFor = (key: string) => key.replace('pote-inquiry-receipt:', 'pote-inquiry-draft:');
export function parseInquiryDraft(raw: string): InquiryDraft | null {
  try {
    if (raw.length > 24000) return null;
    const draft = JSON.parse(raw);
    if (!draft || !Number.isSafeInteger(draft.at) || draft.at <= 0 || draft.at > Date.now() + 60000 || Date.now() - draft.at > TTL || typeof draft.type !== 'string' || !TYPES.test(draft.type) || typeof draft.pay !== 'string' || !['', 'payTransfer', 'payCard', 'payAny', 'payOnce', 'paySplit'].includes(draft.pay) || !draft.fields || typeof draft.fields !== 'object' || Array.isArray(draft.fields)) return null;
    const fields: Record<string, string> = {};
    for (const [name, limit] of Object.entries(DRAFT_FIELDS)) {
      const value = draft.fields[name];
      if (value !== undefined && (typeof value !== 'string' || value.length > limit)) return null;
      fields[name] = value ?? '';
    }
    return { at: draft.at, type: draft.type, pay: draft.pay, fields };
  } catch { return null; }
}
export function readInquiryDraft(key: string): InquiryDraft | null {
  try {
    const raw = window.sessionStorage.getItem(keyFor(key));
    const draft = raw ? parseInquiryDraft(raw) : null;
    if (raw && !draft) clearInquiryDraft(key);
    return draft;
  } catch { return null; }
}
export function saveInquiryDraft(key: string, draft: InquiryDraft): boolean {
  try {
    const raw = JSON.stringify(draft);
    if (!parseInquiryDraft(raw)) return false;
    window.sessionStorage.setItem(keyFor(key), raw);
    return true;
  } catch { return false; }
}
export function clearInquiryDraft(key: string) {
  try { window.sessionStorage.removeItem(keyFor(key)); } catch { /* Storage is optional. */ }
}
