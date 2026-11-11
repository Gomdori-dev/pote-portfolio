// A per-instance brake on one visitor hammering an endpoint. Not exact across
// serverless instances, and it does not need to be: it only has to stop a
// single bot from burning the free mail/AI quotas or guessing passwords.
const buckets = new Map<string, number[]>();

function recentTimes(key: string, windowMs: number, now: number) {
  return (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
}

// Counts this call and returns false once `limit` calls already landed in the
// last `windowMs`.
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const times = recentTimes(key, windowMs, now);
  if (times.length >= limit) { buckets.set(key, times); return false; }
  times.push(now);
  buckets.set(key, times);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

// For login forms: only failed attempts count, so check with `blocked` first
// and call `recordFailure` after a wrong password.
export function blocked(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const times = recentTimes(key, windowMs, now);
  buckets.set(key, times);
  return times.length >= limit;
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  const times = recentTimes(key, windowMs, now);
  times.push(now);
  buckets.set(key, times);
  if (buckets.size > 5000) buckets.clear();
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
