import { readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

// Next can reuse SQL HTTP responses from earlier builds. The route list is
// generated from fresh rows, but cached catalog rows can then render those
// newly approved artwork pages as 404. Discard only Neon fetch responses.
const cacheDir = join(process.cwd(), ".next", "cache", "fetch-cache");
let removed = 0;
let entries = [];
try {
  entries = await readdir(cacheDir, { withFileTypes: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const entry of entries) {
  if (!entry.isFile()) continue;
  const file = join(cacheDir, entry.name);
  let isCatalog = false;
  try {
    const cached = JSON.parse(await readFile(file, "utf8"));
    const url = new URL(cached.data?.url);
    isCatalog = url.protocol === "https:" && url.hostname.endsWith(".neon.tech");
  } catch {
    // Other cache formats are unrelated to SQL and remain untouched.
  }
  if (isCatalog) {
    await unlink(file);
    removed++;
  }
}
console.log(`catalog-build-cache: cleared ${removed} SQL responses`);
