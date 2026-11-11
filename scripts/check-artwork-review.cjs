const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const queries = [];
let vision;
const sql = async (strings, ...values) => { queries.push(values); return [{ id: 'fixture' }]; };
const stubs = {
  '@/lib/artists': { artists: {} },
  '@/lib/catalog': { artworkDimensionsCm: () => [60, 85], artworkPrice: () => 4520000 },
  '@/lib/korean-labels': { KNOWN_COLORS: [] },
  '@/lib/db': { getSql: () => sql },
  '@/lib/mail': { getResend() {} },
  '@/lib/artwork-registration': { registrationError: () => null },
};
const file = path.join(process.cwd(), 'src/lib/artwork-review.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(name => stubs[name] ?? require(name), mod, mod.exports);
const previousFetch = global.fetch;
const previousKey = process.env.GEMINI_API_KEY;
process.env.GEMINI_API_KEY = 'fixture';
global.fetch = async (url, options) => {
  if (!String(url).includes('generativelanguage')) return new Response('image', { headers: { 'content-type': 'image/jpeg' } });
  const body = JSON.parse(options.body);
  assert(body.generationConfig.responseSchema.required.includes('subjectLocation'));
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(vision) }] } }] });
};
const submission = { id: 'fixture', title_ko: '정물', title_en: 'Still Life', details_ko: '캔버스에 유채 · 60 × 85cm · 2025', details_en: 'Oil on canvas · 60 × 85cm · 2025', palette_ko: '초록', description_ko: '작가 설명', status_key: 'available', price: '4,520,000원', extras: { medium: 'painting' }, image_urls: ['https://fixture/image.jpg'] };
const valid = { showsPeopleOrAnimals: false, subjectLocation: 'none', multipleArtworks: false, isArtworkPhoto: true, photoQualityOk: true, problem: '', palette: [], descriptionKo: '', descriptionEn: '' };
(async () => {
  // A conflicting boolean must not turn painted faces, snakes or bears into a rejection.
  vision = { ...valid, showsPeopleOrAnimals: true, subjectLocation: 'inside-artwork', problem: '작품에 동물이 포함되어 있습니다.' };
  const painted = await mod.exports.reviewSubmission(submission);
  assert.equal(painted.verdict, 'pass');
  assert.deepEqual(painted.issues, []);
  vision = { ...valid, showsPeopleOrAnimals: false, subjectLocation: 'outside-artwork', problem: '촬영자의 손이 캔버스 옆에 보입니다.' };
  const real = await mod.exports.reviewSubmission(submission);
  assert.equal(real.verdict, 'hold');
  assert(real.issues.some(issue => issue.includes('실제 사람이나 동물')));
  vision = { ...valid, subjectLocation: undefined };
  assert((await mod.exports.reviewSubmission(submission)).issues.some(issue => issue.includes('구분하지 못했어요')));
  vision = { ...valid, subjectLocation: 'inside-artwork', multipleArtworks: true };
  const multiple = await mod.exports.reviewSubmission(submission);
  assert(multiple.issues.some(issue => issue.includes('서로 다른 작품')));
  assert(!multiple.issues.some(issue => issue.includes('실제 사람이나 동물')));
  console.log('PASS: painted subjects accepted; actual subjects flagged independently; missing classification held; separate artworks flagged');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
});
