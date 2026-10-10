// Got It! 먼저 만들기: 번갈아 1~k 를 더해서 합이 딱 T 가 되게 하는 쪽이 이겨요. (순수 계산만)

/** 합이 s, 목표 T, 한 번에 1~k 를 더할 때, 지금 차례인 사람이 ‘이길 수 있는 위치’인가? (T−s 가 (k+1)의 배수가 아니면 이김) */
export function moverWins(T: number, k: number, s: number): boolean {
  const d = T - s;
  return d > 0 && d % (k + 1) !== 0;
}
/** 필승 수(안전한 수): T, T−(k+1), T−2(k+1) … 이 수를 만들고 나면 내가 이겨요 */
export function safeNumbers(T: number, k: number): number[] {
  const out: number[] = [];
  for (let v = T; v >= 0; v -= k + 1) out.push(v);
  return out.reverse();
}
/** 이기는 한 수(더할 수). 이길 수 없는 위치면 null */
export function winningAdd(T: number, k: number, s: number): number | null {
  const d = T - s;
  if (d <= 0) return null;
  if (d <= k) return d;
  const r = d % (k + 1);
  return r === 0 ? null : r;
}
/** 컴퓨터가 더할 수. errProb 의 확률로 실수(아무 수나 고름) */
export function cpuAdd(T: number, k: number, s: number, errProb: number, rnd: () => number): number {
  const d = T - s;
  const w = winningAdd(T, k, s);
  if (w !== null && rnd() >= errProb) return w;
  const max = Math.min(k, d);
  return 1 + Math.floor(rnd() * max);
}

export type GRound = { T: number; k: number; s0: number; first: "me" | "cpu"; err: number };
/** 레벨별 (k 후보, T 범위, 컴퓨터 실수 확률, 컴퓨터가 먼저 하는 판이 나올 확률) */
export const LEVEL_PLAN: { ks: number[]; lo: number; hi: number; err: number; cpuFirst: number }[] = [
  { ks: [3], lo: 9, hi: 11, err: 0.5, cpuFirst: 0 },
  { ks: [3], lo: 10, hi: 13, err: 0.4, cpuFirst: 0 },
  { ks: [3], lo: 13, hi: 15, err: 0.3, cpuFirst: 0 },
  { ks: [4], lo: 12, hi: 16, err: 0.25, cpuFirst: 0.3 },
  { ks: [4], lo: 16, hi: 19, err: 0.15, cpuFirst: 0.3 },
  { ks: [4, 5], lo: 18, hi: 24, err: 0.1, cpuFirst: 0.35 },
  { ks: [4, 5], lo: 23, hi: 29, err: 0, cpuFirst: 0.4 },
  { ks: [5, 6], lo: 27, hi: 33, err: 0, cpuFirst: 0.4 },
  { ks: [5, 6], lo: 31, hi: 37, err: 0, cpuFirst: 0.4 },
  { ks: [4, 5, 6], lo: 33, hi: 40, err: 0, cpuFirst: 0.45 },
];
/** 사용자가 완벽하게 두면 반드시 이기는 시작 상태인지 */
export function userCanWin(r: GRound): boolean {
  if (r.s0 >= r.T) return false;
  return r.first === "me" ? moverWins(r.T, r.k, r.s0) : !moverWins(r.T, r.k, r.s0);
}
export function makeRounds(level: number, rnd: () => number = Math.random): GRound[] {
  const p = LEVEL_PLAN[Math.min(10, Math.max(1, level)) - 1];
  const rounds: GRound[] = [];
  const usedT = new Set<string>();
  for (let i = 0; i < 3; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const k = p.ks[Math.floor(rnd() * p.ks.length)];
      const T = p.lo + Math.floor(rnd() * (p.hi - p.lo + 1));
      const cpuFirst = rnd() < p.cpuFirst;
      let s0 = 0;
      let first: "me" | "cpu" = "me";
      if (cpuFirst) {
        first = "cpu";
        s0 = T % (k + 1); // T−s0 가 (k+1)의 배수 → 컴퓨터가 지는 자리
      } else if (T % (k + 1) === 0) {
        s0 = 1 + Math.floor(rnd() * k); // 시작 합계를 조금 올려서 내가 이기는 자리로
      }
      const key = `${T}-${k}-${first}`;
      if (usedT.has(key) && tries < 40) continue;
      usedT.add(key);
      rounds.push({ T, k, s0, first, err: p.err });
      break;
    }
  }
  return rounds;
}
