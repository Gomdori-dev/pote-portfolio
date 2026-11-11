// Where a visitor came from, kept for the tab's session so a purchase inquiry
// can say "instagram / reel-0927" in the operator's mail. Vercel's free plan
// has no custom events, so this one line is the only channel signal we get.
const KEY = "pote-source";

export type VisitSource = { source?: string; medium?: string; campaign?: string; referrer?: string; landing?: string };

export function captureVisitSource() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).host : "";
      if (host && host !== window.location.host) referrer = host;
    } catch {}
    const value: VisitSource = {
      source: params.get("utm_source")?.slice(0, 60) || undefined,
      medium: params.get("utm_medium")?.slice(0, 60) || undefined,
      campaign: params.get("utm_campaign")?.slice(0, 60) || undefined,
      referrer,
      landing: window.location.pathname.slice(0, 200),
    };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

export function readVisitSource(): VisitSource {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" ? value as VisitSource : {};
  } catch {
    return {};
  }
}

// Always Korean: the line is for the operator's inbox, not the visitor.
export function visitSourceLine() {
  const value = readVisitSource();
  const parts = [value.source ?? value.referrer, value.medium, value.campaign].filter(Boolean);
  const landing = value.landing ? ` (첫 페이지 ${value.landing})` : "";
  return parts.length > 0 ? `유입: ${parts.join(" / ")}${landing}` : `유입: 직접 방문 또는 알 수 없음${landing}`;
}
