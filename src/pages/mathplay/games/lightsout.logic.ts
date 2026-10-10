// 불 끄기: N×N 전구, 누르면 그 칸과 위·아래·왼쪽·오른쪽이 뒤집혀요. true = 켜짐.
export type Board = boolean[];

export function press(b: Board, N: number, i: number): Board {
  const q = b.slice();
  const x = i % N;
  const y = Math.floor(i / N);
  q[i] = !q[i];
  if (x > 0) q[i - 1] = !q[i - 1];
  if (x < N - 1) q[i + 1] = !q[i + 1];
  if (y > 0) q[i - N] = !q[i - N];
  if (y < N - 1) q[i + N] = !q[i + N];
  return q;
}
export const allOff = (b: Board) => b.every((v) => !v);

/** 빈 판에서 서로 다른 k칸을 눌러 만든 시작 판 (반드시 풀 수 있어요) */
export function makeBoard(N: number, k: number, rnd: () => number = Math.random): { board: Board; made: number[] } {
  for (let t = 0; t < 200; t++) {
    const cells = Array.from({ length: N * N }, (_, i) => i);
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rnd() * (cells.length - i));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const made = cells.slice(0, k).sort((a, b) => a - b);
    let b: Board = Array(N * N).fill(false);
    for (const c of made) b = press(b, N, c);
    if (!allOff(b) && b.filter(Boolean).length >= 2) return { board: b, made };
  }
  throw new Error("판을 못 만들었어요");
}

/** GF(2) 가우스 소거로 b를 모두 끄는 누르기 목록 중 가장 적은 것. 못 풀면 null */
export function solve(b: Board, N: number): number[] | null {
  const M = N * N;
  // 행 r = 칸 r의 불이 바뀌는 식: sum_c A[r][c] x_c = b[r]
  const rows: number[][] = [];
  for (let r = 0; r < M; r++) {
    const row = Array(M + 1).fill(0);
    const rx = r % N;
    const ry = Math.floor(r / N);
    for (let c = 0; c < M; c++) {
      const cx = c % N;
      const cy = Math.floor(c / N);
      if (Math.abs(rx - cx) + Math.abs(ry - cy) <= 1) row[c] = 1;
    }
    row[M] = b[r] ? 1 : 0;
    rows.push(row);
  }
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < M && r < M; c++) {
    let p = -1;
    for (let i = r; i < M; i++) if (rows[i][c]) {
      p = i;
      break;
    }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < M; i++) if (i !== r && rows[i][c]) for (let k = c; k <= M; k++) rows[i][k] ^= rows[r][k];
    pivotCol.push(c);
    r++;
  }
  for (let i = r; i < M; i++) if (rows[i][M]) return null;
  const free = Array.from({ length: M }, (_, c) => c).filter((c) => !pivotCol.includes(c));
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = Array(M).fill(0);
    free.forEach((c, j) => (x[c] = (mask >> j) & 1));
    pivotCol.forEach((c, i) => {
      let v = rows[i][M];
      for (const f of free) if (rows[i][f] && x[f]) v ^= 1;
      x[c] = v;
    });
    const list = x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (!best || list.length < best.length) best = list;
  }
  return best;
}
export const minPresses = (b: Board, N: number) => solve(b, N)?.length ?? -1;

export type LRound = { N: number; board: Board; min: number };
/** 레벨별 [판 크기, 누른 칸 수] 3개 */
export const LEVEL_PLAN: [number, number][][] = [
  [[3, 1], [3, 1], [3, 2]],
  [[3, 2], [3, 2], [3, 3]],
  [[3, 3], [3, 3], [3, 4]],
  [[3, 4], [3, 4], [3, 5]],
  [[4, 2], [4, 3], [4, 3]],
  [[4, 3], [4, 4], [4, 4]],
  [[4, 5], [4, 6], [4, 6]],
  [[5, 3], [5, 4], [5, 4]],
  [[5, 5], [5, 5], [5, 6]],
  [[5, 6], [5, 7], [5, 8]],
];
export function levelRounds(level: number, rnd: () => number = Math.random): LRound[] {
  return LEVEL_PLAN[Math.min(10, Math.max(1, level)) - 1].map(([N, k]) => {
    const { board } = makeBoard(N, k, rnd);
    return { N, board, min: minPresses(board, N) };
  });
}
/** 별: 최소 횟수면 3개, 최소+2 이내면 2개, 그 밖엔 1개 */
export const starsFor = (presses: number, min: number) => (presses <= min ? 3 : presses <= min + 2 ? 2 : 1);
