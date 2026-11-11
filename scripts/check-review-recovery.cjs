const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
function load(file, stubs) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(name => stubs[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
let state, blockClaim, failSave, fetchMode, calls;
const sql = async (strings, ...values) => {
  const query = strings.join('?');
  const review = JSON.parse(values[0]);
  if (review.phase === 'running') {
    assert(query.includes('IS NOT DISTINCT FROM'), 'Claim must compare the saved snapshot');
    if (blockClaim) return [];
    state = review;
  } else {
    assert(query.includes("ai_review->>'runId'"), 'Completion must be fenced to its lease');
    assert(query.includes("status = 'pending'"), 'Late completion cannot touch approved rows');
    if (failSave) throw Error('fixture storage unavailable');
    if (!values.includes(state?.runId)) return [];
    state = review;
  }
  return [{ id: 'fixture' }];
};
const review = load('src/lib/artwork-review.ts', {
  '@/lib/artists': { artists: {} }, '@/lib/catalog': { artworkDimensionsCm: () => [70, 50], artworkPrice: () => 280000 },
  '@/lib/korean-labels': { KNOWN_COLORS: [] }, '@/lib/db': { getSql: () => sql },
  '@/lib/mail': {}, '@/lib/artwork-registration': { registrationError: () => null },
});
const submission = { id: 'fixture', status: 'pending', ai_review: null, title_ko: '작품', title_en: 'Work', details_ko: '70 × 50cm', details_en: '70 × 50cm', description_ko: '작가 설명', palette_ko: '회색', price: '280,000원', status_key: 'available', extras: {}, image_urls: ['https://fixture/image.jpg'] };
const previousFetch = global.fetch, previousKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'fixture';
global.fetch = async (url, options) => {
  calls++;
  if (fetchMode === 'timeout') return new Promise((resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason);
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  if (!String(url).includes('generativelanguage')) return new Response('image', { headers: { 'content-type': 'image/jpeg' } });
  if (fetchMode === 'edit') state = null; // A registration/main-image/copy edit invalidates the lease.
  if (fetchMode === 'error') return new Response('', { status: 400 });
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ subjectLocation: 'none', multipleArtworks: false, isArtworkPhoto: true, photoQualityOk: true, problem: '', palette: [], descriptionKo: '', descriptionEn: '' }) }] } }] });
};
function reset() { state = null; blockClaim = false; failSave = false; fetchMode = ''; calls = 0; }
(async () => {
  reset(); assert.equal((await review.reviewSubmission(submission)).verdict, 'pass');
  assert.deepEqual(review.parseAiReview(state), state, 'Lease and retry metadata survive database normalization');
  reset(); blockClaim = true; assert.equal(await review.reviewSubmission(submission), null); assert.equal(calls, 0);
  reset(); fetchMode = 'edit'; assert.equal(await review.reviewSubmission(submission), null); assert.equal(state, null, 'Stale review must not restore cleared results');
  reset(); fetchMode = 'error'; assert.equal((await review.reviewSubmission(submission)).retryable, true); assert.equal(state.phase, 'failed');
  reset(); fetchMode = 'timeout';
  const keepAlive = setInterval(() => {}, 1000); // AbortSignal's timer itself is unref'ed in Node.
  try { assert.equal((await review.reviewSubmission(submission, Date.now() + 10)).phase, 'failed'); } finally { clearInterval(keepAlive); }
  reset(); failSave = true; await assert.rejects(review.reviewSubmission(submission), /storage unavailable/);
  assert.equal(state.phase, 'running', 'Interrupted save leaves a recoverable lease');

  const callbacks = [], emailed = [], reviewed = [];
  let current = { ...submission };
  const worker = load('src/lib/artwork-review-worker.ts', {
    'next/server': { after: fn => callbacks.push(fn) },
    '@/lib/artist-portal-db': { getSubmissionById: async () => current },
    '@/lib/artwork-review': { reviewSubmission: async s => { reviewed.push(s); return { verdict: 'pass' }; }, emailReview: async (...args) => emailed.push(args) },
  });
  worker.schedulePendingReview('static-artwork', Date.now() + 40000); assert.equal(callbacks.length, 0);
  worker.schedulePendingReview('submission-31287851-9f1b-4231-9e25-d98a8e1c7c12', Date.now() + 40000);
  current = { ...submission, title_ko: '수정 후 최신 제목' }; await callbacks.shift()();
  assert.equal(reviewed[0].title_ko, current.title_ko); assert.equal(emailed.length, 1);
  worker.schedulePendingReview('submission-31287851-9f1b-4231-9e25-d98a8e1c7c12', Date.now() + 40000);
  current.status = 'approved'; await callbacks.shift()(); assert.equal(reviewed.length, 1);
  let saveOk = true, authorized = true;
  const scheduled = [];
  const registration = load('src/app/api/artist-works/registration/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/artist-auth': { getArtistSlugFromRequest: () => authorized ? 'fixture' : null },
    '@/lib/artists': { artists: { fixture: {} } }, '@/lib/db': {},
    '@/lib/artwork-registration-details': { saveRegistrationDetails: async () => ({ ok: saveOk, error: 'invalid_fields' }) },
    '@/lib/artwork-review-worker': { schedulePendingReview: (...args) => scheduled.push(args) },
  });
  const request = { headers: new Headers(), url: 'https://fixture/api', json: async () => ({ slug: 'submission-31287851-9f1b-4231-9e25-d98a8e1c7c12', price: '280000', extras: {} }) };
  assert.equal((await registration.PATCH(request)).status, 200); assert.equal(scheduled.length, 1);
  saveOk = false; assert.equal((await registration.PATCH(request)).status, 400); assert.equal(scheduled.length, 1);
  authorized = false; assert.equal((await registration.PATCH(request)).status, 401); assert.equal(scheduled.length, 1);

  let active = 0, peak = 0;
  const cronSecret = process.env.CRON_SECRET; process.env.CRON_SECRET = 'fixture';
  try {
    const cron = load('src/app/api/cron/submission-digest/route.ts', {
      'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } }, '@/lib/db': {},
      '@/lib/artist-portal-db': { listUnreviewedPending: async () => [0, 1, 2, 3], listSubmissionsForAdmin: async () => [{ ai_review: { verdict: 'pass' } }, { ai_review: { phase: 'running' } }] },
      '@/lib/artwork-review': { reviewSubmission: async s => { peak = Math.max(peak, ++active); await new Promise(resolve => setTimeout(resolve, 5)); active--; if (s === 2) throw Error('fixture storage failure'); return { verdict: 'pass' }; }, emailDigest: async items => assert.equal(items.length, 1) },
    });
    const result = await cron.GET({ headers: new Headers({ authorization: 'Bearer fixture' }) });
    assert.equal(peak, 4); assert.deepEqual(await result.json(), { pending: 2, reviewedNow: 3, failed: 1, emailed: 1 });
  } finally { if (cronSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = cronSecret; }
  console.log('PASS: exclusive claims, stale edit protection, timeout recovery, storage failure propagation, metadata round trip and pending-only fresh review scheduling');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
});
