// 최소제곱 회귀직선 계산 (React 없음)
export interface Pt {
  x: number;
  y: number;
}
export interface Stats {
  n: number;
  mx: number;
  my: number;
  sxx: number;
  syy: number;
  sxy: number;
  /** 기울기·절편·상관계수. 계산 불가면 null */
  a: number | null;
  b: number | null;
  r: number | null;
  sse: number | null;
  /** 'few' = 점이 2개 미만, 'vertical' = x가 모두 같음, null = 정상 */
  problem: "few" | "vertical" | null;
}

export function sseFor(pts: Pt[], a: number, b: number): number {
  return pts.reduce((s, p) => s + (p.y - (a * p.x + b)) ** 2, 0);
}

export function computeStats(pts: Pt[]): Stats {
  const n = pts.length;
  if (n === 0) return { n, mx: 0, my: 0, sxx: 0, syy: 0, sxy: 0, a: null, b: null, r: null, sse: null, problem: "few" };
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const base = { n, mx, my, sxx, syy, sxy };
  if (n < 2) return { ...base, a: null, b: null, r: null, sse: null, problem: "few" };
  if (sxx < 1e-12) return { ...base, a: null, b: null, r: null, sse: null, problem: "vertical" };
  const a = sxy / sxx;
  const b = my - a * mx;
  const r = syy < 1e-12 ? null : sxy / Math.sqrt(sxx * syy); // y가 모두 같으면 r 정의 불가
  return { ...base, a, b, r, sse: sseFor(pts, a, b), problem: null };
}

export function predict(a: number, b: number, x: number): number {
  return a * x + b;
}

export function xRange(pts: Pt[]): [number, number] | null {
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p.x);
  return [Math.min(...xs), Math.max(...xs)];
}

export const PRESETS: Record<string, Pt[]> = {
  positive: [[1, 1.5], [2, 2.4], [3, 2.9], [4, 4.2], [5, 4.8], [6, 6.1], [7, 6.6], [8, 8.2], [9, 8.7]].map(([x, y]) => ({ x, y })),
  negative: [[1, 8.8], [2, 8.1], [3, 7.2], [4, 6.4], [5, 5.3], [6, 4.9], [7, 3.6], [8, 2.8], [9, 1.7]].map(([x, y]) => ({ x, y })),
  none: [[1, 5], [2, 8], [3, 2.5], [4, 6.5], [5, 3.5], [6, 8.5], [7, 2], [8, 6], [9, 4.5]].map(([x, y]) => ({ x, y })),
  outlier: [[1, 1.5], [2, 2.4], [3, 3.1], [4, 4.0], [5, 5.1], [6, 5.9], [7, 7.0], [9, 0.8]].map(([x, y]) => ({ x, y })),
};
