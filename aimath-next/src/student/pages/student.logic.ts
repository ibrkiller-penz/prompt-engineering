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
