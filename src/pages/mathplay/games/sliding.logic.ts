// 숫자 밀기 퍼즐의 계산 부분(순수 함수). 판은 rows×cols, 0 이 빈칸, 완성은 1..N-1,0.
export type Board = number[];
export const goalOf = (rows: number, cols: number): Board => Array.from({ length: rows * cols }, (_, i) => (i + 1) % (rows * cols));
export const isGoal = (b: Board) => b.every((v, i) => v === (i + 1) % b.length);

/** 빈칸이 갈 수 있는 이웃 칸 */
export function blankNeighbors(rows: number, cols: number, blank: number): number[] {
  const r = Math.floor(blank / cols),
    c = blank % cols;
  const out: number[] = [];
  if (r > 0) out.push(blank - cols);
  if (r < rows - 1) out.push(blank + cols);
  if (c > 0) out.push(blank - 1);
  if (c < cols - 1) out.push(blank + 1);
  return out;
}

/** 타일 하나를 빈칸 쪽으로 한 칸 옮긴 판(옆에 빈칸이 있을 때만) */
export function slideOne(rows: number, cols: number, b: Board, tile: number): Board | null {
  const blank = b.indexOf(0);
  if (!blankNeighbors(rows, cols, blank).includes(tile)) return null;
  const t = b.slice();
  t[blank] = b[tile];
  t[tile] = 0;
  return t;
}

/** 누른 칸이 빈칸과 같은 줄이면, 그 줄의 타일들을 한꺼번에 빈칸 쪽으로 민다. 옮긴 타일 수(=이동 횟수)와 새 판 */
export function slideLine(_rows: number, cols: number, b: Board, tile: number): { board: Board; count: number } | null {
  const blank = b.indexOf(0);
  if (tile === blank) return null;
  const tr = Math.floor(tile / cols),
    tc = tile % cols,
    br = Math.floor(blank / cols),
    bc = blank % cols;
  if (tr !== br && tc !== bc) return null;
  const step = tr === br ? (bc > tc ? 1 : -1) : br > tr ? cols : -cols;
  const t = b.slice();
  let count = 0;
  for (let p = blank; p !== tile; p -= step) {
    t[p] = t[p - step];
    count++;
  }
  t[tile] = 0;
  return { board: t, count };
}

/** 풀 수 있는 판인지(뒤바뀐 쌍의 홀짝) */
export function solvable(rows: number, cols: number, b: Board): boolean {
  const flat = b.filter((x) => x !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inv++;
  if (cols % 2 === 1) return inv % 2 === 0;
  const blankRowFromBottom = rows - Math.floor(b.indexOf(0) / cols);
  return (inv + blankRowFromBottom) % 2 === 1;
}

/** IDA*: 가장 짧은 해(타일을 옮길 빈칸 이웃 칸 번호들의 순서). limit 을 넘으면 null */
export function solveBoard(rows: number, cols: number, start: Board, limit = 60, maxNodes = Infinity): number[] | null {
  const n = rows * cols;
  const goalPos = new Array<number>(n);
  for (let v = 1; v < n; v++) goalPos[v] = v - 1;
  const md = (b: Board) => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const v = b[i];
      if (!v) continue;
      const g = goalPos[v];
      s += Math.abs(Math.floor(i / cols) - Math.floor(g / cols)) + Math.abs((i % cols) - (g % cols));
    }
    return s;
  };
  const b = start.slice();
  let blank = b.indexOf(0);
  const path: number[] = [];
  let found = false;
  let nodes = 0;
  let aborted = false;
  const nbrs: number[][] = Array.from({ length: n }, (_, p) => blankNeighbors(rows, cols, p));
  const search = (g: number, h: number, bound: number, last: number): number => {
    const f = g + h;
    if (f > bound) return f;
    if (++nodes > maxNodes) {
      aborted = true;
      return Infinity;
    }
    if (h === 0) {
      found = true;
      return f;
    }
    let min = Infinity;
    for (const p of nbrs[blank]) {
      if (p === last) continue;
      const v = b[p];
      const gp = goalPos[v];
      const dOld = Math.abs(Math.floor(p / cols) - Math.floor(gp / cols)) + Math.abs((p % cols) - (gp % cols));
      const dNew = Math.abs(Math.floor(blank / cols) - Math.floor(gp / cols)) + Math.abs((blank % cols) - (gp % cols));
      const old = blank;
      b[blank] = v;
      b[p] = 0;
      blank = p;
      path.push(p);
      const r = search(g + 1, h - dOld + dNew, bound, old);
      if (found || aborted) return r;
      path.pop();
      blank = old;
      b[p] = v;
      b[old] = 0;
      if (r < min) min = r;
    }
    return min;
  };
  let bound = md(b);
  while (bound <= limit) {
    const r = search(0, md(b), bound, -1);
    if (found) return path.slice();
    if (aborted || r === Infinity) return null;
    bound = r;
  }
  return null;
}

/** 해(빈칸 이웃 번호들)를 따라 한 수 가면 어떤 칸의 타일이 움직이는지: path[0] */
export const hintTile = (path: number[]) => (path.length ? path[0] : -1);

/** 레벨 1~10: 판 크기와 섞은 뒤 최소 이동 수 범위(lo..hi). 모두 25 이하 */
export const SLIDE_LEVELS = [
  { rows: 2, cols: 3, lo: 2, hi: 4 },
  { rows: 2, cols: 3, lo: 5, hi: 8 },
  { rows: 3, cols: 3, lo: 3, hi: 5 },
  { rows: 3, cols: 3, lo: 6, hi: 9 },
  { rows: 3, cols: 3, lo: 10, hi: 13 },
  { rows: 3, cols: 3, lo: 13, hi: 16 },
  { rows: 3, cols: 3, lo: 16, hi: 20 },
  { rows: 3, cols: 3, lo: 20, hi: 24 },
  { rows: 4, cols: 4, lo: 8, hi: 12 },
  { rows: 4, cols: 4, lo: 13, hi: 18 },
] as const;
export const slideLevel = (lv: number) => SLIDE_LEVELS[Math.max(1, Math.min(10, lv)) - 1];

/** 완성 판에서 합법 이동을 무작위로 해서 섞고, 최소 이동 수가 범위 안이 될 때까지 다시 해 본다(섞는 횟수는 결과를 보고 조절) */
export function makeBoard(lv: number, rnd: () => number = Math.random): { board: Board; min: number } {
  const { rows, cols, lo, hi } = slideLevel(lv);
  let w = Math.round((lo + hi) / 2);
  let fallback: { board: Board; min: number } | null = null;
  for (let tries = 0; tries < 600; tries++) {
    let b = goalOf(rows, cols);
    let last = -1;
    const steps = Math.max(1, w + Math.floor(rnd() * 3) - 1);
    for (let k = 0; k < steps; k++) {
      const blank = b.indexOf(0);
      const opts = blankNeighbors(rows, cols, blank).filter((p) => p !== last);
      const p = opts[Math.floor(rnd() * opts.length)];
      last = blank;
      b = slideOne(rows, cols, b, p)!;
    }
    if (isGoal(b)) {
      w++;
      continue;
    }
    const sol = solveBoard(rows, cols, b, hi);
    if (!sol) {
      w = Math.max(1, w - 1);
      continue;
    }
    if (sol.length >= lo) return { board: b, min: sol.length };
    if (!fallback || sol.length > fallback.min) fallback = { board: b, min: sol.length };
    w++;
  }
  if (fallback) return fallback;
  let b = goalOf(rows, cols);
  b = slideOne(rows, cols, b, blankNeighbors(rows, cols, b.indexOf(0))[0])!;
  return { board: b, min: 1 };
}

/** 풀이를 못 찾을 때의 어림 힌트: 빈칸 이웃 중 제자리에 더 가까워지는 타일(칸 번호) */
export function greedyHint(rows: number, cols: number, b: Board): number {
  const blank = b.indexOf(0);
  let best = -1;
  let bestGain = -Infinity;
  for (const p of blankNeighbors(rows, cols, blank)) {
    const v = b[p];
    const g = v - 1;
    const d = (pos: number) => Math.abs(Math.floor(pos / cols) - Math.floor(g / cols)) + Math.abs((pos % cols) - (g % cols));
    const gain = d(p) - d(blank);
    if (gain > bestGain) {
      bestGain = gain;
      best = p;
    }
  }
  return best;
}
