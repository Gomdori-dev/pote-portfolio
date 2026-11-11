// Fails the build if any source text contains U+FFFD (the "�" replacement
// character). It appears when a file is re-saved through the wrong encoding,
// and two of them once shipped to /guide ("��락은" instead of "연락은").
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "public/data"];
const TEXT = /\.(tsx?|jsx?|mjs|css|json|md|txt)$/;
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.test(name)) {
      readFileSync(path, "utf8").split("\n").forEach((line, i) => {
        if (line.includes("\uFFFD")) bad.push(`${path}:${i + 1}`);
      });
    }
  }
}

ROOTS.forEach(walk);
if (bad.length) {
  console.error(`Broken characters (U+FFFD) found:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
console.log("check-text: no broken characters");
