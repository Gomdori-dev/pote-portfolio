import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 30;

const SITE = "https://potegallery.com";
const BLOB_HOST = "vr4iop7ft7hr1nyt.public.blob.vercel-storage.com";
const WIDTHS = new Set([16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1365, 1536, 1920, 2048, 3840]);
const MAX_BYTES = 15 * 1024 * 1024;

function imageSource(src: string): URL | null {
  try {
    const url = new URL(src, SITE);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash) return null;
    const path = decodeURIComponent(url.pathname);
    if (path.includes("\\") || path.split("/").some((part) => part === "." || part === "..")) return null;
    if (url.hostname === BLOB_HOST) return url;
    if (url.origin === SITE && /^\/(artists|brand|home|rooms|textures)\/.+\.(jpe?g|png|webp|avif|gif)$/i.test(path)) return url;
  } catch {
    // Malformed or unsupported image source.
  }
  return null;
}

function failure(status: number) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = imageSource(params.get("url") ?? "");
  const width = Number(params.get("w"));
  const quality = Number(params.get("q") ?? 75);
  if (!source || !WIDTHS.has(width) || ![75, 85].includes(quality)) return failure(400);

  try {
    // Only our public assets and Blob store are accepted; never follow redirects
    // to an untrusted host or use the visitor's Host header for upstream requests.
    const upstream = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!upstream.ok) return failure(upstream.status === 404 ? 404 : 502);
    if (!upstream.headers.get("content-type")?.startsWith("image/")) return failure(415);
    if (Number(upstream.headers.get("content-length")) > MAX_BYTES) return failure(413);
    if (!upstream.body) return failure(502);
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return failure(413);
      }
      chunks.push(value);
    }
    const image = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: Math.min(width, 2048), height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(image.length),
        "Cache-Control": "public, max-age=86400",
        "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return failure(502);
  }
}
