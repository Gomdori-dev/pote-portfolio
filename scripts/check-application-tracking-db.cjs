// Uses a transaction-local TEMP table that shadows the public table and drops on commit.
// No public table or real application row is changed.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('../node_modules/typescript');
const { neon } = require('@neondatabase/serverless');
const cache = new Map(), queries = [];
const capture = async (strings, ...params) => { queries.push({ query: strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, ''), params }); return []; };
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  if (file === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
  if (file.endsWith('/artist-auth.ts')) return { isAdminAuthorized: async () => true };
  if (file.endsWith('/analytics-server.ts')) return { analyticsSql: () => capture };
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const local = name => name.startsWith('@/') ? load(path.resolve('src', name.slice(2)).replace(/\\/g,'/') + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name).replace(/\\/g,'/') + '.ts') : name === 'next/server' ? load(name) : require(name);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(local, mod, mod.exports); return mod.exports;
}
(async () => {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const shared = load(path.resolve('src/lib/application-tracking.ts').replace(/\\/g,'/'));
  const report = load(path.resolve('src/app/api/admin/analytics/applications/route.ts').replace(/\\/g,'/'));
  const a = { sessionId: '10000000-0000-4000-8000-000000000001', attribution: { source: 'meta', medium: 'paid_social', campaign: 'fixture', content: 'a' } };
  await shared.recordApplicationEvent(capture, 'visit', a);
  await shared.recordApplicationEvent(capture, 'visit', a);
  await shared.recordApplicationEvent(capture, 'start', a);
  await shared.recordApplicationEvent(capture, 'accepted', a, 'fixture-key');
  await shared.recordApplicationEvent(capture, 'accepted', a, 'fixture-key');
  await shared.recordApplicationEvent(capture, 'accepted', { ...a, sessionId: '20000000-0000-4000-8000-000000000002', attribution: { ...a.attribution, content: 'b' } }, 'orphan-key');
  const writeQueries = queries.splice(0);
  const res = await report.GET({ nextUrl: new URL('https://potegallery.com/api/admin/analytics/applications?from=2026-10-27&to=2026-10-27') });
  assert.equal(res.status, 200);
  const reportQuery = queries[0];
  assert.equal((await report.GET({ nextUrl: new URL('https://potegallery.com/api/admin/analytics/applications?from=2026-02-30') })).status, 400);
  const ddl = fs.readFileSync('scripts/application-tracking-schema.sql','utf8').replace(/^--.*$/gm,'').split(';')[0].replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE') + ' ON COMMIT DROP';
  const results = await sql.transaction([
    sql.query(ddl), ...writeQueries.map(q => sql.query(q.query,q.params)),
    sql.query("UPDATE pg_temp.analytics_applications SET created_at = '2026-10-27T01:00:00+09:00'"),
    sql.query(reportQuery.query, reportQuery.params),
    sql.query('SELECT count(*)::int AS count FROM pg_temp.analytics_applications')
  ]);
  const rows = results.at(-2), count = results.at(-1)[0].count;
  assert.equal(count, 4, 'duplicate visit and acceptance must not create extra rows');
  const rowA = rows.find(r => r.content === 'a'), rowB = rows.find(r => r.content === 'b');
  assert.deepEqual([rowA.visits,rowA.starts,rowA.applications,rowA.converted,rowA.unmatched], [1,1,1,1,0]);
  assert.deepEqual([rowB.visits,rowB.starts,rowB.applications,rowB.converted,rowB.unmatched], [0,0,1,0,1]);
  console.log('PASS: PostgreSQL TEMP transaction — schema, duplicate prevention, source grouping, KST period, matched rate, orphan acceptance. Public tables unchanged.');
})().catch(e => { console.error('Application DB check failed:', e.code ?? e.message); process.exitCode = 1; });
