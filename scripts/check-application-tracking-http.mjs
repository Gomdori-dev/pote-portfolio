import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3101";
if (!process.env.ARTIST_SESSION_SECRET) throw new Error("Session secret not configured");
const payload = Buffer.from(`admin.${Date.now() + 60_000}`).toString("base64url");
const cookie = `pote_admin_session=${payload}.${createHmac("sha256", process.env.ARTIST_SESSION_SECRET).update(payload).digest("hex")}`;
try {
  const report = "/api/admin/analytics/applications?from=2026-10-27&to=2026-10-27";
  assert.equal((await fetch(base + report)).status, 401);
  const auth = await fetch(base + report, { headers: { cookie } });
  assert.equal(auth.status, 200, "authenticated report"); assert(auth.headers.get("cache-control").includes("no-store"));
  const body = await auth.json(); assert(Array.isArray(body.rows));
  assert.equal((await fetch(base + "/api/admin/analytics/applications?from=2026-02-30", { headers: { cookie } })).status, 400);
  assert.equal((await fetch(base + "/apply")).status, 200);
  const data = { event: "visit", tracking: { sessionId: "10000000-0000-4000-8000-000000000001", attribution: { source: "fixture" } } };
  const post = (event, origin = base) => fetch(base + "/api/analytics/applications", { method: "POST", headers: { "Content-Type": "application/json", origin, "User-Agent": "Googlebot" }, body: JSON.stringify({ ...data, event }) });
  const bot = await post("visit"); assert.equal(bot.status, 200, "bot visit"); assert.equal((await bot.json()).skipped, true);
  assert.equal((await post("accepted")).status, 400);
  assert.equal((await post("start", "https://invalid.example")).status, 403);
  console.log(`PASS ${new URL(base).host}: /apply 200; report unauth 401/auth 200/no-store; invalid date 400; bot skipped; forged acceptance 400; cross-origin 403. No mail or analytics fixture rows written. Groups: ${body.rows.length}`);
} catch (error) { console.error("HTTP check failed:", error.message); process.exitCode = 1; }
