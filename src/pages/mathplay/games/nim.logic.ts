// 님 게임(마지막 돌을 가져가는 쪽이 이김) 순수 계산

/** 님합(XOR). 0 이 아니면 지금 차례인 사람이 이길 수 있어요. */
export const nimSum = (piles: number[]) => piles.reduce((a, b) => a ^ b, 0);
export const total = (piles: number[]) => piles.reduce((a, b) => a + b, 0);
export type Move = { pile: number; take: number };

/** 이기는 한 수(님합을 0 으로 만드는 수). 이길 수 없는 위치면 null */
export function winningMove(piles: number[]): Move | null {
  const x = nimSum(piles);
  if (x === 0) return null;
  for (let i = 0; i < piles.length; i++) {
    const t = piles[i] ^ x;
    if (t < piles[i]) return { pile: i, take: piles[i] - t };
  }
  return null;
}
export function applyMove(piles: number[], m: Move): number[] {
  return piles.map((p, i) => (i === m.pile ? p - m.take : p));
}
export function randomMove(piles: number[], rnd: () => number): Move {
  const opts: Move[] = [];
  piles.forEach((p, i) => {
    for (let t = 1; t <= p; t++) opts.push({ pile: i, take: t });
  });
  return opts[Math.floor(rnd() * opts.length)];
}
/** 컴퓨터가 두는 수. errProb 의 확률로 실수(아무 수나 고름), 이길 수 없는 위치에서는 아무 수나. */
export function cpuMove(piles: number[], errProb: number, rnd: () => number): Move {
  const w = winningMove(piles);
  if (w && rnd() >= errProb) return w;
  return randomMove(piles, rnd);
}

export type NRound = { piles: number[]; first: "me" | "cpu"; err: number };
/** 레벨별: 더미 수, 돌 총합 범위, 한 더미 최대, 컴퓨터 실수 확률, 컴퓨터 선공 확률 */
export const LEVEL_PLAN: { n: number; lo: number; hi: number; max: number; err: number; cpuFirst: number }[] = [
  { n: 2, lo: 5, hi: 7, max: 5, err: 0.5, cpuFirst: 0 },
  { n: 2, lo: 7, hi: 9, max: 6, err: 0.4, cpuFirst: 0 },
  { n: 2, lo: 8, hi: 12, max: 7, err: 0.3, cpuFirst: 0 },
  { n: 3, lo: 6, hi: 9, max: 5, err: 0.25, cpuFirst: 0 },
  { n: 3, lo: 8, hi: 12, max: 6, err: 0.15, cpuFirst: 0.25 },
  { n: 3, lo: 10, hi: 14, max: 7, err: 0.1, cpuFirst: 0.3 },
  { n: 3, lo: 12, hi: 16, max: 7, err: 0, cpuFirst: 0.3 },
  { n: 4, lo: 11, hi: 15, max: 6, err: 0, cpuFirst: 0.3 },
  { n: 4, lo: 13, hi: 18, max: 6, err: 0, cpuFirst: 0.35 },
  { n: 4, lo: 15, hi: 20, max: 7, err: 0, cpuFirst: 0.4 },
];
/** 사용자가 완벽하게 두면 반드시 이기는 시작 상태인가 (내가 먼저면 님합≠0, 컴퓨터가 먼저면 님합=0) */
export function userCanWin(r: NRound): boolean {
  if (total(r.piles) === 0) return false;
  return r.first === "me" ? nimSum(r.piles) !== 0 : nimSum(r.piles) === 0;
}
export function makeRounds(level: number, rnd: () => number = Math.random): NRound[] {
  const p = LEVEL_PLAN[Math.min(10, Math.max(1, level)) - 1];
  const out: NRound[] = [];
  const seen = new Set<string>();
  while (out.length < 3) {
    const first: "me" | "cpu" = rnd() < p.cpuFirst ? "cpu" : "me";
    let piles: number[] = [];
    let ok = false;
    for (let t = 0; t < 4000 && !ok; t++) {
      piles = Array.from({ length: p.n }, () => 1 + Math.floor(rnd() * p.max));
      const s = total(piles);
      ok = s >= p.lo && s <= p.hi && (first === "me" ? nimSum(piles) !== 0 : nimSum(piles) === 0);
      // 한 줄짜리가 아닌 ‘이상한’ 시작(예: 같은 모양 2개 이상)은 피하지 않지만, 같은 상태는 다시 안 나오게
      if (ok && seen.has([...piles].sort().join(",") + first)) ok = false;
    }
    if (!ok) continue;
    seen.add([...piles].sort().join(",") + first);
    out.push({ piles, first, err: p.err });
  }
  return out;
}
/** 이진수 표 (쉬운 말 설명용): 각 더미의 이진수와 세로 합 */
export function binaryRows(piles: number[]) {
  const bits = Math.max(1, ...piles.map((p) => p.toString(2).length));
  const rows = piles.map((p) => p.toString(2).padStart(bits, "0"));
  const col = Array.from({ length: bits }, (_, b) => rows.reduce((a, r) => a + Number(r[b]), 0));
  return { bits, rows, col };
}
