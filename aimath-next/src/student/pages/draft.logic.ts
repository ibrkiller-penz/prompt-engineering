// 풀던 문제의 입력 상태(고른 답·적은 글)를 메모리(모듈 변수) 안에서만 들고 있어요.
// '이 개념 다시 보기'로 개념 카드에 다녀와도 고른 답과 적은 글이 남게 하려는 것이에요.
//   - localStorage 도, 새 저장 키도 쓰지 않아요(새로고침하면 사라져요).
//   - 다른 범위(레슨)로 들어가거나 문제를 맞히면 비워요.
// 돌아온 문제는 정답 처리하지 않고, 이전 선택만 표시해요.
export interface Draft {
  /** 고른 답(고르기 번호 · OX true/false), 안 골랐으면 null */
  pick: number | boolean | null;
  /** 적은 글(숫자 답·서술형) */
  text: string;
}

let scope = "";
let store: Record<string, Draft> = {};

/** 문제 하나의 입력 상태를 저장해요. 아무것도 없으면(안 고르고 빈 글) 지워요 */
export function saveDraft(qid: string, d: Draft): void {
  if (d.pick === null && !d.text) {
    delete store[qid];
    return;
  }
  store[qid] = { pick: d.pick, text: d.text };
}

/** 저장된 입력 상태(복사본). 없으면 undefined */
export function loadDraft(qid: string): Draft | undefined {
  const d = store[qid];
  return d ? { pick: d.pick, text: d.text } : undefined;
}

/** 문제 하나를 비워요(맞혔을 때) */
export function clearDraft(qid: string): void {
  delete store[qid];
}

/** 전부 비워요 */
export function clearAllDrafts(): void {
  store = {};
}

/** 범위(레슨 번호)에 들어가요. 이전 범위와 다르면 전부 비워요 */
export function enterDraftScope(next: string): void {
  if (next !== scope) {
    store = {};
    scope = next;
  }
}

/** 지금 저장된 문제 수(시험용) */
export function draftCount(): number {
  return Object.keys(store).length;
}
