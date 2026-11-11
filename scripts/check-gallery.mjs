import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// These modules only depend on each other. Strip their type-only imports and
// resolve relative ones (artworks.ts re-exports ./artists and ./artwork-order)
// to exercise the real routing and catalogue data with Node's assertions.
const loaded = new Map();
function load(path, from = import.meta.url) {
  const url = new URL(path.endsWith(".ts") ? path : `${path}.ts`, from);
  if (loaded.has(url.href)) return loaded.get(url.href);
  const output = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {} };
  loaded.set(url.href, context.exports);
  context.require = (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`check-gallery: unexpected runtime import ${specifier} in ${path}`);
    return load(specifier, url);
  };
  vm.runInNewContext(output, context, { filename: url.pathname });
  return context.exports;
}

const { safeArtworkHref } = load("../src/lib/artwork-route.ts");
const cases = [
  [null, "/artworks"],
  [{}, "/artworks"],
  [{ slug: "  record-02  " }, "/artworks/record-02"],
  [{ id: 0 }, "/artworks/0"],
  [{ id: { id: "hoohoo-09" } }, "/artworks/hoohoo-09"],
  [{ slug: "", id: "record-03" }, "/artworks/record-03"],
  [{ id: "그림" }, `/artworks/${encodeURIComponent("그림")}`],
  [{ id: NaN }, "/artworks"],
  [{ id: Infinity }, "/artworks"],
  [{ id: -1 }, "/artworks"],
  [{ id: ["record-02"] }, "/artworks"],
  [{ id: "../inquiry" }, "/artworks"],
  [{ id: "x?view=room" }, "/artworks"],
  [{ id: "x/y" }, "/artworks"],
  [{ id: "\uD800" }, "/artworks"],
];
for (const [source, expected] of cases) assert.equal(safeArtworkHref(source), expected);
const cyclic = {};
cyclic.id = cyclic;
assert.equal(safeArtworkHref(cyclic), "/artworks");

const { artworks } = load("../src/lib/artworks.ts");
const { ALL_PLAYLISTS } = load("../src/lib/curator-playlists.ts");
const slugs = new Set(artworks.map((work) => work.slug));
const sequences = new Set();
for (const playlist of ALL_PLAYLISTS) {
  assert.equal(new Set(playlist.slugs).size, playlist.slugs.length, `${playlist.key}: duplicate work`);
  for (const slug of playlist.slugs) assert.ok(slugs.has(slug), `${playlist.key}: unknown artwork ${slug}`);
  assert.ok(playlist.slugs.some((slug) => artworks.find((work) => work.slug === slug).statusKey !== "sold"), `${playlist.key}: empty available selection`);
  sequences.add(playlist.slugs.join(","));
}
assert.equal(sequences.size, ALL_PLAYLISTS.length, "Every playlist needs its own editorial sequence");
console.log(`Passed ${cases.length + 1} route cases and ${ALL_PLAYLISTS.length} editorial playlists.`);
