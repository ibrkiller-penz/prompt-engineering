// 경사하강법 계산 (React 없음)
export interface Fn {
  id: string;
  name: string;
  formula: string; // 화면 표시용(순수 텍스트)
  tex: string;
  dtex: string;
  f: (w: number) => number;
  df: (w: number) => number;
  lo: number;
  hi: number;
  defaultStart: number;
}

export const FUNCTIONS: Fn[] = [
  {
    id: "parabola", name: "포물선 f(w)=(w−3)²+1", formula: "(w−3)²+1",
    tex: "f(w)=(w-3)^2+1", dtex: "f'(w)=2(w-3)",
    f: (w) => (w - 3) ** 2 + 1, df: (w) => 2 * (w - 3), lo: -1, hi: 7, defaultStart: 0,
  },
  {
    id: "steep", name: "가파른 포물선 f(w)=2(w+1)²+0.5", formula: "2(w+1)²+0.5",
    tex: "f(w)=2(w+1)^2+0.5", dtex: "f'(w)=4(w+1)",
    f: (w) => 2 * (w + 1) ** 2 + 0.5, df: (w) => 4 * (w + 1), lo: -4, hi: 3, defaultStart: 2,
  },
  {
    id: "quartic", name: "두 골짜기 f(w)=0.1w⁴−0.8w²+0.3w+3", formula: "0.1w⁴−0.8w²+0.3w+3",
    tex: "f(w)=0.1w^4-0.8w^2+0.3w+3", dtex: "f'(w)=0.4w^3-1.6w+0.3",
    f: (w) => 0.1 * w ** 4 - 0.8 * w ** 2 + 0.3 * w + 3, df: (w) => 0.4 * w ** 3 - 1.6 * w + 0.3, lo: -4.5, hi: 4.5, defaultStart: 3.5,
  },
];

/** 한 걸음: w_new = w − η f'(w) */
export function stepOnce(fn: Fn, w: number, eta: number): { slope: number; wNew: number } {
  const slope = fn.df(w);
  return { slope, wNew: w - eta * slope };
}

/** 도함수가 0인 점들 중 극솟값(왼쪽→오른쪽으로 기울기가 −에서 +로 바뀜)을 이분법으로 찾는다 */
export function findMinima(fn: Fn, samples = 2000): { w: number; f: number; isGlobal: boolean }[] {
  const out: number[] = [];
  const h = (fn.hi - fn.lo) / samples;
  for (let i = 0; i < samples; i++) {
    let a = fn.lo + i * h, b = a + h;
    const da = fn.df(a), db = fn.df(b);
    if (da < 0 && db >= 0) {
      for (let k = 0; k < 60; k++) {
        const m = (a + b) / 2;
        if (fn.df(m) < 0) a = m; else b = m;
      }
      out.push((a + b) / 2);
    }
  }
  const fs = out.map((w) => fn.f(w));
  const best = Math.min(...fs);
  return out.map((w, i) => ({ w, f: fs[i], isGlobal: fs[i] <= best + 1e-9 }));
}

export interface PathPoint {
  w: number;
  eta: number; // 이 점에서 다음 걸음에 쓴 학습률(처음 점은 현재 η)
}

/** 시작점에서 n 걸음 진행한 w 목록(길이 n+1), η 고정 */
export function runSteps(fn: Fn, start: number, eta: number, n: number): number[] {
  const ws = [start];
  for (let i = 0; i < n; i++) ws.push(stepOnce(fn, ws[ws.length - 1], eta).wNew);
  return ws;
}

export type Status = "start" | "converged" | "local" | "diverged" | "oscillating" | "moving";

export const CONVERGE_SLOPE = 0.01;

/** 지금까지의 w 기록으로 상태를 판정한다 */
export function classify(fn: Fn, ws: number[]): Status {
  if (ws.length < 2) return "start";
  const last = ws[ws.length - 1];
  const fl = fn.f(last);
  if (!Number.isFinite(fl) || Math.abs(last) > 1e3 || fl > 1e6) return "diverged";
  const slopes = ws.map((w) => fn.df(w));
  if (Math.abs(slopes[slopes.length - 1]) < CONVERGE_SLOPE) {
    const best = Math.min(...findMinima(fn).map((m) => m.f));
    return fl - best > 0.05 ? "local" : "converged";
  }
  if (ws.length >= 4) {
    const fs = ws.map((w) => fn.f(w));
    const n = fs.length;
    if (fs[n - 1] > fs[n - 2] && fs[n - 2] > fs[n - 3] && fs[n - 1] > fs[0]) return "diverged";
    const s = slopes.slice(-4);
    const alt = s[0] * s[1] < 0 && s[1] * s[2] < 0 && s[2] * s[3] < 0;
    if (alt && Math.abs(s[3]) >= 0.9 * Math.abs(s[1])) return "oscillating";
  }
  return "moving";
}
