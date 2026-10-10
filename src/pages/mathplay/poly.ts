// 폴리오미노(정사각형을 이어 붙인 조각) 계산: 돌리기·뒤집기, 빈칸 채우기 풀이, 테트로미노 문제 만들기,
// 색동 마방진(대각선 라틴방진) 풀이와 문제 만들기. 화면과 분리해 둔 순수 함수들이다.

export type Cell = [number, number];

/** 조각 이름 → 기본 모양. 대문자는 펜토미노 12종, 소문자는 테트로미노 5종. */
export const SHAPES: Record<string, Cell[]> = {
  F: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
  I: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  L: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
  N: [[0, 1], [1, 1], [2, 0], [2, 1], [3, 0]],
  P: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
  U: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
  V: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  W: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  X: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  Y: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1]],
  Z: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
  i: [[0, 0], [0, 1], [0, 2], [0, 3]],
  o: [[0, 0], [0, 1], [1, 0], [1, 1]],
  t: [[0, 0], [0, 1], [0, 2], [1, 1]],
  s: [[0, 1], [0, 2], [1, 0], [1, 1]],
  l: [[0, 0], [1, 0], [2, 0], [2, 1]],
};

/** 왼쪽 위가 (0,0)이 되게 옮기고 줄 순서로 정렬 */
export function norm(cs: Cell[]): Cell[] {
  const mr = Math.min(...cs.map((x) => x[0]));
  const mc = Math.min(...cs.map((x) => x[1]));
  return cs.map(([a, b]) => [a - mr, b - mc] as Cell).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

/** 시계 방향으로 rot번(90°씩) 돌리고, flip이면 좌우로 뒤집는다 */
export function transform(cs: Cell[], rot: number, flip: boolean): Cell[] {
  let cur = cs;
  if (flip) cur = cur.map(([a, b]) => [a, -b] as Cell);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cur = cur.map(([a, b]) => [b, -a] as Cell);
  return norm(cur);
}

/** 겹치지 않는 모든 방향(최대 8가지) */
export function orientations(cs: Cell[]): Cell[][] {
  const seen = new Map<string, Cell[]>();
  for (const f of [false, true]) for (let r = 0; r < 4; r++) {
    const o = transform(cs, r, f);
    seen.set(JSON.stringify(o), o);
  }
  return [...seen.values()];
}

export type Placed = { name: string; cells: Cell[] };

/**
 * 빈칸(open)을 주어진 조각들로 정확히 채우는 방법을 하나 찾는다. 조각은 한 번씩만 쓴다.
 * blocked 에 이미 놓인 칸을 넣을 수 있다. 못 찾으면 null.
 */
export function solveFill(open: boolean[][], names: string[], fixed: Cell[] = [], limit = 3_000_000): Placed[] | null {
  const R = open.length;
  const C = open[0]?.length ?? 0;
  const occ = open.map((row) => row.map((v) => !v));
  fixed.forEach(([r, c]) => (occ[r][c] = true));
  const oris = names.map((n) => orientations(SHAPES[n]));
  const used = names.map(() => false);
  const out: Placed[] = [];
  let nodes = 0;
  const dfs = (): boolean => {
    if (++nodes > limit) return false;
    let fr = -1;
    let fc = -1;
    outer: for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!occ[r][c]) { fr = r; fc = c; break outer; }
    if (fr < 0) return used.every(Boolean);
    for (let p = 0; p < names.length; p++) {
      if (used[p]) continue;
      for (const o of oris[p]) {
        // 첫 빈칸(줄 순서로 가장 앞)은 조각의 첫 칸이어야 한다
        const [ar, ac] = o[0];
        const cells: Cell[] = o.map(([a, b]) => [fr + a - ar, fc + b - ac] as Cell);
        if (cells.some(([r, c]) => r < 0 || c < 0 || r >= R || c >= C || occ[r][c])) continue;
        cells.forEach(([r, c]) => (occ[r][c] = true));
        used[p] = true;
        out.push({ name: names[p], cells });
        if (dfs()) return true;
        out.pop();
        used[p] = false;
        cells.forEach(([r, c]) => (occ[r][c] = false));
      }
    }
    return false;
  };
  return dfs() ? out.map((x) => ({ ...x })) : null;
}

const rnd = (n: number) => Math.floor(Math.random() * n);

/** 테트로미노 5종(I·O·T·S·L)을 한 번씩 이어 붙인 모양을 무작위로 만든다. 답이 적어도 하나는 있다. */
export function makeTetrominoProblem(rows = 6, cols = 7): { open: boolean[][]; sample: Placed[] } {
  const names = ["i", "o", "t", "s", "l"];
  for (let tries = 0; tries < 500; tries++) {
    const grid = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    const order = [...names].sort(() => Math.random() - 0.5);
    const placed: Placed[] = [];
    let ok = true;
    for (let k = 0; k < order.length && ok; k++) {
      const oris = orientations(SHAPES[order[k]]);
      const cands: Cell[][] = [];
      for (const o of oris) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cells: Cell[] = o.map(([a, b]) => [r + a, c + b] as Cell);
        if (cells.some(([rr, cc]) => rr >= rows || cc >= cols || grid[rr][cc])) continue;
        if (k > 0) {
          const touch = cells.some(([rr, cc]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => grid[rr + dr]?.[cc + dc]));
          if (!touch) continue;
        } else if (r > 1 || c > 1) continue; // 첫 조각은 왼쪽 위 근처에서 시작해 한쪽으로 쏠리지 않게
        cands.push(cells);
      }
      if (!cands.length) { ok = false; break; }
      const pick = cands[rnd(cands.length)];
      pick.forEach(([r, c]) => (grid[r][c] = true));
      placed.push({ name: order[k], cells: pick });
    }
    if (!ok) continue;
    // 너무 길쭉한 모양(가로나 세로가 두 줄 이하)은 거른다
    const usedRows = grid.filter((row) => row.some(Boolean)).length;
    const usedCols = grid[0].map((_, c) => grid.some((row) => row[c])).filter(Boolean).length;
    if (usedRows < 3 || usedCols < 3) continue;
    return { open: grid, sample: placed };
  }
  // 아주 드물게 실패하면 4×5 직사각형
  const open = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r < 4 && c < 5));
  return { open, sample: solveFill(open, names) ?? [] };
}

// ───── 색동 마방진(가로·세로·두 대각선 어디에도 같은 색이 없게 채우기) ─────

/** n×n 칸에 1~n을 넣어 가로·세로·두 대각선에 같은 수가 없는 채움을 센다(최대 max개까지). grid 의 0은 빈칸. */
export function countSquares(grid: number[][], max = 2): { count: number; first: number[][] | null } {
  const n = grid.length;
  const g = grid.map((r) => [...r]);
  let count = 0;
  let first: number[][] | null = null;
  const okAt = (r: number, c: number, v: number) => {
    for (let i = 0; i < n; i++) {
      if (i !== c && g[r][i] === v) return false;
      if (i !== r && g[i][c] === v) return false;
    }
    if (r === c) for (let i = 0; i < n; i++) if (i !== r && g[i][i] === v) return false;
    if (r + c === n - 1) for (let i = 0; i < n; i++) if (i !== r && g[i][n - 1 - i] === v) return false;
    return true;
  };
  const dfs = (idx: number) => {
    if (count >= max) return;
    if (idx === n * n) { count++; if (!first) first = g.map((r) => [...r]); return; }
    const r = Math.floor(idx / n);
    const c = idx % n;
    if (g[r][c]) { dfs(idx + 1); return; }
    for (let v = 1; v <= n; v++) {
      if (!okAt(r, c, v)) continue;
      g[r][c] = v;
      dfs(idx + 1);
      g[r][c] = 0;
    }
  };
  // 처음 주어진 칸끼리 이미 어긋나면 답이 없다
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c]) {
    const v = g[r][c];
    g[r][c] = 0;
    const fine = okAt(r, c, v);
    g[r][c] = v;
    if (!fine) return { count: 0, first: null };
  }
  dfs(0);
  return { count, first };
}

/** 답이 하나뿐인 색동 마방진 문제. given 이 true 인 칸이 미리 놓인 칩이다. */
export function makeColorSquare(n: 4 | 5): { solution: number[][]; given: boolean[][] } {
  // 완성판: 빈 판에서 무작위 순서로 하나 찾는다
  const full = (() => {
    const g = Array.from({ length: n }, () => Array<number>(n).fill(0));
    const vals = [...Array(n)].map((_, i) => i + 1);
    const ok = (r: number, c: number, v: number) => {
      for (let i = 0; i < n; i++) {
        if (i !== c && g[r][i] === v) return false;
        if (i !== r && g[i][c] === v) return false;
      }
      if (r === c) for (let i = 0; i < r; i++) if (g[i][i] === v) return false;
      if (r + c === n - 1) for (let i = 0; i < r; i++) if (g[i][n - 1 - i] === v) return false;
      return true;
    };
    const dfs = (idx: number): boolean => {
      if (idx === n * n) return true;
      const r = Math.floor(idx / n);
      const c = idx % n;
      for (const v of [...vals].sort(() => Math.random() - 0.5)) {
        if (!ok(r, c, v)) continue;
        g[r][c] = v;
        if (dfs(idx + 1)) return true;
        g[r][c] = 0;
      }
      return false;
    };
    dfs(0);
    return g;
  })();
  const target = n === 4 ? 5 : 8;
  const puzzle = full.map((r) => [...r]);
  const cells = [...Array(n * n)].map((_, i) => i).sort(() => Math.random() - 0.5);
  let clues = n * n;
  for (const i of cells) {
    if (clues <= target) break;
    const r = Math.floor(i / n);
    const c = i % n;
    const keep = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSquares(puzzle, 2).count !== 1) puzzle[r][c] = keep;
    else clues--;
  }
  return { solution: full, given: puzzle.map((row) => row.map((v) => v !== 0)) };
}
