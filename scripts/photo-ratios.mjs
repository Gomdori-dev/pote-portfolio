// Writes src/lib/photo-ratios.json: width / height of every static artwork's
// main photo, keyed by its public path. The homepage hangs a landscape photo
// in its gallery-wall hero, and the canvas size in `details` cannot tell us
// the photo's shape (most are written 세로 × 가로), so it reads the files.
//
// Runs before every build. If sharp is unavailable it keeps the committed file
// rather than failing the build; works missing from the file simply are not
// picked for the hero.
import fs from "node:fs";
import path from "node:path";

const OUT = "src/lib/photo-ratios.json";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("photo-ratios: sharp not available, keeping", OUT);
  process.exit(0);
}

const source = fs.readFileSync("src/lib/artworks.ts", "utf8");
const images = [...new Set([...source.matchAll(/\bimage:\s*"(\/[^"]+)"/g)].map((match) => match[1]))];
const ratios = {};
for (const image of images) {
  try {
    const { width, height, orientation } = await sharp(path.join("public", image)).metadata();
    if (!width || !height) continue;
    // EXIF orientations 5–8 are displayed rotated a quarter turn.
    const ratio = (orientation ?? 1) >= 5 ? height / width : width / height;
    ratios[image] = Math.round(ratio * 1000) / 1000;
  } catch {
    // Missing or unreadable file: leave it out.
  }
}

const sorted = Object.fromEntries(Object.entries(ratios).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`photo-ratios: ${Object.keys(sorted).length}/${images.length} photos`);
