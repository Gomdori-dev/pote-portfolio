const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

// Exercise the real upload route without touching Blob, mail or the database.
const root = process.cwd();
const cache = new Map();
const saved = [];
let uploads = 0;
let translations = 0;
let authenticated = true;
let translationUnavailable = false;
class ArtworkTranslationError extends Error {}
const stubs = {
  'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) }, after() {} },
  '@vercel/blob': { put: async () => ({ url: `https://fixture.public.blob.vercel-storage.com/${++uploads}.jpg` }) },
  '@/lib/artist-auth': { getArtistSlugFromRequest: () => authenticated ? 'qiuchichen' : null },
  '@/lib/artist-portal-db': { insertSubmission: async (input) => { saved.push(input); return { id: String(saved.length), ...input }; } },
  '@/lib/artwork-review': { emailReview() {}, reviewSubmission() {} },
  '@/lib/translate': { ArtworkTranslationError, translateToEnglish: async (source) => { translations++; if (translationUnavailable) throw new ArtworkTranslationError(); return source; }, translateToKorean: async (source) => { translations++; if (translationUnavailable) throw new ArtworkTranslationError(); return source; } },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = (name) => stubs[name] ?? (name.startsWith('@/') ? load(path.join(root, 'src', name.slice(2)) + '.ts') : require(name));
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, mod, mod.exports);
  return mod.exports;
}
const route = load(path.join(root, 'src/app/api/artist-submissions/route.ts'));
const fields = {
  inputLang: 'ko', title: '정물', details: '캔버스에 유채 · 85 × 60cm · 2025',
  moodKey: 'quiet', statusKey: 'available', price: '4520000', frame: 'needs',
  medium: 'painting', workKind: 'original', condition: 'clear', signature: 'signed',
  signatureLocation: 'back', pricing: 'fixed', authorized: 'true', installation: 'needs', certificateAvailability: 'yes',
};
function request(count, overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) form.set(key, value);
  for (let i = 0; i < count; i++) form.append('images', new File(['fixture'], `${i}.jpg`, { type: 'image/jpeg' }));
  return new Request('https://potegallery.com/api/artist-submissions', { method: 'POST', body: form });
}
(async () => {
  for (const overrides of [{}, { photoMode: 'batch' }, { photoMode: 'false' }]) {
    const response = await route.POST(request(3, overrides));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'portalSameArtworkRequired');
  }
  assert.equal(uploads, 0);
  assert.equal(translations, 0);
  assert.equal(saved.length, 0);
  assert.equal((await route.POST(request(3, { photoMode: 'same-artwork' }))).status, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].imageUrls.length, 3);
  for (const title of ['정물', '청화백자 병. 정물', '데이지 꽃']) {
    assert.equal((await route.POST(request(1, { title }))).status, 201);
  }
  assert.deepEqual(saved.slice(1).map((work) => work.titleKo), ['정물', '청화백자 병. 정물', '데이지 꽃']);
  assert(saved.slice(1).every((work) => work.imageUrls.length === 1));
  assert.equal((await route.POST(request(0))).status, 400);
  translationUnavailable = true;
  const uploadsBefore = uploads, savedBefore = saved.length;
  for (const inputLang of ['ko', 'en']) {
    const failed = await route.POST(request(1, { inputLang }));
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).error, 'portalTranslationError');
  }
  assert.equal(uploads, uploadsBefore);
  assert.equal(saved.length, savedBefore);
  authenticated = false;
  assert.equal((await route.POST(request(1))).status, 401);
  console.log('PASS: ambiguous multi-photo submissions blocked; same-work photos preserved; separate works saved; translation failures in both languages blocked before uploads and database writes; missing photos and authentication checked');
})().catch((error) => { console.error(error); process.exitCode = 1; });
