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

/** 어린이용 표시: 아래 값은 내림, 위 값은 올림으로 소수 둘째 자리까지 (참인 말만 하도록) */
export const floor2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;
export const ceil2 = (v: number) => Math.ceil(v * 100 - 1e-9) / 100;

/** 미션 종류: gap=차이를 gap 보다 작게, is314=3.14~3.15 사이로, minGap=차이가 minGap 보다 작아지는 가장 적은 변 맞히기, min314=3.14~3.15 사이가 되는 가장 적은 변 맞히기 */
export type Mission = { gap?: number; is314?: boolean; minGap?: number; min314?: boolean };
export const MISSIONS: Mission[] = [{ gap: 0.2 }, { gap: 0.05 }, { gap: 0.02 }, { gap: 0.005 }, { is314: true }];

/** 레벨 1~10, 레벨마다 라운드 3개 */
export const LEVEL_MISSIONS: Mission[][] = [
  [{ gap: 0.2 }, { gap: 0.05 }, { gap: 0.02 }],
  [{ gap: 0.2 }, { gap: 0.02 }, { is314: true }],
  [{ gap: 0.1 }, { gap: 0.01 }, { gap: 0.005 }],
  [{ gap: 0.05 }, { gap: 0.005 }, { is314: true }],
  [{ gap: 0.02 }, { minGap: 0.3 }, { is314: true }],
  [{ gap: 0.01 }, { minGap: 0.2 }, { gap: 0.002 }],
  [{ minGap: 0.2 }, { minGap: 0.1 }, { is314: true }],
  [{ minGap: 0.1 }, { gap: 0.002 }, { minGap: 0.05 }],
  [{ minGap: 0.05 }, { minGap: 0.02 }, { is314: true }],
  [{ minGap: 0.02 }, { minGap: 0.01 }, { min314: true }],
];
export const missionsFor = (level: number) => LEVEL_MISSIONS[Math.max(1, Math.min(10, level)) - 1];
export const isMinMission = (m: Mission) => m.minGap !== undefined || !!m.min314;
/** ‘가장 적은 변’ 미션의 정답 */
export const minTarget = (m: Mission) => (m.min314 ? minSidesFor314() : minSidesForGap(m.minGap as number));
/** 3.14~3.15 사이: 아래 ≥ 3.14, 위 ≤ 3.15 */
export const in314 = (n: number) => inscribed(n) >= 3.14 && circumscribed(n) <= 3.15;
/** 바로 판정하는 미션(gap, is314)이 이 n 에서 성공인가 */
export function missionOkM(m: Mission, n: number): boolean {
  if (m.is314) return in314(n);
  if (m.gap !== undefined) return gap(n) < m.gap;
  return false;
}
export function missionOk(i: number, n: number): boolean {
  return missionOkM(MISSIONS[i], n);
}
