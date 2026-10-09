// 추세선 긋기의 계산 부분(순수 함수). 자료는 모두 가상이에요.
export type Pt = { x: number; y: number };
export const X0 = 1990;
export const X1 = 2020;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 가상 자료 30개(1991~2020). 기울기는 일정하고 잡음이 섞여 있어요 */
export function makeData(seed: number): Pt[] {
  const rnd = mulberry(seed);
  const slope = 0.016 + rnd() * 0.012;
  const base = -0.05 + rnd() * 0.2;
  const pts: Pt[] = [];
  for (let k = 0; k < 30; k++) {
    const x = 1991 + k;
    const noise = (rnd() + rnd() + rnd() - 1.5) * 0.26; // 대략 -0.4..0.4, 가운데에 몰림
    pts.push({ x, y: Math.round((base + slope * (x - X0) + noise) * 100) / 100 });
  }
  return pts;
}
export const OUTLIER: Pt = { x: 2019, y: -0.45 };

/** 최소제곱선: y = a + b(x - X0) */
export function leastSquares(pts: Pt[]) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0,
    sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const b = sxy / sxx;
  const a = my - b * (mx - X0);
  return { a, b };
}
/** 끝 손잡이 두 값(ya: 1990, yb: 2020)으로 이루어진 선 */
export const lineAt = (ya: number, yb: number, x: number) => ya + ((yb - ya) * (x - X0)) / (X1 - X0);
export const lsAt = (ls: { a: number; b: number }, x: number) => ls.a + ls.b * (x - X0);
export const sse = (pts: Pt[], f: (x: number) => number) => pts.reduce((s, p) => s + (p.y - f(p.x)) ** 2, 0);
