import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "계절 기획전 — 이번 계절의 원화 | 포트 갤러리",
  description: "봄·여름·가을·겨울마다 바뀌는 포트 갤러리 기획전. 계절의 색이 도는 신진 작가 원화를 모았습니다.",
  path: "/event",
});

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
