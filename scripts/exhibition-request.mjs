import { setTimeout as sleep } from "node:timers/promises";

const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
]);

function redact(value, secrets) {
  let text = String(value);
  for (const secret of secrets.filter(Boolean)) {
    for (const variant of new Set([secret, encodeURIComponent(secret)])) {
      text = text.split(variant).join("[REDACTED]");
    }
  }
  return text
    .replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
      try { const url = new URL(raw); return `${url.origin}${url.pathname}`; }
      catch { return "[URL REDACTED]"; }
    })
    .replace(/(serviceKey\s*[=:]\s*)[^&\s"'<>]+/gi, "$1[REDACTED]");
}

/** Allowlisted fields only: never dump request objects, headers or raw stacks. */
export function describeExhibitionError(error, secrets = [], seen = new Set()) {
  if (error === null || typeof error !== "object") return { message: redact(error, secrets) };
  if (seen.has(error) || seen.size >= 12) return { message: "Nested error omitted" };
  seen.add(error);
  const detail = {};
  for (const field of ["name", "message", "code", "syscall", "address", "port"]) {
    if (["string", "number"].includes(typeof error[field])) detail[field] = redact(error[field], secrets);
  }
  if (error.cause) detail.cause = describeExhibitionError(error.cause, secrets, seen);
  if (Array.isArray(error.errors)) detail.errors = error.errors.slice(0, 6).map((child) => describeExhibitionError(child, secrets, seen));
  return detail;
}

export function logExhibitionError(source, error, secrets = []) {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), source, error: describeExhibitionError(error, secrets) }));
}

function isTransient(error, seen = new Set()) {
  if (!error || typeof error !== "object" || seen.has(error)) return false;
  seen.add(error);
  if (error.name === "TimeoutError" || TRANSIENT_CODES.has(error.code)) return true;
  // A plain Node fetch failure may have no cause. Do not retry TLS/config errors
  // merely because their outer message also says "fetch failed".
  if (error instanceof TypeError && error.message === "fetch failed" && !error.cause) return true;
  return isTransient(error.cause, seen) || (Array.isArray(error.errors) && error.errors.some((child) => isTransient(child, seen)));
}

/** GET only. The deadline includes consuming the response body. */
export async function requestExhibitionData(input, {
  source, format = "text", headers, attempts = 4, timeoutMs = 25_000,
  retryPauseMs = 3_000, fetchImpl = globalThis.fetch, wait = sleep,
} = {}) {
  const url = new URL(input);
  const endpoint = `${url.origin}${url.pathname}`;
  const secrets = [url.searchParams.get("serviceKey")];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    let status;
    try {
      const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      status = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        const error = new Error(`HTTP ${status}`);
        error.status = status;
        throw error;
      }
      const data = format === "json" ? await response.json() : await response.text();
      if (attempt > 1) console.log(JSON.stringify({ timestamp: new Date().toISOString(), source, endpoint, attempt, attempts, status, elapsedMs: Date.now() - started, outcome: "recovered" }));
      return data;
    } catch (error) {
      const retryable = error.status === 408 || error.status === 429 || error.status >= 500 || isTransient(error);
      const retry = retryable && attempt < attempts;
      const retryInMs = retry ? attempt * retryPauseMs : 0;
      const detail = describeExhibitionError(error, secrets);
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), source, endpoint, attempt, attempts, timeoutMs, elapsedMs: Date.now() - started, ...(status === undefined ? {} : { status }), retryable, retryInMs, outcome: retry ? "retry" : "failed", error: detail }));
      if (!retry) throw new Error(`${source} request failed after ${attempt}/${attempts} attempts; endpoint=${endpoint}.`, { cause: detail });
      await wait(retryInMs);
    }
  }
}
