// 하노이의 탑 계산: 상태는 원반마다 어느 기둥(0~2)에 있는지. 원반 0이 가장 작아요.
export type Pegs = number[];
export type HMove = { disk: number; from: number; to: number };

/** 기둥별로 쌓인 원반(아래에서 위로, 큰 것 → 작은 것) */
export function stacks(p: Pegs): number[][] {
  const s: number[][] = [[], [], []];
  for (let d = p.length - 1; d >= 0; d--) s[p[d]].push(d);
  return s;
}
/** 기둥 위쪽(맨 위) 원반 번호, 없으면 -1 */
export function topOf(p: Pegs, peg: number): number {
  for (let d = 0; d < p.length; d++) if (p[d] === peg) return d;
  return -1;
}
export function canMove(p: Pegs, from: number, to: number): boolean {
  if (from === to) return false;
  const d = topOf(p, from);
  if (d < 0) return false;
  const t = topOf(p, to);
  return t < 0 || d < t;
}
export function applyMove(p: Pegs, from: number, to: number): Pegs {
  const d = topOf(p, from);
  const q = p.slice();
  q[d] = to;
  return q;
}
export const isGoal = (p: Pegs, goal: number) => p.every((x) => x === goal);
const key = (p: Pegs) => p.reduce((a, x) => a * 3 + x, 0);

/** 목표 상태에서 거꾸로 BFS: 모든 상태까지 남은 최소 이동 수 (움직임은 되돌릴 수 있어서 거리가 같아요) */
export function distTable(n: number, goal: number): Int16Array {
  const total = 3 ** n;
  const dist = new Int16Array(total).fill(-1);
  const start: Pegs = Array(n).fill(goal);
  dist[key(start)] = 0;
  let q: Pegs[] = [start];
  while (q.length) {
    const nq: Pegs[] = [];
    for (const s of q) {
      const d = dist[key(s)];
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) {
          if (!canMove(s, a, b)) continue;
          const t = applyMove(s, a, b);
          const k = key(t);
          if (dist[k] < 0) {
            dist[k] = d + 1;
            nq.push(t);
          }
        }
    }
    q = nq;
  }
  return dist;
}
const cache = new Map<string, Int16Array>();
function table(n: number, goal: number) {
  const k = `${n}-${goal}`;
  let t = cache.get(k);
  if (!t) cache.set(k, (t = distTable(n, goal)));
  return t;
}
/** 지금 상태에서 목표까지 가장 적게 옮기는 횟수 */
export function minMoves(p: Pegs, goal: number): number {
  return table(p.length, goal)[key(p)];
}
/** 다음에 해야 할 한 수 (최소 이동의 첫 수). 이미 목표면 null */
export function hintMove(p: Pegs, goal: number): HMove | null {
  const t = table(p.length, goal);
  const d = t[key(p)];
  if (d <= 0) return null;
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) {
      if (!canMove(p, a, b)) continue;
      if (t[key(applyMove(p, a, b))] === d - 1) return { disk: topOf(p, a), from: a, to: b };
    }
  return null;
}

export type HRound = { n: number; pegs: Pegs; goal: number; min: number; std: boolean };
type Plan = ("std" | "mix")[];
/** 레벨별 라운드 3개: [원반 수, 시작 방식] */
export const LEVEL_PLAN: [number, "std" | "mix"][][] = [
  [[2, "std"], [2, "std"], [2, "std"]],
  [[2, "std"], [3, "std"], [3, "std"]],
  [[3, "std"], [3, "mix"], [3, "std"]],
  [[3, "std"], [4, "std"], [3, "mix"]],
  [[4, "std"], [4, "mix"], [4, "std"]],
  [[4, "mix"], [5, "std"], [4, "mix"]],
  [[5, "std"], [5, "mix"], [5, "std"]],
  [[5, "mix"], [6, "std"], [5, "mix"]],
  [[6, "std"], [6, "mix"], [6, "std"]],
  [[6, "mix"], [7, "mix"], [6, "std"]],
];
export function makeRound(n: number, kind: "std" | "mix", rnd: () => number = Math.random): HRound {
  const r3 = () => Math.floor(rnd() * 3);
  if (kind === "std") {
    const s = r3();
    let g = r3();
    while (g === s) g = r3();
    const pegs = Array(n).fill(s);
    return { n, pegs, goal: g, min: minMoves(pegs, g), std: true };
  }
  for (let t = 0; t < 1000; t++) {
    const pegs = Array.from({ length: n }, r3);
    const goal = r3();
    const min = minMoves(pegs, goal);
    // 너무 쉽거나(이미 거의 끝) 한 기둥에 몰려 있는 시작은 피해요
    if (min >= Math.max(3, n) && new Set(pegs).size >= 2) return { n, pegs, goal, min, std: false };
  }
  return makeRound(n, "std", rnd);
}
export function levelRounds(level: number, rnd: () => number = Math.random): HRound[] {
  const plan = LEVEL_PLAN[Math.min(10, Math.max(1, level)) - 1];
  return plan.map(([n, k]) => makeRound(n, k, rnd));
}
/** 별: 최소 횟수면 3개, 1.5배 이내면 2개, 그 밖엔 1개 */
export function starsFor(moves: number, min: number): number {
  return moves <= min ? 3 : moves <= Math.ceil(min * 1.5) ? 2 : 1;
}
export type { Plan };
