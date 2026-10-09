// 물통 퍼즐의 계산 부분(순수 함수). 통 크기와 물의 양은 모두 정수(L)예요.
export type Move = { kind: "fill" | "empty" | "pour"; i: number; j?: number };
export type Puzzle = { caps: number[]; target: number; min: number };

/** 한 수를 적용해 새 상태를 돌려줘요. 아무것도 안 바뀌면 null */
export function applyMove(caps: number[], s: number[], m: Move): number[] | null {
  const t = s.slice();
  if (m.kind === "fill") {
    if (s[m.i] === caps[m.i]) return null;
    t[m.i] = caps[m.i];
  } else if (m.kind === "empty") {
    if (s[m.i] === 0) return null;
    t[m.i] = 0;
  } else {
    const j = m.j!;
    if (m.i === j || s[m.i] === 0 || s[j] === caps[j]) return null;
    const amt = Math.min(s[m.i], caps[j] - s[j]);
    t[m.i] -= amt;
    t[j] += amt;
  }
  return t;
}

export function allMoves(n: number): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ kind: "fill", i }, { kind: "empty", i });
    for (let j = 0; j < n; j++) if (j !== i) out.push({ kind: "pour", i, j });
  }
  return out;
}

const key = (s: number[]) => s.join(",");
const hit = (s: number[], target: number) => s.some((x) => x === target);

/** start 에서 어느 통이든 target 이 되는 가장 짧은 수 순서(BFS). 없으면 null */
export function solve(caps: number[], start: number[], target: number): Move[] | null {
  if (hit(start, target)) return [];
  const moves = allMoves(caps.length);
  const prev = new Map<string, { from: string; m: Move }>();
  const seen = new Set([key(start)]);
  let frontier = [start];
  while (frontier.length) {
    const next: number[][] = [];
    for (const s of frontier) {
      for (const m of moves) {
        const t = applyMove(caps, s, m);
        if (!t) continue;
        const k = key(t);
        if (seen.has(k)) continue;
        seen.add(k);
        prev.set(k, { from: key(s), m });
        if (hit(t, target)) {
          const path: Move[] = [];
          let c = k;
          while (prev.has(c)) {
            const p = prev.get(c)!;
            path.push(p.m);
            c = p.from;
          }
          return path.reverse();
        }
        next.push(t);
      }
    }
    frontier = next;
  }
  return null;
}

/** 모든 통이 빈 상태에서 각 상태까지의 최소 수(BFS 거리표) */
function distances(caps: number[]): Map<string, number> {
  const start = caps.map(() => 0);
  const moves = allMoves(caps.length);
  const dist = new Map<string, number>([[key(start), 0]]);
  let frontier = [start];
  let d = 0;
  while (frontier.length) {
    d++;
    const next: number[][] = [];
    for (const s of frontier)
      for (const m of moves) {
        const t = applyMove(caps, s, m);
        if (!t) continue;
        const k = key(t);
        if (dist.has(k)) continue;
        dist.set(k, d);
        next.push(t);
      }
    frontier = next;
  }
  return dist;
}

/** 레벨 1~10: 통 수, 가장 큰 통, 최소 수의 범위 */
export const JUG_LEVELS = [
  { jugs: 2, maxCap: 5, lo: 2, hi: 4 },
  { jugs: 2, maxCap: 6, lo: 3, hi: 5 },
  { jugs: 2, maxCap: 7, lo: 4, hi: 6 },
  { jugs: 2, maxCap: 8, lo: 5, hi: 7 },
  { jugs: 2, maxCap: 9, lo: 6, hi: 8 },
  { jugs: 2, maxCap: 11, lo: 7, hi: 10 },
  { jugs: 3, maxCap: 8, lo: 4, hi: 6 },
  { jugs: 3, maxCap: 9, lo: 5, hi: 8 },
  { jugs: 3, maxCap: 11, lo: 6, hi: 9 },
  { jugs: 3, maxCap: 13, lo: 7, hi: 10 },
] as const;
export const jugLevel = (lv: number) => JUG_LEVELS[Math.max(1, Math.min(10, lv)) - 1];

/** 그 레벨에 알맞은 문제 후보 모두 */
export function candidates(lv: number): Puzzle[] {
  const L = jugLevel(lv);
  const sets: number[][] = [];
  const caps = Array.from({ length: L.maxCap - 1 }, (_, i) => i + 2);
  if (L.jugs === 2) {
    for (const a of caps) for (const b of caps) if (a < b && b === L.maxCap) sets.push([a, b]);
    for (const a of caps) for (const b of caps) if (a < b && b < L.maxCap && b >= L.maxCap - 2) sets.push([a, b]);
  } else {
    for (const a of caps) for (const b of caps) for (const c of caps) if (a < b && b < c && c >= L.maxCap - 1 && a >= 2) sets.push([a, b, c]);
  }
  const out: Puzzle[] = [];
  for (const cs of sets) {
    const dist = distances(cs);
    for (let target = 1; target < cs[cs.length - 1]; target++) {
      if (cs.includes(target)) continue;
      let best = Infinity;
      for (const [k, d] of dist) if (k.split(",").some((x) => +x === target)) best = Math.min(best, d);
      if (best >= L.lo && best <= L.hi) out.push({ caps: cs, target, min: best });
    }
  }
  return out;
}

/** 한 레벨의 라운드 3개: 서로 다른 통 조합을 되도록 골라요 */
export function makePuzzles(lv: number, rnd: () => number = Math.random): Puzzle[] {
  const c = candidates(lv).slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  const out: Puzzle[] = [];
  const used = new Set<string>();
  for (const p of c) {
    const k = p.caps.join("-");
    if (!used.has(k)) {
      used.add(k);
      out.push(p);
      if (out.length === 3) return out;
    }
  }
  for (const p of c) if (out.length < 3 && !out.includes(p)) out.push(p);
  return out;
}

/** 별: 최소 수 이하면 3개, 최소+2 이하면 2개, 그 밖엔 1개 */
export const jugStars = (moves: number, min: number) => (moves <= min ? 3 : moves <= min + 2 ? 2 : 1);
