// 벡터의 성분과 연산 (React 없음)

export type Op = "add" | "sub" | "scale" | "norm" | "dist";

/** 부동소수 잡음을 없앤 뒤 글자로 (정수면 정수, 아니면 필요한 만큼의 소수) */
export function fmt(x: number): string {
  const r = Math.round(x * 1e9) / 1e9;
  return String(Object.is(r, -0) ? 0 : r);
}

/** 소수 둘째 자리 반올림 */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function clampInt(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

export function clampNum(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(lo, Math.min(hi, x));
}

export function add(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i]);
}
export function sub(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - b[i]);
}
export function scale(k: number, a: number[]): number[] {
  return a.map((x) => k * x);
}
/** 크기의 제곱 */
export function normSq(a: number[]): number {
  return Math.round(a.reduce((s, x) => s + x * x, 0) * 1e9) / 1e9;
}
export function norm(a: number[]): number {
  return Math.sqrt(normSq(a));
}
export function dist(a: number[], b: number[]): number {
  return norm(sub(a, b));
}

export interface SqrtShow {
  /** 완전제곱(정수나 깔끔한 소수)이면 true */
  exact: boolean;
  value: number;
  /** √s 다음에 이어 붙일 TeX: "=5" 또는 "\approx 3.61" */
  tail: string;
  /** 일반 글자 표시: "5" 또는 "√13 ≈ 3.61" */
  text: string;
}

/** s 의 제곱근을 보이는 방법: 완전제곱이면 값, 아니면 √s 와 근삿값 */
export function sqrtShow(s: number): SqrtShow {
  const v = Math.sqrt(s);
  const r = Math.round(v * 1e6) / 1e6;
  const exact = Math.abs(r * r - s) < 1e-9;
  if (exact) return { exact, value: r, tail: "=" + fmt(r), text: fmt(r) };
  return { exact, value: v, tail: "\\approx " + fmt(round2(v)), text: `√${fmt(s)} ≈ ${fmt(round2(v))}` };
}

const tn = (x: number) => (x < 0 ? `(${fmt(x)})` : fmt(x));
export const vecTex = (v: number[]) => "(" + v.map(fmt).join(",\\ ") + ")";
const labels = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}_${i + 1}`);

export interface Described {
  /** 화면에 한 줄씩 보일 TeX */
  lines: string[];
  /** 결과 벡터(합·차·실수배) 또는 null */
  vector: number[] | null;
  /** 결과 숫자(크기·거리) 또는 null */
  scalar: number | null;
}

function sqrtLines(head: string, terms: number[]): string {
  const sq = normSq(terms);
  const s = sqrtShow(sq);
  const parts = terms.map((t) => `${tn(t)}^2`).join("+");
  const vals = terms.map((t) => fmt(t * t)).join("+");
  return `${head}=\\sqrt{${parts}}=\\sqrt{${vals}}=\\sqrt{${fmt(sq)}}${s.tail}`;
}

/** 연산 과정을 TeX 줄들로 */
export function describe(op: Op, a: number[], b: number[], k: number): Described {
  const n = a.length;
  const A = "\\vec{a}";
  const B = "\\vec{b}";
  if (op === "add" || op === "sub") {
    const sign = op === "add" ? "+" : "-";
    const r = op === "add" ? add(a, b) : sub(a, b);
    const sym = labels("a", n).map((x, i) => `${x}${sign}b_${i + 1}`).join(",\\ ");
    const num = a.map((x, i) => `${fmt(x)}${sign}${tn(b[i])}`).join(",\\ ");
    return { lines: [`${A}${sign}${B}=(${sym})=(${num})=${vecTex(r)}`], vector: r, scalar: null };
  }
  if (op === "scale") {
    const r = scale(k, a);
    const sym = labels("a", n).map((x) => `k${x}`).join(",\\ ");
    const num = a.map((x) => `${tn(k)}\\cdot ${tn(x)}`).join(",\\ ");
    return { lines: [`k=${fmt(k)}:\\ k${A}=(${sym})=(${num})=${vecTex(r)}`], vector: r, scalar: null };
  }
  if (op === "norm") {
    return { lines: [sqrtLines(`|${A}|`, a)], vector: null, scalar: norm(a) };
  }
  const d = sub(a, b);
  const num = a.map((x, i) => `${fmt(x)}-${tn(b[i])}`).join(",\\ ");
  return {
    lines: [`${A}-${B}=(${num})=${vecTex(d)}`, sqrtLines(`|${A}-${B}|`, d)],
    vector: null,
    scalar: norm(d),
  };
}
