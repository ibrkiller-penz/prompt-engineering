// 원주율 어림하기: 단위원(반지름 1)에 내접·외접하는 정 n각형. 순수 계산.
/** 내접 정 n각형 둘레의 절반 = n sin(π/n)  (원주율보다 작음) */
export const inscribed = (n: number) => n * Math.sin(Math.PI / n);
/** 외접 정 n각형 둘레의 절반 = n tan(π/n)  (원주율보다 큼) */
export const circumscribed = (n: number) => n * Math.tan(Math.PI / n);

/** 아르키메데스의 두 배 늘리기 (삼각함수 없이): 외접은 조화평균, 내접은 기하평균 */
export function doubleStep(a: number, b: number): [number, number] {
  const a2 = (2 * a * b) / (a + b); // 외접 2n
  const b2 = Math.sqrt(a2 * b); // 내접 2n
  return [a2, b2];
}

/** 6각형에서 시작해 두 배씩: [n, 외접, 내접] */
export function archimedesSeries(times = 4): [number, number, number][] {
  let n = 6, a = 2 * Math.sqrt(3), b = 3;
  const out: [number, number, number][] = [[n, a, b]];
  for (let i = 0; i < times; i++) {
    [a, b] = doubleStep(a, b);
    n *= 2;
    out.push([n, a, b]);
  }
  return out;
}

/** 소수 둘째 자리까지 3.14 가 확정: 아래 어림값 ≥ 3.14 이고 위 어림값 < 3.15 */
export const fixes314 = (n: number) => inscribed(n) >= 3.14 && circumscribed(n) < 3.15;
export function minSidesFor314(maxN = 1000): number {
  for (let n = 3; n <= maxN; n++) if (fixes314(n)) return n;
  return -1;
}

/** 위·아래 어림값의 차이 */
export const gap = (n: number) => circumscribed(n) - inscribed(n);
/** 차이가 tol 보다 작아지는 가장 적은 변의 수 */
export function minSidesForGap(tol: number, maxN = 2000): number {
  for (let n = 3; n <= maxN; n++) if (gap(n) < tol) return n;
  return -1;
}

export const fmt = (v: number, d = 5) => v.toFixed(d);
