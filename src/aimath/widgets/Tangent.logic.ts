// 평균변화율 → 순간변화율(접선의 기울기) 계산 (React 없음)
export interface TFn {
  id: string;
  name: string;
  tex: string; // f(x)=... 꼴
  f: (x: number) => number;
  df: (x: number) => number; // 도함수(직접 정의)
  /** 식에 x 대신 값을 넣은 TeX (괄호 포함) 만들 때 쓰는 항 */
  xlo: number;
  xhi: number;
  ylo: number;
  yhi: number;
}

export const FUNCTIONS: TFn[] = [
  { id: "sq", name: "f(x)=x²", tex: "x^2", f: (x) => x * x, df: (x) => 2 * x, xlo: -4, xhi: 4, ylo: -2, yhi: 16 },
  { id: "cubic", name: "f(x)=x³−3x", tex: "x^3-3x", f: (x) => x ** 3 - 3 * x, df: (x) => 3 * x * x - 3, xlo: -4, xhi: 4, ylo: -20, yhi: 20 },
  { id: "half", name: "f(x)=0.5x²+x", tex: "0.5x^2+x", f: (x) => 0.5 * x * x + x, df: (x) => x + 1, xlo: -5, xhi: 5, ylo: -2, yhi: 18 },
  { id: "neg", name: "f(x)=−x²+4x", tex: "-x^2+4x", f: (x) => -(x * x) + 4 * x, df: (x) => -2 * x + 4, xlo: -4, xhi: 7, ylo: -22, yhi: 6 },
];

/** h 슬라이더 단계(로그 눈금 느낌) */
export const H_STEPS = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.01];
/** 표에 보여 줄 h */
export const TABLE_H = [2, 1, 0.5, 0.1, 0.01];

/** 평균변화율 (f(a+h)-f(a))/h */
export function avgRate(fn: TFn, a: number, h: number): number {
  return (fn.f(a + h) - fn.f(a)) / h;
}

/** 접선: y = m(x-a) + f(a) */
export function tangentLine(fn: TFn, a: number): { m: number; b: number; fa: number } {
  const m = fn.df(a);
  const fa = fn.f(a);
  return { m, fa, b: fa - m * a }; // y = m x + b
}

export type Trend = "up" | "down" | "flat";
export function trend(m: number): Trend {
  if (Math.abs(m) < 1e-9) return "flat";
  return m > 0 ? "up" : "down";
}

/** 표시용 반올림(-0 방지) */
export function round(x: number, d = 3): string {
  const v = Math.round(x * 10 ** d) / 10 ** d;
  return (Object.is(v, -0) ? 0 : v).toString();
}
