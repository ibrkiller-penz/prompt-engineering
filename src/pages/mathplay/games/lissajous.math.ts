// 리사주 도형: 순수 계산
export type Pt = [number, number];
export const TAU = 2 * Math.PI;
export const rad = (deg: number) => (deg * Math.PI) / 180;

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** x = sin(a t + δ), y = sin(b t) */
export const point = (a: number, b: number, delta: number, t: number): Pt => [Math.sin(a * t + delta), Math.sin(b * t)];

/** t = 0 ~ 2π 한 바퀴를 n 조각으로 (a, b 가 정수면 t=2π 에서 정확히 출발점으로 돌아와 닫혀요) */
export function sampleCurve(a: number, b: number, delta: number, n = 360): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(point(a, b, delta, (TAU * i) / n));
  return out;
}

function distToSeg(p: Pt, u: Pt, v: Pt): number {
  const dx = v[0] - u[0], dy = v[1] - u[1];
  const L = dx * dx + dy * dy;
  let s = L === 0 ? 0 : ((p[0] - u[0]) * dx + (p[1] - u[1]) * dy) / L;
  s = Math.max(0, Math.min(1, s));
  return Math.hypot(p[0] - (u[0] + s * dx), p[1] - (u[1] + s * dy));
}

/** 점 p 에서 꺾은선 poly 까지의 가장 짧은 거리 */
export function distToPoly(p: Pt, poly: Pt[]): number {
  let m = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) m = Math.min(m, distToSeg(p, poly[i], poly[i + 1]));
  return m;
}

/** 두 곡선이 얼마나 겹치는지. 서로의 점이 상대 곡선에서 tol 안에 있는 비율과 가장 큰 거리 */
export function overlap(A: Pt[], B: Pt[], tol = 0.05) {
  let inA = 0, inB = 0, mx = 0;
  for (const p of A) {
    const d = distToPoly(p, B);
    if (d <= tol) inA++;
    mx = Math.max(mx, d);
  }
  for (const p of B) {
    const d = distToPoly(p, A);
    if (d <= tol) inB++;
    mx = Math.max(mx, d);
  }
  const pct = (inA + inB) / (A.length + B.length);
  return { pct, maxDist: mx, same: mx <= tol };
}

export type Target = { name: string; a: number; b: number; deg: number };
export const TARGETS: Target[] = [
  { name: "원", a: 1, b: 1, deg: 90 },
  { name: "눕힌 8자", a: 1, b: 2, deg: 0 },
  { name: "기울어진 타원", a: 1, b: 1, deg: 45 },
  { name: "꽈배기 매듭", a: 3, b: 2, deg: 90 },
  { name: "별 모양", a: 5, b: 4, deg: 90 },
];

/** 닫힌 곡선이 되는 가장 짧은 시간: 2π / gcd(a, b) */
export const periodDivisor = (a: number, b: number) => gcd(a, b);

/** 레벨(1~10)에 맞는 목표 모양 count 개. 레벨이 오를수록 빠르기 수가 크고 어긋남이 잘게 나뉜 ‘수수께끼 모양’이 섞여요 */
export function levelTargets(level: number, rnd: () => number, count = 3): Target[] {
  const L = Math.max(1, Math.min(10, level));
  const base = L === 1 ? [0, 1, 2] : L === 2 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const nRandom = L <= 3 ? 0 : Math.min(count, L - 3);
  const maxAB = Math.min(6, 2 + Math.floor(L / 2));
  const step = L < 8 ? 45 : 15;
  const out: Target[] = [];
  const curve = (t: Target) => sampleCurve(t.a, t.b, rad(t.deg), 160);
  const fresh = (t: Target) => out.every((o) => !overlap(curve(o), curve(t)).same);
  const pool = [...base].sort(() => rnd() - 0.5);
  for (let guard = 0; out.length < count - nRandom && guard < 50; guard++) {
    const t = TARGETS[pool[guard % pool.length]];
    if (fresh(t)) out.push(t);
  }
  for (let guard = 0; out.length < count && guard < 500; guard++) {
    const a = 1 + Math.floor(rnd() * maxAB), b = 1 + Math.floor(rnd() * maxAB);
    const deg = step * Math.floor(rnd() * (360 / step));
    const t = { name: "수수께끼 모양", a, b, deg };
    if (fresh(t)) out.push(t);
  }
  return out;
}
