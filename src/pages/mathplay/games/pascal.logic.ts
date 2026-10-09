// 파스칼 삼각형 계산 (순수 함수)
/** 이항계수 C(n,k) — 덧셈으로만 구해서 윗칸 두 수의 합과 같음을 그대로 보여 줘요 */
export function triangle(rows: number): number[][] {
  const t: number[][] = [];
  for (let n = 0; n < rows; n++) {
    const r: number[] = [];
    for (let k = 0; k <= n; k++) r.push(k === 0 || k === n ? 1 : t[n - 1][k - 1] + t[n - 1][k]);
    t.push(r);
  }
  return t;
}
/** 곱셈·나눗셈으로 구하는 C(n,k) (검증용) */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
/** 얕은 대각선 n: C(n,0)+C(n-1,1)+C(n-2,2)+… 의 (줄, 칸) 목록 */
export function shallowDiagonal(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; n - k >= k; k++) out.push([n - k, k]);
  return out;
}
export const fib = (i: number): number => {
  let a = 0;
  let b = 1;
  for (let j = 0; j < i; j++) [a, b] = [b, a + b];
  return a;
};
export const popcount = (n: number) => n.toString(2).split("").filter((c) => c === "1").length;
/** 정답과 헷갈리는 보기 3개를 섞어 4지선다로. 모두 서로 다르고 0보다 큼 */
export function choices(truth: number, near: number[], rnd: () => number = Math.random): number[] {
  const pool = [truth + 1, truth - 1, truth + 2, truth * 2, truth + 3, ...near].filter((x) => Number.isInteger(x) && x > 0 && x !== truth);
  const uniq = [...new Set(pool)];
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
  }
  const out = [truth, ...uniq.slice(0, 3)];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
