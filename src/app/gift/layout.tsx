import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "선물하기 좋은 원화 — 50만 원 이하 | 포트 갤러리",
  description: "집들이·기념일·연말 선물로 좋은 50만 원 이하 원화. 신진 작가가 직접 정한 가격 그대로, 작가가 받는 분께 바로 보내요.",
  path: "/gift",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
