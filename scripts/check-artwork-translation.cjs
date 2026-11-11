const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const root = process.cwd(), cache = new Map(), queries = [];
let current, conflict = false, translateCalls = 0, failTranslation = false, generated;
const stubs = {
  react: { cache: (fn) => fn }, 'next/cache': { revalidatePath() {} },
  '@/lib/db': { getSql: () => async (strings, ...values) => {
    const sql = strings.join('?'); queries.push({ sql, values });
    if (sql.includes('SELECT * FROM artwork_submissions')) return current ? [current] : [];
    return conflict ? [] : [{ ...current, status: 'approved' }];
  } },
  '@/lib/artwork-review': { parseAiReview: (value) => value },
  '@/lib/artworks': { getArtwork: () => null },
  '@/lib/artwork-registration-details': { getRegistrationDetails: async () => new Map() },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports,setTimeout){${code}\n})`, { filename: file })(name => stubs[name] ?? (name.startsWith('@/') ? load(path.join(root, 'src', name.slice(2)) + '.ts') : require(name)), mod, mod.exports, (fn) => { fn(); return 0; });
  return mod.exports;
}
const translator = load(path.join(root, 'src/lib/translate.ts'));
const source = { title: '운우', description: '작가가 쓴 설명', details: '캔버스 위 유채 · 45.5 × 37.9cm · 2014', palette: '파랑', condition: '모서리에 흠' };
const english = { title: 'Un-u', description: 'The artist’s description.', details: 'Oil on canvas · 45.5 × 37.9cm · 2014', palette: 'Blue', condition: 'A mark on the corner.' };
const previousFetch = global.fetch, previousKey = process.env.GEMINI_API_KEY, previousError = console.error;
console.error = () => {};
let calls = 0;
function respond(responses) {
  calls = 0;
  global.fetch = async (_url, options) => {
    assert(!String(_url).includes('key='));
    assert.equal(options.headers['x-goog-api-key'], 'fixture');
    const result = responses[Math.min(calls++, responses.length - 1)];
    if (typeof result === 'number') return new Response('', { status: result });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] });
  };
}
(async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(translator.translateToEnglish(source), translator.ArtworkTranslationError);
  process.env.GEMINI_API_KEY = 'fixture';
  for (const result of [429, 503, source, { ...english, description: '' }, { ...english, details: 42 }, { ...english, condition: '모서리 흠' }]) {
    respond([result]);
    await assert.rejects(translator.translateToEnglish(source), translator.ArtworkTranslationError);
    assert.equal(calls, 2);
  }
  respond([503, english]);
  assert.deepEqual(await translator.translateToEnglish(source), english);
  respond([{ title: 'Untitled', details: 'Oil on canvas, 99 × 88cm, 2020' }]);
  const optional = await translator.translateToEnglish({ title: '무제', description: '', details: source.details, palette: '' });
  assert.equal(optional.description, ''); assert.equal(optional.palette, '');
  assert.equal(optional.details, english.details);
  const mockTranslate = async () => { translateCalls++; if (failTranslation) throw new translator.ArtworkTranslationError(); return generated ?? english; };
  stubs['@/lib/translate'] = { ...translator, translateToEnglish: mockTranslate, translateToKorean: mockTranslate };
  const db = load(path.join(root, 'src/lib/artist-portal-db.ts'));
  const fixture = { id: 'f411a694-63f2-45fe-93eb-ee1abc1e2b3c', artist_slug: 'woon', status: 'pending', title_ko: source.title, description_ko: source.description, details_ko: source.details, palette_ko: source.palette, title_en: english.title, description_en: source.description, details_en: english.details, palette_en: english.palette, extras: {}, image_urls: [], ai_review: null, price: null };
  current = fixture; failTranslation = true;
  await assert.rejects(db.approveSubmission(current.id), translator.ArtworkTranslationError);
  assert(!queries.some(q => q.sql.includes('UPDATE')));
  failTranslation = false; queries.length = 0; generated = { ...english, title: 'Changed title' };
  await db.approveSubmission(current.id);
  const repair = queries.find(q => q.sql.includes('UPDATE'));
  assert.equal(repair.values[0], english.title); // Existing valid English stays intact.
  assert.equal(repair.values[1], english.description);
  assert(repair.sql.includes('AND description_ko ='));
  conflict = true;
  await assert.rejects(db.approveSubmission(current.id), translator.ArtworkTranslationError);
  conflict = false; current = { ...fixture, description_en: english.description };
  const before = translateCalls; await db.approveSubmission(current.id); assert.equal(translateCalls, before);
  stubs['@/lib/artist-portal-db'] = { getSubmissionById: async () => current };
  const copy = load(path.join(root, 'src/lib/artwork-copy-edits.ts'));
  current = fixture; queries.length = 0;
  assert.equal((await copy.updateArtworkCopy('submission-' + current.id, 'woon', current.title_ko, current.description_ko, current.details_ko, '', 'ko')).ok, true);
  const edit = queries.find(q => q.sql.includes('UPDATE'));
  assert.equal(edit.values[1], english.title);
  assert.equal(edit.values[3], english.description); // Unchanged Korean repairs missing English.
  failTranslation = true; queries.length = 0;
  await assert.rejects(copy.updateArtworkCopy('submission-' + current.id, 'woon', current.title_ko, current.description_ko, current.details_ko, '', 'ko'), translator.ArtworkTranslationError);
  assert(!queries.some(q => q.sql.includes('UPDATE')));
  console.log('PASS: missing key, 429/503, untranslated/incomplete responses fail safely; retry recovers; optional fields and dimensions preserved; approval repairs or blocks; concurrent edits guarded; unchanged source repairs English without overwriting valid fields');
})().catch(error => { previousError(error); process.exitCode = 1; }).finally(() => {
  global.fetch = previousFetch; console.error = previousError;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
});
