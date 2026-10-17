// 반별 진도·오늘 수업 첫 화면이 함께 쓰는 문구 계산(순수 함수, DOM 없음).
// 진도 기록은 레슨 단위(아직·진행 중·끝)로만 저장돼요.

export type MarkKey = "none" | "part" | "done";
export type ProgressRows = Record<string, Record<string, string> | undefined>;

export const MARK_WORD: Record<MarkKey, string> = { none: "아직", part: "진행 중", done: "끝" };

/** 반의 한 레슨 기록(없으면 none) */
export function markOf(progress: ProgressRows, klass: string | null, lid: string): MarkKey {
  if (!klass) return "none";
  const v = (progress[klass] || {})[lid];
  return v === "done" || v === "part" ? v : "none";
}

/** 첫 화면 맨 앞 한 줄: "2-3반 I-1 · 아직 시작 전이에요." */
export function statusLine(klass: string | null, code: string, mark: MarkKey): string {
  const who = klass ? klass + "반 " : "";
  if (mark === "done") return who + code + " · 끝난 레슨이에요.";
  if (mark === "part") return who + code + " · 진행 중이에요.";
  return who + code + " · 아직 시작 전이에요.";
}

export interface StartLabel {
  /** 큰 버튼 글자 */
  label: string;
  /** 장면 N/M 안내 */
  sub: string;
  /** true 면 처음 장면부터 열어요 */
  fromStart: boolean;
}

/** 큰 수업 버튼: 끝난 차시면 '처음부터', 중간이면 '이어서 수업'. 분모는 켜진 장면 수 */
export function startLabel(mark: MarkKey, resumeN: number, nOn: number): StartLabel {
  if (mark === "done") return { label: "처음부터", sub: "장면 1/" + nOn + "부터", fromStart: true };
  if (resumeN > 1) return { label: "이어서 수업", sub: "장면 " + resumeN + "/" + nOn + "부터", fromStart: false };
  return { label: "수업 시작", sub: "장면 1/" + nOn + "부터", fromStart: true };
}

/** 반별 진도 한 줄: 기록이 있는 마지막 레슨 기준. "2-3: I-1 진행 중" · "2-4: I-1 끝" · "2-5: 아직 시작 전" */
export function klassNowText(progress: ProgressRows, klass: string, order: readonly string[], codeOf: (id: string) => string): string {
  const row = progress[klass] || {};
  for (let i = order.length - 1; i >= 0; i--) {
    const v = row[order[i]];
    if (v === "done") return klass + ": " + codeOf(order[i]) + " 끝";
    if (v === "part") return klass + ": " + codeOf(order[i]) + " 진행 중";
  }
  return klass + ": 아직 시작 전";
}
