import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { describeExhibitionError, requestExhibitionData } from "./exhibition-request.mjs";
import { refreshExhibitions } from "./refresh-exhibitions.mjs";
import { fetchCulturePortalExhibitions } from "./fetch-culture-portal.mjs";

const secret = "fixture/key+private";
const url = `https://example.test/exhibitions?serviceKey=${encodeURIComponent(secret)}&pageNo=1`;
const networkError = (code = "ECONNRESET") => new TypeError("fetch failed", {
  cause: new AggregateError([Object.assign(new Error(`socket failed at ${url}; ${secret}`), { code, syscall: "connect", address: "127.0.0.1", port: 443 })]),
});

function capture(t) {
  const lines = [];
  t.mock.method(console, "error", (...args) => lines.push(args.join(" ")));
  t.mock.method(console, "log", (...args) => lines.push(args.join(" ")));
  return lines;
}

test("transient nested connection errors retry with 3/6/9 second pauses and recover; secrets stay hidden", async (t) => {
  const lines = capture(t);
  const pauses = [];
  const signals = [];
  let calls = 0;
  const data = await requestExhibitionData(url, {
    source: "KCISA", format: "json", wait: async (ms) => pauses.push(ms),
    fetchImpl: async (_, options) => {
      signals.push(options.signal);
      if (++calls < 4) throw networkError();
      return Response.json({ ok: true });
    },
  });
  assert.deepEqual(data, { ok: true });
  assert.deepEqual(pauses, [3000, 6000, 9000]);
  assert.equal(new Set(signals).size, 4);
  const records = lines.map((line) => JSON.parse(line));
  assert.equal(records[0].error.cause.errors[0].code, "ECONNRESET");
  assert.equal(records[0].error.cause.errors[0].syscall, "connect");
  assert.equal(records.at(-1).outcome, "recovered");
  assert.equal(records.at(-1).attempt, 4);
  assert(!lines.join("\n").includes(secret));
  assert(!lines.join("\n").includes(encodeURIComponent(secret)));
  assert(!lines.join("\n").includes("serviceKey="));
});

test("network retry exhaustion is bounded and preserves a sanitized cause for the final log", async (t) => {
  const lines = capture(t);
  let calls = 0;
  await assert.rejects(requestExhibitionData(url, {
    source: "KCISA", wait: async () => {}, fetchImpl: async () => { calls++; throw networkError("ETIMEDOUT"); },
  }), (error) => {
    const detail = describeExhibitionError(error);
    assert.equal(detail.cause.cause.errors[0].code, "ETIMEDOUT");
    assert(!JSON.stringify(detail).includes(secret));
    return /4\/4 attempts/.test(error.message);
  });
  assert.equal(calls, 4);
  assert.equal(JSON.parse(lines.at(-1)).retryInMs, 0);
  assert.equal(JSON.parse(lines.at(-1)).outcome, "failed");
});

for (const status of [408, 429, 500, 503]) {
  test(`HTTP ${status} retries then recovers`, async (t) => {
    capture(t);
    let calls = 0;
    const data = await requestExhibitionData(url, {
      source: "KCISA", wait: async () => {},
      fetchImpl: async () => ++calls === 1 ? new Response("failure", { status }) : new Response("ok"),
    });
    assert.equal(data, "ok");
    assert.equal(calls, 2);
  });
}

for (const status of [400, 401, 403, 404]) {
  test(`HTTP ${status} fails once without retry`, async (t) => {
    const lines = capture(t);
    let calls = 0;
    await assert.rejects(requestExhibitionData(url, {
      source: "KCISA", fetchImpl: async () => { calls++; return new Response("failure", { status }); },
      wait: async () => assert.fail("permanent HTTP error must not wait"),
    }));
    assert.equal(calls, 1);
    assert.equal(JSON.parse(lines[0]).status, status);
    assert.equal(JSON.parse(lines[0]).retryable, false);
  });
}

test("TLS certificate errors and malformed JSON fail once", async (t) => {
  capture(t);
  for (const fetchImpl of [
    async () => { throw networkError("CERT_HAS_EXPIRED"); },
    async () => new Response("<html>not json</html>"),
  ]) {
    let calls = 0;
    await assert.rejects(requestExhibitionData(url, {
      source: "KCISA", format: "json", fetchImpl: async (...args) => { calls++; return fetchImpl(...args); },
      wait: async () => assert.fail("permanent response/configuration error must not wait"),
    }));
    assert.equal(calls, 1);
  }
});

test("connection loss while reading a response body also retries", async (t) => {
  capture(t);
  let calls = 0;
  assert.equal(await requestExhibitionData(url, {
    source: "KCISA", wait: async () => {}, fetchImpl: async () => {
      if (++calls === 1) return { ok: true, status: 200, text: async () => { throw networkError(); } };
      return new Response("ok");
    },
  }), "ok");
  assert.equal(calls, 2);
});

for (const stallBody of [false, true]) {
  test(`real HTTP deadline covers ${stallBody ? "a stalled body" : "waiting for headers"}`, async (t) => {
    const lines = capture(t);
    const server = createServer((_, response) => {
      if (stallBody) { response.writeHead(200); response.write("partial body"); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
    await assert.rejects(requestExhibitionData(`http://127.0.0.1:${server.address().port}/stall`, {
      source: "deadline fixture", timeoutMs: 100, attempts: 2, wait: async () => {},
    }));
    assert.equal(lines.length, 2, lines.join("\n"));
    assert(lines.every((line) => JSON.parse(line).retryable));
    assert(lines.every((line) => JSON.parse(line).error.name === "TimeoutError"));
  });
}

test("cyclic causes, nested errors and query URLs are safe to log", () => {
  const error = networkError();
  error.cause.errors[0].cause = error;
  const result = JSON.stringify(describeExhibitionError(error, [secret]));
  assert(result.includes("Nested error omitted"));
  assert(!result.includes(secret));
  assert(!result.includes("serviceKey="));
});

const kcisa = (count = 2, resultCode = "0000") => Response.json({ response: {
  header: { resultCode }, body: { items: { item: Array.from({ length: count }, (_, i) => ({
    LOCAL_ID: String(i), TITLE: `검증 전시 ${i}`, CNTC_INSTT_NM: "검증 미술관", PERIOD: "2026-10-01~2026-12-31",
  })) } },
} });

test("culture portal keeps list entries when a detail request fails, with no detail retries", async (t) => {
  const lines = capture(t);
  const paths = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const path = new URL(input).pathname;
    paths.push(path);
    if (path.endsWith("detail2")) return new Response("unauthorized", { status: 401 });
    return new Response('<response><resultCode>00</resultCode><totalCount>1</totalCount><item><serviceName>전시</serviceName><seq>1</seq><title>검증 전시</title><place>검증 미술관</place><area>서울</area><startDate>20261001</startDate><endDate>20261231</endDate></item></response>');
  });
  const items = await fetchCulturePortalExhibitions(secret);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "검증 전시");
  assert.equal(items[0].fee, "정보 없음");
  assert.equal(paths.length, 2);
  assert(lines[0].includes('"status":401'));
  assert(!lines[0].includes(secret));
});

for (const scenario of ["unauthorized", "api error", "empty data", "shrink", "retry recovery", "retry exhaustion"]) {
  test(`snapshot integration: ${scenario}`, async (t) => {
    const lines = capture(t);
    const directory = await mkdtemp(join(tmpdir(), "pote-exhibition-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const outputPath = join(directory, "exhibitions.json");
    const environmentPath = join(directory, "fixture.env");
    const original = JSON.stringify({ updatedAt: "old", items: [1, 2, 3, 4] });
    await writeFile(outputPath, original);
    const previousEnv = [process.env.DATA_GO_KR_API_KEY, process.env.DATA_GO_KR_PORTAL_KEY];
    delete process.env.DATA_GO_KR_API_KEY;
    delete process.env.DATA_GO_KR_PORTAL_KEY;
    t.after(() => {
      for (const [index, name] of ["DATA_GO_KR_API_KEY", "DATA_GO_KR_PORTAL_KEY"].entries()) {
        if (previousEnv[index] === undefined) delete process.env[name];
        else process.env[name] = previousEnv[index];
      }
    });
    await writeFile(environmentPath, `DATA_GO_KR_API_KEY=${secret}\nDATA_GO_KR_PORTAL_KEY=fixture-portal-key\n`);
    let kcisaCalls = 0;
    t.mock.method(globalThis, "fetch", async (input) => {
      const host = new URL(input).hostname;
      if (host === "api.kcisa.kr") {
        kcisaCalls++;
        if (scenario === "unauthorized") return new Response("bad key", { status: 401 });
        if (scenario === "retry exhaustion") throw networkError();
        if (scenario === "api error") return kcisa(2, "9999");
        if (scenario === "empty data") return kcisa(0);
        if (scenario === "retry recovery" && kcisaCalls === 1) return new Response("unavailable", { status: 503 });
        return kcisa(scenario === "shrink" ? 1 : 4);
      }
      // Optional sources can fail; the size guard still decides whether to write.
      return new Response("unavailable", { status: 401 });
    });
    const run = refreshExhibitions({ outputPath, environmentPath });
    if (scenario === "retry recovery") {
      await run;
      const saved = JSON.parse(await readFile(outputPath, "utf8"));
      assert.equal(saved.items.length, 4);
      assert.notEqual(saved.updatedAt, "old");
      assert.equal(kcisaCalls, 2);
      assert(lines.some((line) => line.includes('"outcome":"recovered"')));
    } else {
      await assert.rejects(run);
      assert.equal(await readFile(outputPath, "utf8"), original);
      assert.equal(kcisaCalls, scenario === "retry exhaustion" ? 4 : 1);
    }
    await assert.rejects(readFile(`${outputPath}.next`), { code: "ENOENT" });
  });
}

test("CLI failure exits with status 1, logs the cause and leaves the real snapshot unchanged", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pote-exhibition-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const preload = join(directory, "mock-fetch.mjs");
  await writeFile(preload, 'globalThis.fetch = async () => new Response("bad key", { status: 401 });\n');
  const snapshotUrl = new URL("../public/data/exhibitions.json", import.meta.url);
  const original = await readFile(snapshotUrl);
  const result = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, "scripts/refresh-exhibitions.mjs"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 10_000,
    env: { ...process.env, DATA_GO_KR_API_KEY: secret },
  });
  assert.equal(result.status, 1);
  assert(result.stderr.includes('"message":"HTTP 401"'), result.stderr);
  assert(result.stderr.includes("existing snapshot left unchanged"));
  assert(!result.stderr.includes(secret));
  assert(!result.stderr.includes("serviceKey="));
  assert.deepEqual(await readFile(snapshotUrl), original);
});
