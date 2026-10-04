import { rules } from "../../content/load";

/** 점수 대신 "잘한 점 1개 + 더 해 볼 것 1개" */
export function FeedbackBox({ good, next, privacy = [] }: { good: string; next: string; privacy?: string[] }) {
  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      {privacy.length > 0 && <PrivacyWarning labels={privacy} />}
      {good && (
        <p className="rounded-card bg-ok-soft p-3 text-ok">
          <strong>잘한 점</strong> · {good}
        </p>
      )}
      {next && !privacy.length && (
        <p className="rounded-card bg-warn-soft p-3 text-warn">
          <strong>더 해 볼 것</strong> · {next}
        </p>
      )}
    </div>
  );
}

export function PrivacyWarning({ labels }: { labels: string[] }) {
  return (
    <p role="alert" className="rounded-card border-2 border-bad bg-bad-soft p-3 font-semibold text-bad">
      ⚠ {rules.privacy.message} <span className="font-normal">({labels.join(", ")}로 보이는 말이 있어요)</span>
    </p>
  );
}

export function HelperNote() {
  return <p className="text-xs text-muted">이 점검은 도우미일 뿐, 판단은 내가 해요.</p>;
}
