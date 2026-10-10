// 로그 자 계산 (순수 함수)
/** 1~10 눈금의 위치(0~1). 길이는 log10(v)에 비례해요. */
export const logPos = (v: number) => Math.log10(v);
/** 위치(0~1)에서 눈금 값 */
export const valueAt = (p: number) => Math.pow(10, p);
/** 아래 자의 1을 위 자의 a 에 맞출 때 아래 자의 밀림(길이 단위) */
export const offsetFor = (a: number) => Math.log10(a);
/** 아래 자가 d 만큼 밀렸을 때, 아래 자의 b 와 마주 보는 위 눈금 값. 위 자 범위(1~10)를 넘으면 null */
export function readingAt(d: number, b: number): number | null {
  const p = d + Math.log10(b);
  if (p < -1e-12 || p > 1 + 1e-12) return null;
  return valueAt(p);
}
/** 허용 오차 비율 안에 있는지 */
export const within = (ans: number, truth: number, tol = 0.03) => Number.isFinite(ans) && truth !== 0 && Math.abs(ans - truth) / Math.abs(truth) <= tol;
/** 자리 이동을 뺀 가수(1 이상 10 미만)로 바꾸기 */
export function mantissa(x: number): number {
  let m = x;
  while (m >= 10) m /= 10;
  while (m < 1) m *= 10;
  return m;
}

/** 레벨별 문제 묶음: A=곱이 10 미만 쉬운 수, B=소수점 수(곱 10 미만), C=곱이 10 이상(자리 옮기기) */
export const SR_A: [number, number][] = [[2, 3], [2, 4], [3, 3], [1.5, 4], [2, 2.5], [1.5, 3], [2, 4.5], [3, 2.5], [1.5, 6], [2, 3.5]];
export const SR_B: [number, number][] = [[2.5, 3.2], [1.2, 5], [2.2, 3], [1.8, 4], [3.5, 2], [1.6, 5.5], [2.4, 3.5], [1.25, 6], [1.4, 4.5], [2.8, 3]];
export const SR_C: [number, number][] = [[4, 5], [3.5, 4], [6, 2.5], [8, 1.5], [4.5, 3], [7, 2.2], [5.5, 3], [9, 1.8], [2.5, 4.4], [3.2, 6.5]];
export function srProblems(level: number, rnd: () => number = Math.random): [number, number][] {
  const L = Math.min(10, Math.max(1, Math.round(level)));
  const plan = L <= 3 ? "AAA" : L <= 6 ? "BBB" : L === 7 ? "BBC" : L === 8 ? "BCC" : "CCC";
  const pools: Record<string, [number, number][]> = { A: [...SR_A], B: [...SR_B], C: [...SR_C] };
  return plan.split("").map((p) => pools[p].splice(Math.floor(rnd() * pools[p].length), 1)[0]);
}
