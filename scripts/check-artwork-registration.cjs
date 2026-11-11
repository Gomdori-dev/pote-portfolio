const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const box = { exports: {}, console, File, process, require(name) { if (!(name in mocks)) throw Error(name); return mocks[name]; } };
  vm.runInNewContext(code, box);
  return box.exports;
}
const parser = load('src/lib/artwork-extras.ts');
const rules = load('src/lib/artwork-registration.ts');
const base = { workKind: 'original', condition: 'clear', signature: 'unsigned', pricing: 'inquiry', authorized: true, installation: 'ready', certificateAvailability: 'no', frame: 'ready' };
assert.equal(rules.registrationError(base, '', false), null, 'Unsigned original needs no signature/back photo');
assert.equal(rules.registrationError({ ...base, authorized: false }, '', false), 'registrationMissing');
assert.equal(rules.registrationError({ ...base, condition: 'unknown' }, '', false), null);
assert.equal(rules.registrationError({ ...base, signature: 'signed' }, '', false), 'registrationMissing');
assert.equal(rules.registrationError({ ...base, signature: 'signed', signatureLocation: 'back' }, '', false), null);
assert.equal(rules.registrationError({ ...base, condition: 'issues', conditionNoteKo: '모서리 손상' }, '', false), 'registrationConditionError');
assert.equal(rules.registrationError({ ...base, condition: 'issues', conditionNoteKo: '모서리 손상' }, '', true), null);
for (const price of ['', '0', '-100', '1,,000', '1,23', '문의']) assert.equal(rules.registrationError({ ...base, pricing: 'fixed' }, price, false), 'registrationPriceError');
assert.equal(rules.registrationError({ ...base, pricing: 'fixed' }, '120,000원', false), null);
assert.equal(rules.registrationError({ ...base, workKind: 'limited', edition: '21/20' }, '', false), 'registrationEditionError');
assert.equal(rules.registrationError({ ...base, workKind: 'limited', edition: '3/20' }, '', false), null);
assert.equal(rules.registrationError({ ...base, frame: 'na' }, '', false), 'registrationDepthError');
assert.equal(rules.registrationError({ ...base, frame: 'na', depthCm: 5 }, '', false), null);
assert.equal(parser.parseArtworkExtras({ certificate: true, certificateAvailability: 'no', hangingReady: true, installation: 'needs' }).certificate, false);
assert.equal(parser.parseArtworkExtras({ certificate: false }).certificateAvailability, undefined, 'Legacy non-answer stays unknown');
assert.equal(parser.parseArtworkExtras({ signature: 'invented' }).signature, undefined);
for (const year of ['미상', 'Unknown', '2026']) assert.equal(rules.validRegistrationYear(year), true);
for (const year of ['', '0', '2026foo', '2101']) assert.equal(rules.validRegistrationYear(year), false);

(async () => {
  let writes = 0;
  const service = load('src/lib/artwork-registration-details.ts', {
    react: { cache: fn => fn }, 'next/cache': { revalidatePath() {} },
    './db': { getSql: () => async () => { writes++; return []; }, DatabaseNotConfiguredError: class extends Error {} },
    './artworks': { getArtwork: slug => slug === 'owned' ? { artistSlug: 'hoohoo' } : null },
    './artist-portal-db': { getSubmissionById: async () => null },
    './artwork-proof-photos': { getStaticProofPhotos: async () => new Map() },
    './artwork-controls': { getArtworkControls: async () => new Map() },
    './artwork-extras': parser, './artwork-registration': rules,
    './translate': { translateToEnglish: async () => { throw Error('Must not translate an empty report'); } },
  });
  assert.equal((await service.saveRegistrationDetails('owned', 'other', base, '', 'ko')).error, 'forbidden');
  assert.equal(writes, 0, 'Cross-artist edit cannot write');
  assert.equal((await service.saveRegistrationDetails('owned', 'hoohoo', { ...base, condition: 'issues', conditionNoteKo: '손상' }, '', 'ko')).error, 'registrationConditionError');
  assert.equal(writes, 0, 'Missing condition photo cannot write');
  assert.equal((await service.saveRegistrationDetails('owned', 'hoohoo', base, '', 'ko')).ok, true);
  assert.equal(writes, 1);
  const row = { slug: 'owned', extras: base, price: null };
  const result = service.applyRegistrationDetails([{ slug: 'owned', price: '100,000원', extras: { proof: { edge: 'existing-photo' } } }], new Map([['owned', row]]))[0];
  assert.equal(result.price, undefined, 'Price-on-request replaces stale catalogue price');
  assert.equal(result.extras.proof.edge, 'existing-photo', 'Facts edit preserves condition photos');
  let auth = 'hoohoo';
  const forbiddenSideEffect = () => { throw Error('Validation must run before upload, translation or database writes'); };
  const route = load('src/app/api/artist-submissions/route.ts', {
    '@vercel/blob': { put: forbiddenSideEffect },
    'next/server': { after: forbiddenSideEffect, NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    'node:crypto': {}, '@/lib/db': { DatabaseNotConfiguredError: class extends Error {} },
    '@/lib/artist-portal-db': { insertSubmission: forbiddenSideEffect }, '@/lib/artwork-review': {},
    '@/lib/artist-auth': { getArtistSlugFromRequest: () => auth }, '@/lib/translate': { translateToEnglish: forbiddenSideEffect },
    '@/lib/artwork-extras': parser, '@/lib/korean-labels': { koreanizeDetails: s => s, koreanizePaletteText: s => s },
    '@/lib/portal-dimensions': load('src/lib/portal-dimensions.ts'), '@/lib/artwork-registration': rules,
  });
  const upload = { ...base, medium: 'painting', authorized: 'true', title: 'Test', details: 'Oil · 20 × 30cm · 2026', moodKey: 'quiet', statusKey: 'available' };
  async function post(overrides) { const form = new FormData(); for (const [key, value] of Object.entries({ ...upload, ...overrides })) form.set(key, value); form.set('images', new File(['test'], 'test.jpg', { type: 'image/jpeg' })); return route.POST({ formData: async () => form }); }
  assert.equal((await post({ pricing: 'fixed', price: '1,23' })).body.error, 'registrationPriceError', 'Server rejects malformed commas before price normalization');
  assert.equal((await post({ condition: 'issues', conditionNote: 'Damaged' })).body.error, 'registrationConditionError');
  assert.equal((await post({ authorized: '' })).body.error, 'registrationMissing');
  assert.equal((await post({ details: 'Oil · 20 × 30cm · 0' })).body.error, 'invalid_year');
  auth = null;
  assert.equal((await post({})).status, 401);
  console.log('Registration checks passed: optional photos, conditional evidence, pricing, editions, years, legacy data and ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
