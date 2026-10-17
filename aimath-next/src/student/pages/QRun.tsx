// 학생 문제 한 장: 공용 QuestionCard 에 학생 기록(aimn:s1:q)을 이어 줘요.
// 힌트 1·2 → 풀이 순서로 열고, 일어난 일(답·힌트·풀이)은 모두 기록해요.
import { useRef, type ReactNode } from "react";
import type { Question } from "../../shared/contracts.ts";
import { QuestionCard, type QEvent } from "../../shared/ui/index.ts";
import { isOk, isTried, recordAnswer, recordHint, recordSolution, useQ } from "../store/index.ts";

export interface QRunProps {
  q: Question;
  label?: ReactNode;
  /** 오늘의 복습 화면에서 푸는 것 */
  review?: boolean;
  after?: ReactNode;
  onDone?: (correct: boolean) => void;
}

export function QRun({ q, label, review, after, onDone }: QRunProps) {
  const qm = useQ();
  const rec = qm[q.id];
  const init: 0 | 1 | 2 | 3 = rec ? (rec.sol ? 3 : rec.hints) : 0;
  // 복습 단계는 첫 답으로만 올리거나 내려요(틀린 뒤 다시 맞혀도 '내일 다시'는 그대로)
  const firstDone = useRef(false);
  const answer = (qid: string, ok: boolean) => {
    const asReview = !!review && !firstDone.current;
    firstDone.current = true;
    recordAnswer(qid, ok, { review: asReview });
    if (onDone) onDone(ok);
  };
  const onResult = (e: QEvent) => {
    if (e.type === "attempt") answer(e.qid, e.correct);
    else if (e.type === "self") {
      answer(e.qid, e.ok);
    } else if (e.type === "hint") recordHint(e.qid, e.level);
    else if (e.type === "solution") recordSolution(e.qid);
  };
  return (
    <div className="s-q">
      {rec && isTried(rec) && !review ? (
        <p className="s-q-prev small">
          {isOk(rec) ? <span className="verdict ok">전에 맞혔어요</span> : <span className="chip">전에 풀어 봤어요{rec.wrong ? " · 틀린 횟수 " + rec.wrong : ""}</span>}
        </p>
      ) : null}
      <QuestionCard key={q.id} q={q} surface="phone" label={label} initialLevel={init} onResult={onResult} after={after} />
    </div>
  );
}
