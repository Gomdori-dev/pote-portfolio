import type { NextConfig } from "next";

/**
 * Every address the site answers on, other than the canonical one, is sent to
 * the canonical one. Serving the same pages on potegallery.com,
 * www.potegallery.com and pote-gallery.vercel.app would be the duplicate-content
 * problem that kept the inner pages out of Naver's index, only at the domain
 * level. 308 so the move is permanent and search engines pass the old address's
 * standing along.
 */
const ALIAS_HOSTS = ["www.potegallery.com", "pote-gallery.vercel.app"];

// Free baseline hardening: no framing by other sites (clickjacking), no MIME
// sniffing, no full URLs leaked to other sites, and no camera/mic/location
// prompts. A full Content-Security-Policy is left out on purpose; the BGM,
// analytics and inline JSON-LD would all need auditing first.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Next 16 shows a floating "N" route indicator in development. Hide it so
  // local previews look the same as the public gallery.
  devIndicators: false,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Resize cards for the viewport. The texture viewer and "open image" link are
    // capped at 2048px by /api/display-image so the original file never shows.
    qualities: [75, 85],
    // One day instead of the 4-hour default, so the free image-optimization
    // quota lasts. There is no purge: replacing a public/ photo under the same
    // file name can show the old one for up to a day, so rename the file.
    minimumCacheTTL: 86400,
    // Next defaults plus 1365/1536, so portrait photos can be capped at a 2048px long edge.
    deviceSizes: [640, 750, 828, 1080, 1200, 1365, 1536, 1920, 2048, 3840],
    remotePatterns: [
      new URL("https://vr4iop7ft7hr1nyt.public.blob.vercel-storage.com/**"),
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return ALIAS_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://potegallery.com/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;
