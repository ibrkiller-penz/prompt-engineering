// 학생 문제 한 장: 공용 QuestionCard 에 학생 기록(aimn:s1:q)을 이어 줘요.
// 힌트 1·2 → 풀이 순서로 열고, 일어난 일(답·힌트·풀이)은 모두 기록해요.
// 다시 열 때(복습·오답노트·다시 풀기)는 힌트·풀이를 접은 채로 시작하고, 전에 본 힌트 수만 알려 줘요.
import { useRef, useState, type ReactNode } from "react";
import type { Question } from "../../shared/contracts.ts";
import { QuestionCard, type QEvent } from "../../shared/ui/index.ts";
import { navigate } from "../../shared/router/index.ts";
import { isTried, lessonOfQ, recordAnswer, recordHint, recordSolution, useQ } from "../store/index.ts";
import { prevNote } from "./student.logic.ts";
import { clearDraft, enterDraftScope, loadDraft, saveDraft } from "./draft.logic.ts";
import { sectionOfQ } from "./useQuestions.ts";

export interface QRunProps {
  q: Question;
  label?: ReactNode;
  /** 오늘의 복습 화면에서 푸는 것 */
  review?: boolean;
  /** '새로 더해진 것' 띠 보이기(기본 true, 복습·오답노트에서는 끔) */
  showNew?: boolean;
  /** 예전 호환용(쓰지 않아요. 다음 단추는 하단바 것만 남겨요) */
  after?: ReactNode;
  onDone?: (correct: boolean) => void;
}

/** 전에 남긴 흔적 한 줄(힌트·풀이를 본 적) */
function pastHelp(hints: number, sol: boolean): string {
  if (sol) return "전에 풀이를 본 적이 있어요. 이번엔 혼자 풀어 봐요.";
  if (hints > 0) return "전에 힌트 " + hints + "개를 봤어요.";
  return "";
}

export function QRun({ q, label, review, showNew, onDone }: QRunProps) {
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
  // 이번에 낸 답(처음 화면에서는 null). 다른 문제로 바뀌면 무시해요
  const [sub, setSub] = useState<{ qid: string; correct: boolean } | null>(null);
  const mine = sub && sub.qid === q.id ? sub : null;
  // 오답 뒤 '이 개념 다시 보기': 문제가 나온 개념 카드로 가요(오답노트와 같은 연결). 연결이 없으면 단추를 숨겨요
  const lid = lessonOfQ(q.id);
  const sec = lid ? sectionOfQ(lid, q.id) : -1;
  const onConcept = lid && sec >= 0 ? () => navigate("/l/" + lid + "/s/c" + (sec + 1) + "/1") : undefined;
  const onResult = (e: QEvent) => {
    if (e.type === "answered") {
      setSub({ qid: e.qid, correct: e.correct });
      if (e.correct) clearDraft(e.qid); // 맞히면 보관해 둔 입력은 비워요
    }
    if (e.type === "attempt") answer(e.qid, e.correct, e.afterSolution);
    else if (e.type === "self") answer(e.qid, e.ok, e.afterSolution);
    else if (e.type === "hint") recordHint(e.qid, e.level);
    else if (e.type === "solution") recordSolution(e.qid);
  };
  const help0 = r0 ? pastHelp(r0.hints, r0.sol) : "";
  // 복습 화면의 '전에 힌트를 봤어요'는 제출 뒤에만 보여요
  const help = review && !mine ? "" : help0;
  // '이번에는 다른 답이었어요…'는 제출 뒤 오답일 때만, 오답 안내 박스 안(wrongExtra)에 보여요(제출 전에는 '맞혔어요'류 표시를 절대 안 내요)
  const note = review || !mine ? null : prevNote(r0, !!r0 && isTried(r0), mine);
  // 입력 보관(메모리만): 레슨이 바뀌면 비우고, '이 개념 다시 보기'에서 돌아오면 이전 선택만 되살려요
  enterDraftScope(lid || "");
  const d0 = useRef(loadDraft(q.id)).current;
  return (
    <div className="s-q">
      {help ? (
        <p className="s-q-prev small">
          <span className="muted s-q-help">{help}</span>
        </p>
      ) : null}
      <QuestionCard key={q.id} q={q} surface="phone" label={label} initialLevel={0} initialPick={d0 ? d0.pick : null} initialText={d0 ? d0.text : ""} onDraft={(d) => saveDraft(q.id, d)} showNew={showNew !== false} onResult={onResult} onConcept={onConcept} conceptNo={sec >= 0 ? sec + 1 : 0} wrongExtra={note ? note.text : undefined} />
      {/* 다음 문제 단추는 하단바 것만 써요(카드 안에는 두지 않아요) */}
    </div>
  );
}
