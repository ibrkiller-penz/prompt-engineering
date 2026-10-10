// 접선 기울기 탐험: 순수 계산 (화면과 분리)
export type Fn = {
  id: string;
  label: string;
  dlabel: string;
  f: (x: number) => number;
  df: (x: number) => number; // 해석적 도함수
  x0: number;
  x1: number;
  lo: number; // 점이 갈 수 있는 가장 왼쪽
  y0: number;
  y1: number;
  d0: number;
  d1: number;
  zeros: number[]; // f'(x)=0 인 x (범위 안)
};

export const FNS: Fn[] = [
  { id: "sq", label: "x²", dlabel: "2x", f: (x) => x * x, df: (x) => 2 * x, x0: -3, x1: 3, lo: -3, y0: -1, y1: 9.5, d0: -7, d1: 7, zeros: [0] },
  { id: "cu", label: "x³−3x", dlabel: "3x²−3", f: (x) => x ** 3 - 3 * x, df: (x) => 3 * x * x - 3, x0: -2.2, x1: 2.2, lo: -2.2, y0: -5, y1: 5, d0: -4, d1: 13, zeros: [-1, 1] },
  { id: "sin", label: "sin x", dlabel: "cos x", f: (x) => Math.sin(x), df: (x) => Math.cos(x), x0: -2 * Math.PI, x1: 2 * Math.PI, lo: -2 * Math.PI, y0: -1.5, y1: 1.5, d0: -1.5, d1: 1.5, zeros: [-1.5 * Math.PI, -0.5 * Math.PI, 0.5 * Math.PI, 1.5 * Math.PI] },
  { id: "sqrt", label: "√x", dlabel: "1/(2√x)", f: (x) => Math.sqrt(x), df: (x) => 1 / (2 * Math.sqrt(x)), x0: 0, x1: 9, lo: 0.05, y0: -0.5, y1: 3.5, d0: -0.5, d1: 3, zeros: [] },
];

/** 수치 미분(가운데 차분) */
export const numDeriv = (f: (x: number) => number, x: number, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

export type Quest = { kind: "zero" | "pos" | "neg" | "value"; target?: number };

export const QUEST_TOL = { zero: 0.12, pos: 0.3, neg: -0.3, value: 0.1 };

/** 레벨(1~10)이 오를수록 허용 오차가 줄어든다: 레벨 1 은 1배, 레벨 10 은 0.46배 */
export const levelFactor = (lv = 1) => 1 - (Math.max(1, Math.min(10, lv)) - 1) * 0.06;
export const zeroTol = (lv = 1) => QUEST_TOL.zero * levelFactor(lv);
export const valueTol = (lv = 1) => QUEST_TOL.value * levelFactor(lv);

export function judge(q: Quest, m: number, lv = 1): boolean {
  if (q.kind === "zero") return Math.abs(m) <= zeroTol(lv);
  if (q.kind === "pos") return m >= QUEST_TOL.pos;
  if (q.kind === "neg") return m <= QUEST_TOL.neg;
  return Math.abs(m - (q.target as number)) <= valueTol(lv);
}

export function questText(q: Quest, lv = 1): string {
  if (q.kind === "zero") return `기울기가 0인 곳(접선이 수평인 곳, 오차 ±${zeroTol(lv).toFixed(2)})에 점을 놓고 ‘여기에 표시’를 눌러요.`;
  if (q.kind === "pos") return "기울기가 양수인 곳(접선이 오르막인 곳)에 점을 놓고 ‘여기에 표시’를 눌러요.";
  if (q.kind === "neg") return "기울기가 음수인 곳(접선이 내리막인 곳)에 점을 놓고 ‘여기에 표시’를 눌러요.";
  return `기울기가 ${q.target}인 곳(오차 ±${valueTol(lv).toFixed(2)})에 점을 놓고 ‘여기에 표시’를 눌러요.`;
}

/** 함수에 맞는 새 문제. 반드시 풀 수 있는 문제만 만든다. */
export function makeQuest(fn: Fn, rnd: () => number): Quest {
  const kinds: Quest["kind"][] = ["pos", "value", "value"];
  if (fn.zeros.length) kinds.push("zero", "zero");
  const xs = Array.from({ length: 400 }, (_, i) => fn.lo + ((fn.x1 - fn.lo) * i) / 399);
  if (xs.some((x) => fn.df(x) <= QUEST_TOL.neg)) kinds.push("neg");
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  if (kind !== "value") return { kind };
  const x = fn.lo + (fn.x1 - fn.lo) * (0.1 + 0.8 * rnd());
  const t = Math.round(fn.df(x) * 2) / 2; // 0.5 단위
  if (Math.abs(t) < 0.5) return { kind: "pos" };
  return { kind: "value", target: t };
}

/** 문제가 정말 풀 수 있는지(범위 안에 답이 있는지) */
export function solvable(fn: Fn, q: Quest, lv = 1): boolean {
  for (let i = 0; i <= 4000; i++) {
    const x = fn.lo + ((fn.x1 - fn.lo) * i) / 4000;
    if (judge(q, fn.df(x), lv)) return true;
  }
  return false;
}
