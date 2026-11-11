import sharp from "sharp";

const files = [
  "eohaedo-1.jpg",
  "relationship-and-connection.jpg",
  "pomegranate.jpg",
  "dream-catcher.jpg",
  "eohaedo-2.jpg",
  "pearl-01.jpg",
  "pearl-02.jpg",
  "warmest-color-blue.jpg",
];

const dir = "public/artists/jihyeseung";
const outDir = process.argv[2] || dir;
const THRESH = 0.6;
const RUN = 15;
const STEP = 4;

const isWhite = (r, g, b) => r > 240 && g > 240 && b > 240;

for (const name of files) {
  const p = `${dir}/${name}`;
  const { data, info } = await sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const rowWhiteFrac = (y) => {
    let white = 0, n = 0;
    for (let x = 0; x < width; x += STEP) {
      const i = (y * width + x) * channels;
      if (isWhite(data[i], data[i + 1], data[i + 2])) white++;
      n++;
    }
    return white / n;
  };
  const colWhiteFrac = (x) => {
    let white = 0, n = 0;
    for (let y = 0; y < height; y += STEP) {
      const i = (y * width + x) * channels;
      if (isWhite(data[i], data[i + 1], data[i + 2])) white++;
      n++;
    }
    return white / n;
  };

  const findEdge = (total, fracFn, dir) => {
    const range = dir === "fwd" ? Array.from({ length: total }, (_, i) => i) : Array.from({ length: total }, (_, i) => total - 1 - i);
    for (const idx of range) {
      if (fracFn(idx) <= THRESH) {
        let sustained = true;
        for (let s = 1; s <= RUN; s++) {
          const next = dir === "fwd" ? idx + s : idx - s;
          if (next < 0 || next >= total) continue;
          if (fracFn(next) > THRESH) { sustained = false; break; }
        }
        if (sustained) return idx;
      }
    }
    return dir === "fwd" ? 0 : total - 1;
  };

  const top = findEdge(height, rowWhiteFrac, "fwd");
  const bottom = findEdge(height, rowWhiteFrac, "bwd");
  const left = findEdge(width, colWhiteFrac, "fwd");
  const right = findEdge(width, colWhiteFrac, "bwd");

  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  await sharp(p).extract(crop).jpeg({ quality: 92 }).toFile(`${outDir}/${name}`);
  console.log(name, "orig", width, height, "-> crop", JSON.stringify(crop));
}
