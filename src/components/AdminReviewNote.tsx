import type { AiReview } from "@/lib/artwork-review";

/** 자동 검토 결과 상자 — /admin/submissions 카드와 /admin/quick-approve가 같이 쓴다. */
export default function AdminReviewNote({ review, pending = false, note }: { review?: AiReview | null; pending?: boolean; note?: string | null }) {
  const issues = review?.issues.filter((issue) => issue.trim()).map((issue) =>
    issue === "현재 작품 상태는 작가 확인이 필요해요."
      ? "작품 상태가 ‘확인 필요’로 등록되어 있어요. 작가에게 흠·손상·수리 이력이 있는지 확인해야 해요."
      : issue,
  ) ?? [];
  const title = !review ? "자동 검토 결과 없음"
    : review.phase === "running" ? "자동 검토 진행 중"
    : review.phase === "failed" ? "자동 검토 실패"
    : review.verdict === "pass" ? "✅ 자동 검토 통과" : "⚠️ 확인 필요";
  const reason = !review ? "자동 검토 결과가 아직 기록되지 않아 운영자 확인을 기다리고 있어요."
    : review.phase === "running" ? "자동 검토가 시작된 상태예요. 결과가 기록될 때까지 승인을 기다리고 있어요."
    : review.phase === "failed" ? "자동 검토를 완료하지 못해 사진과 작품 정보를 직접 확인해야 해요."
    : review.verdict === "pass" ? "자동 검토는 통과했지만 운영자의 최종 승인이 아직 없어 전시되지 않았어요."
    : issues.length ? issues.join("\n")
    : "구체적인 확인 사유가 기록되지 않았어요. 사진과 작품 정보를 직접 확인해 주세요.";
  const issuesInReason = pending && review?.verdict === "hold" && review.phase !== "running" && review.phase !== "failed";

  return (
    <div className={`adm-review adm-review-${review?.verdict ?? "hold"}`}>
      <strong>{pending ? `대기 사유 · ${title}` : title}</strong>
      {pending || !review ? <p className="adm-review-reason">{pending ? reason : "저장된 자동 검토 결과가 없어요."}</p> : null}
      {issues.length && !issuesInReason ? (
        <ul>
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      ) : null}
      {note?.trim() ? <p className="adm-review-reason">운영 메모: {note}</p> : null}
      {review?.filled.length ? <small>자동으로 채움: {review.filled.join(", ")}</small> : null}
    </div>
  );
}
