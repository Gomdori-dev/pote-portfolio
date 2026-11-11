/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const sharp = require('sharp');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const testModule = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, testModule, testModule.exports);
  return testModule.exports;
}

async function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pote-catalog-cache-'));
  const cacheDir = path.join(fixture, '.next', 'cache', 'fetch-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'sql'), JSON.stringify({ data: { url: 'https://api.c-11.us-east-1.aws.neon.tech/sql' } }));
  fs.writeFileSync(path.join(cacheDir, 'other'), JSON.stringify({ data: { url: 'https://example.com/feed' } }));
  fs.writeFileSync(path.join(cacheDir, 'malformed'), 'not-json');
  fs.mkdirSync(path.join(cacheDir, 'directory'));
  const cleanupScript = path.resolve('scripts/clear-catalog-build-cache.mjs');
  execFileSync(process.execPath, [cleanupScript], { cwd: fixture });
  assert.ok(!fs.existsSync(path.join(cacheDir, 'sql')));
  assert.deepEqual(fs.readdirSync(cacheDir).sort(), ['directory', 'malformed', 'other']);
  execFileSync(process.execPath, [cleanupScript], { cwd: fixture });
  // Keep the small fixture in the system temp directory for inspection.
  const { GET } = load('src/app/api/display-image/route.ts');
  const loader = load('src/lib/image-loader.ts').default;
  const originalFetch = global.fetch;
  let calls = 0;
  let currentImage = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#e06d3b' } }).jpeg().toBuffer();
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    assert.equal(new URL(url).hostname, 'vr4iop7ft7hr1nyt.public.blob.vercel-storage.com');
    return new Response(currentImage, { headers: { 'Content-Type': 'image/jpeg' } });
  };
  const source = 'https://vr4iop7ft7hr1nyt.public.blob.vercel-storage.com/submissions/qiuchichen/test.jpg';
  const request = (src, width = 3840, quality = 85) => new Request(`https://potegallery.com${loader({ src, width, quality })}`);
  try {
    // Serving images must never touch the quota-blocked /_next/image endpoint.
    assert.match(loader({ src: source, width: 1080 }), /^\/api\/display-image\?/);
    const response = await GET(request(source));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cdn-cache-control'), /s-maxage=86400/);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.width, 1536);
    assert.equal(metadata.height, 2048);
    assert.equal(metadata.width / metadata.height, 3 / 4);
    currentImage = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#0d2218' } }).png().toBuffer();
    const small = await GET(request(source, 640));
    const smallMeta = await sharp(Buffer.from(await small.arrayBuffer())).metadata();
    assert.equal(smallMeta.width, 100);
    assert.equal(smallMeta.height, 50);
    // Exercise the actual homepage background props through the custom loader.
    const hero = fs.readFileSync('src/app/HomeClient.tsx', 'utf8').match(/<Image className="home-hero-scene"[^>]*src="([^"]+)"[^>]*quality=\{(\d+)\}/);
    assert.ok(hero, 'Homepage gallery background must be checked');
    global.fetch = async (url) => {
      assert.equal(String(url), `https://potegallery.com${hero[1]}`);
      return new Response(fs.readFileSync(`public${hero[1]}`), { headers: { 'Content-Type': 'image/webp' } });
    };
    for (const width of [828, 1920]) {
      const background = await GET(request(hero[1], width, Number(hero[2])));
      assert.equal(background.status, 200, `Homepage background at width ${width}`);
      assert.equal((await sharp(Buffer.from(await background.arrayBuffer())).metadata()).format, 'webp');
    }
    const before = calls;
    for (const url of ['https://example.com/a.jpg', 'http://127.0.0.1/a.jpg', '//example.com/a.jpg', '/api/admin/submissions', '/.env.local', '/artists/%2e%2e/%2e%2e/.env.local', `${source}?secret=test`, source.replace('https://', 'https://user:pass@'), '/artists/test.svg']) {
      assert.equal((await GET(request(url))).status, 400, url);
    }
    assert.equal((await GET(request(source, 999))).status, 400);
    assert.equal((await GET(request(source, 1080, 100))).status, 400);
    assert.equal(calls, before, 'Invalid requests must not reach upstream');
    global.fetch = async () => new Response(null, { status: 404 });
    assert.equal((await GET(request(source))).status, 404);
    global.fetch = async () => new Response('not an image', { headers: { 'Content-Type': 'text/html' } });
    assert.equal((await GET(request(source))).status, 415);
    global.fetch = async () => new Response('x', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(16 * 1024 * 1024) } });
    const oversized = await GET(request(source));
    assert.equal(oversized.status, 413);
    assert.equal(oversized.headers.get('cache-control'), 'no-store');
    for (const file of ['src/lib/display-image.ts', 'src/lib/seo.ts', 'src/lib/visit-ticket.ts']) {
      assert.ok(!fs.readFileSync(file, 'utf8').includes('/_next/image'), file);
    }
    console.log('Image delivery checks passed: resize, aspect ratio, no enlargement, CDN cache, source restrictions, upstream failures, shared consumers, stale SQL build cache.');
  } finally {
    global.fetch = originalFetch;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
