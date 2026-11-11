import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate-limit";

// Client-side upload target for /apply's portfolio dropzone. Files can be up
// to 50MB (a zip of images, or a PDF deck), which is well past what a
// serverless function's own request body can carry — the browser uploads
// straight to Blob storage using a token minted here, then submits the
// resulting URL as part of the regular /api/contact email.
//
// This uses the *presigned* client-upload flow (issueSignedToken +
// handleUploadPresigned), not the classic handleUpload/generateClientToken
// one — this project's Blob store only has OIDC-based auth (BLOB_STORE_ID +
// Vercel's auto-injected VERCEL_OIDC_TOKEN) wired up, no BLOB_READ_WRITE_TOKEN
// env var, and only the presigned flow accepts OIDC for minting tokens.
const ALLOWED_CONTENT_TYPES = ["application/pdf", "application/zip", "image/png", "image/jpeg"];
const MAX_PORTFOLIO_BYTES = 50 * 1024 * 1024;
// PortfolioUpload always sends `applications/<file name>`; anything else is
// someone using the store as free file hosting.
const PORTFOLIO_PATH = /^applications\/[^\/*]{1,200}$/;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  if (!allow(`portfolio:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!PORTFOLIO_PATH.test(pathname)) throw new Error("invalid_pathname");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_PORTFOLIO_BYTES,
        });
        return { token, urlOptions: { addRandomSuffix: true } };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("portfolio upload token failed", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 400 });
  }
}
