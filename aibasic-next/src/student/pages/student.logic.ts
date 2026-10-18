// 학생 화면에서 쓰는 작은 계산. 순수 함수(DOM·저장소 없음).

/** 단원 마무리 도전 별(0~3). 모두 풀어 봐야 별을 받아요: 60% 이상 ★, 80% 이상 ★★, 모두 맞힘 ★★★ */
export function challengeStars(t: { total: number; tried: number; ok: number }): 0 | 1 | 2 | 3 {
  if (!t.total || t.tried < t.total) return 0;
  const r = t.ok / t.total;
  if (r >= 1) return 3;
  if (r >= 0.8) return 2;
  if (r >= 0.6) return 1;
  return 0;
}

export function starText(n: number, max = 3): string {
  let s = "";
  for (let i = 0; i < max; i++) s += i < n ? "★" : "☆";
  return s;
}

/** "3일 뒤", "오늘", "내일" */
export function dueText(days: number): string {
  if (days <= 0) return "오늘";
  if (days === 1) return "내일";
  return days + "일 뒤";
}

/** 오답노트 카드의 '다음 복습 때' 한 줄. days < 0 이면 날짜 없음 */
export function nextReviewText(state: "todo" | "reviewing" | "graduated", days: number): string {
  if (state === "graduated") return "다 익혔어요. 이제 복습에 나오지 않아요.";
  if (days < 0) return "다시 풀어 맞히면 복습 일정이 잡혀요.";
  if (days === 0) return "오늘의 복습에 나와요.";
  if (days === 1) return "내일 다시 나와요.";
  return days + "일 뒤 다시 나와요.";
}

/** 레슨 순서에서 from 다음(from 은 빼고)으로 아직 완료하지 않은 첫 레슨. 뒤에 없으면 앞에서 찾고, 모두 완료면 null.
 *  from 이 없으면 처음부터 찾아요. skipFrom=false 면 from 자신도 후보예요. */
export function nextLessonAfter(order: readonly string[], from: string | null, isComplete: (lid: string) => boolean, skipFrom = true): string | null {
  const at = from ? order.indexOf(from) : -1;
  const n = order.length;
  if (!n) return null;
  const start = at < 0 ? 0 : skipFrom ? at + 1 : at;
  for (let k = 0; k < n; k++) {
    const lid = order[(start + k) % n];
    if (skipFrom && lid === from) continue;
    if (!isComplete(lid)) return lid;
  }
  return null;
}

/** '이어서 공부하기' 경로("/l/u1_1_2/s/c2/3", "/l/u1_1_2/q")에서 레슨 id */
export function lessonOfPath(path: string | null | undefined): string | null {
  const m = /^\/l\/(u\d+_\w+)(?:\/|$|\?)/.exec(String(path || ""));
  return m ? m[1] : null;
}

/** 쿼리의 카드 번호(1부터)를 0부터로. 범위 밖이면 맞춰요 */
export function cardIndex(v: string | undefined, total: number): number {
  const n = v && /^\d+$/.test(v) ? parseInt(v, 10) : 1;
  return Math.max(0, Math.min(Math.max(0, total - 1), n - 1));
}

/** 퍼센트(0~100, 반올림) */
export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

/** 목록에 보일 짧은 문제 글(수식·굵게가 잘리지 않게 $·** 짝을 맞춰 잘라요) */
export function shortPrompt(s: string, max = 40): string {
  const one = String(s || "").split("\n")[0];
  if (one.length <= max) return one;
  let cut = one.slice(0, max);
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  if ((cut.match(/\*\*/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("**"));
  return cut.replace(/\s+$/, "") + "…";
}

/** 문제 세트 결과 한 줄: "9문제 중 8문제 맞혔어요" */
export function resultLine(total: number, ok: number): string {
  return total + "문제 중 " + ok + "문제 맞혔어요";
}

/** 지난번(이 세트를 열기 전)보다 맞힌 문제가 늘었을 때만 한 줄. 늘지 않았으면 "" */
export function gainLine(before: number, now: number): string {
  const d = now - before;
  return d > 0 ? "지난번보다 " + d + "문제 더 맞혔어요" : "";
}

/** 오늘(기기 시계 기준 0시 이후) 마지막으로 제출한 문제 수 — 기존 기록(t1)만 읽어요 */
export function solvedToday(qm: Record<string, { t1?: number; wrong?: number; first?: boolean | null; ok?: boolean }>, now: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let n = 0;
  for (const id of Object.keys(qm)) {
    const r = qm[id];
    if (r && typeof r.t1 === "number" && r.t1 >= start) n++;
  }
  return n;
}

/** 문제 위쪽 '지난번' 표시. rec = 처음 연 때의 기록, submitted = 이번에 낸 답(없으면 null)
 *  처음 푸는 문제는 표시 없음 · 제출 전: 맞힌 적 있으면 '지난번에 맞혔어요' · 제출 뒤 틀리면 '이번에는 다른 답이었어요. 조건을 다시 볼까요?' */
export function prevNote(rec: { ok?: boolean; wrong?: number; first?: boolean | null; sol?: boolean } | undefined, tried: boolean, submitted: { correct: boolean } | null): { kind: "ok" | "tried" | "diff"; text: string } | null {
  if (!rec || !tried) return null;
  if (submitted) {
    return rec.ok && !submitted.correct ? { kind: "diff", text: "이번에는 다른 답이었어요. 조건을 다시 볼까요?" } : null;
  }
  if (rec.ok) return { kind: "ok", text: "지난번에 맞혔어요" };
  return { kind: "tried", text: "지난번에 풀어 봤어요" + (rec.wrong ? " · 다시 본 횟수 " + rec.wrong : "") };
}
