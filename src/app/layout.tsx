import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageProvider } from "@/lib/i18n";
import { SiteBgm } from "@/components/SiteBgm";
import { ImageGuard } from "@/components/ImageGuard";
import { SourceCapture } from "@/components/SourceCapture";
import { VisitLogger } from "@/components/VisitLogger";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

// The brand first: "POTE | …" left "포트 갤러리" out of the home page's title, so
// a search for the gallery's own name had nothing to match (10/30 review).
const HOME_TITLE = "포트 갤러리 | 신진 작가의 오리지널 원화 · Pote Gallery";
const HOME_DESCRIPTION = "신진 작가의 오리지널 원화를 소개하는 서울의 온라인 갤러리. 작가가 정한 가격 그대로, 작가에게 직접 구매 문의할 수 있습니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    // 공유 카드는 브랜드 카드를 쓴다. 예전에는 「어해도 1」을 걸었는데, 링크를
    // 받은 사람에게는 맥락 없는 게 한 마리로 보일 뿐 갤러리라는 신호가 없었다.
    // 1200x630은 페이스북·카카오톡·스레드가 공통으로 기대하는 크기다.
    images: [{ url: "/brand/pote-gallery-og-card.png", width: 1200, height: 630, alt: "포트 갤러리 | Pote Gallery — 온라인 갤러리" }],
  },
  // 검색엔진 소유확인. 값은 주소마다 다르므로, 도메인을 옮기면 각 콘솔에서 사이트를
  // 새로 등록하고 여기 값을 갈아끼워야 한다.
  // Google은 두 값: 처음 값은 발급 계정을 확인하지 못했으므로 그 인증을 깨지 않게
  // 남기고, 두 번째는 poteart.gallery@gmail.com의 Search Console 속성용이다(10/20).
  verification: {
    google: ["vifaUH485oxnQJ3sMJPmqoLVnzrdAvBg2xir3y5h1Fw", "pOU4RhVGFRCRai4-mXBZvshD1RZ5t31rqVMDTqgVSr8"],
    other: { "naver-site-verification": "361f7d76c093f138c9f70ce85764fc927af16a17" },
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/brand/pote-gallery-og-card.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>
          <SiteBgm>{children}</SiteBgm>
        </LanguageProvider>
        <Suspense fallback={null}>
          <VisitLogger />
        </Suspense>
        <ImageGuard />
        <SourceCapture />
        <Analytics />
      </body>
    </html>
  );
}
