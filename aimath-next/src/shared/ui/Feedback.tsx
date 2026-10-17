// 정오 알림. 색만이 아니라 ✓/✗ 기호와 글자로 함께 알려요(색을 구별하기 어려운 학생도 알 수 있게).
import type { ReactNode } from "react";

export type FeedbackKind = "ok" | "bad" | "invalid" | "self" | "shown";

const TEXT: Record<FeedbackKind, { mark: string; title: string; cls: string }> = {
  ok: { mark: "✓", title: "맞았어요!", cls: "ok" },
  bad: { mark: "✗", title: "아쉬워요.", cls: "bad" },
  invalid: { mark: "!", title: "답을 알아볼 수 없어요.", cls: "warn" },
  self: { mark: "✎", title: "모범 답안과 견주어 봐요.", cls: "info" },
  shown: { mark: "✓", title: "풀이를 보고 풀었어요.", cls: "info" },
};

export interface FeedbackProps {
  kind: FeedbackKind;
  /** 덧붙이는 말 */
  children?: ReactNode;
}

export function Feedback({ kind, children }: FeedbackProps) {
  const t = TEXT[kind];
  return (
    <div className={"ui-fb is-" + t.cls} role="status" aria-live="polite">
      <span className="ui-fb-mark" aria-hidden="true">
        {t.mark}
      </span>
      <div className="ui-fb-body">
        <strong className="ui-fb-title">{t.title}</strong>
        {children ? <div className="ui-fb-more">{children}</div> : null}
      </div>
    </div>
  );
}
