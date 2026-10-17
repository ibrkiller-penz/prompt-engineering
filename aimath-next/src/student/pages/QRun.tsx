// 학생 문제 한 장: 공용 QuestionCard 에 학생 기록(aimn:s1:q)을 이어 줘요.
// 힌트 1·2 → 풀이 순서로 열고, 일어난 일(답·힌트·풀이)은 모두 기록해요.
// 다시 열 때(복습·오답노트·다시 풀기)는 힌트·풀이를 접은 채로 시작하고, 전에 본 힌트 수만 알려 줘요.
import { useRef, type ReactNode } from "react";
import type { Question } from "../../shared/contracts.ts";
import { QuestionCard, type QEvent } from "../../shared/ui/index.ts";
import { isOk, isTried, recordAnswer, recordHint, recordSolution, useQ } from "../store/index.ts";

export interface QRunProps {
  q: Question;
  label?: ReactNode;
  /** 오늘의 복습 화면에서 푸는 것 */
  review?: boolean;
  /** '새로 더해진 것' 띠 보이기(기본 true, 복습·오답노트에서는 끔) */
  showNew?: boolean;
  after?: ReactNode;
  onDone?: (correct: boolean) => void;
}

/** 전에 남긴 흔적 한 줄(힌트·풀이를 본 적) */
function pastHelp(hints: number, sol: boolean): string {
  if (sol) return "전에 풀이를 본 적이 있어요. 이번엔 혼자 풀어 봐요.";
  if (hints > 0) return "전에 힌트 " + hints + "개를 봤어요.";
  return "";
}

export function QRun({ q, label, review, showNew, after, onDone }: QRunProps) {
  const qm = useQ();
  const rec = qm[q.id];
  // 처음 연 때의 기록으로 안내를 정해요(푸는 동안 바뀌어도 흔들리지 않게)
  const first = useRef(rec);
  const r0 = first.current;
  // 복습 단계는 첫 답으로만 올리거나 내려요(틀린 뒤 다시 맞혀도 '내일 다시'는 그대로)
  const firstDone = useRef(false);
  const answer = (qid: string, ok: boolean, afterSolution: boolean) => {
    const asReview = !!review && !firstDone.current;
    firstDone.current = true;
    recordAnswer(qid, ok, { review: asReview, afterSolution });
    if (onDone) onDone(ok && !afterSolution);
  };
  const onResult = (e: QEvent) => {
    if (e.type === "attempt") answer(e.qid, e.correct, e.afterSolution);
    else if (e.type === "self") answer(e.qid, e.ok, e.afterSolution);
    else if (e.type === "hint") recordHint(e.qid, e.level);
    else if (e.type === "solution") recordSolution(e.qid);
  };
  const help = r0 ? pastHelp(r0.hints, r0.sol) : "";
  const showPrev = !!r0 && isTried(r0) && !review;
  return (
    <div className="s-q">
      {showPrev || help ? (
        <p className="s-q-prev small">
          {showPrev && r0 ? (
            isOk(r0) ? (
              <span className="verdict ok">전에 맞혔어요</span>
            ) : (
              <span className="chip">전에 풀어 봤어요{r0.wrong ? " · 틀린 횟수 " + r0.wrong : ""}</span>
            )
          ) : null}
          {showPrev && help ? " " : null}
          {help ? <span className="muted s-q-help">{help}</span> : null}
        </p>
      ) : null}
      <QuestionCard key={q.id} q={q} surface="phone" label={label} initialLevel={0} showNew={showNew !== false} onResult={onResult} after={after} />
    </div>
  );
}
