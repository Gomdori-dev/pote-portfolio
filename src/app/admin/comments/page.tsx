"use client";

// 운영자 전용 "한 줄 감상" 검토 화면(알림 메일의 링크). 관리자 대시보드에도 같은 칸이 있다.
// /admin/submissions와 같은 관리자 비밀번호(브라우저에 저장된 값 또는 로그인 쿠키)를 쓴다.

import { useCallback } from "react";
import Link from "next/link";
import { AdminCommentsBoard } from "@/components/AdminCommentsBoard";

const STORAGE_KEY = "pote_admin_key";

export default function AdminCommentsPage() {
  const headers = useCallback((): HeadersInit => {
    try {
      const key = localStorage.getItem(STORAGE_KEY);
      return key ? { "x-admin-password": key } : {};
    } catch {
      return {};
    }
  }, []);
  return <main className="admin-comments">
    <p><Link href="/admin/submissions">← 관리자 화면</Link></p>
    <AdminCommentsBoard headers={headers} />
  </main>;
}
