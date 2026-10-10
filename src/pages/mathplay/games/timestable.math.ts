// 구구단 곱셈표 퍼즐: 순수 계산
export type Slot = { k: "cell"; r: number; c: number } | { k: "rowH"; r: number } | { k: "colH"; c: number };
export type Puzzle = {
  n: number;
  rows: number[]; // 세로 머리 수(왼쪽)
  cols: number[]; // 가로 머리 수(위)
  slots: Slot[]; // 비어 있는 칸들
  tiles: number[]; // 수 조각(슬롯과 같은 개수, 섞인 순서)
};
export const slotKey = (s: Slot) => (s.k === "cell" ? `c${s.r}_${s.c}` : s.k === "rowH" ? `r${s.r}` : `h${s.c}`);
/** 슬롯의 정답 값 */
export const truth = (p: Puzzle, s: Slot) => (s.k === "cell" ? p.rows[s.r] * p.cols[s.c] : s.k === "rowH" ? p.rows[s.r] : p.cols[s.c]);

export const sizeOf = (level: number) => [2, 2, 3, 3, 4, 4, 4, 5, 5, 5][Math.max(1, Math.min(10, level)) - 1];
/** [빈 곱셈칸 수, 빈 머리칸 수] */
export const blanksOf = (level: number): [number, number] => [[3, 0], [3, 0], [4, 0], [4, 0], [5, 0], [4, 1], [4, 2], [4, 2], [3, 3], [3, 3]][Math.max(1, Math.min(10, level)) - 1] as [number, number];
const capOf = (level: number) => [3, 4, 5, 6, 7, 8, 9, 9, 9, 9][Math.max(1, Math.min(10, level)) - 1];

/**
 * 이 퍼즐을 푸는 방법의 수(2 이상이면 2). 모든 칸이 곱셈표 규칙(세로 수 × 가로 수 = 칸)을 만족하도록
 * 수 조각을 슬롯에 넣는 서로 다른 방법을 센다.
 */
export function countSolutions(p: Puzzle): number {
  const { n, slots } = p;
  const rowH: (number | null)[] = p.rows.map((v) => v), colH: (number | null)[] = p.cols.map((v) => v);
  const cell: (number | null)[][] = p.rows.map((rv) => p.cols.map((cv) => rv * cv));
  for (const s of slots) {
    if (s.k === "rowH") rowH[s.r] = null;
    else if (s.k === "colH") colH[s.c] = null;
    else cell[s.r][s.c] = null;
  }
  const counts = new Map<number, number>();
  for (const t of p.tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const vals = [...counts.keys()];
  let found = 0;
  const consistent = () => {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const a = rowH[r], b = colH[c], v = cell[r][c];
      if (a !== null && b !== null && v !== null && a * b !== v) return false;
    }
    return true;
  };
  const go = (i: number) => {
    if (found >= 2) return;
    if (i === slots.length) {
      if (consistent()) found++;
      return;
    }
    const s = slots[i];
    for (const v of vals) {
      if (!counts.get(v)) continue;
      counts.set(v, (counts.get(v) as number) - 1);
      if (s.k === "rowH") rowH[s.r] = v; else if (s.k === "colH") colH[s.c] = v; else cell[s.r][s.c] = v;
      if (consistent()) go(i + 1);
      if (s.k === "rowH") rowH[s.r] = null; else if (s.k === "colH") colH[s.c] = null; else cell[s.r][s.c] = null;
      counts.set(v, (counts.get(v) as number) + 1);
    }
  };
  go(0);
  return found;
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 레벨 level 의 퍼즐. 해가 딱 하나인 것만 돌려줘요. */
export function makePuzzle(level: number, rnd: () => number): Puzzle {
  const L = Math.max(1, Math.min(10, level));
  const n = sizeOf(L), cap = capOf(L);
  const [bc, bh] = blanksOf(L);
  for (let tr = 0; tr < 3000; tr++) {
    let rows: number[], cols: number[];
    if (L <= 6) {
      const s = 1 + Math.floor(rnd() * (cap - n + 1));
      rows = Array.from({ length: n }, (_, i) => s + i);
      cols = [...rows];
    } else {
      const pool = shuffle([2, 3, 4, 5, 6, 7, 8, 9].filter((v) => v <= cap), rnd);
      rows = pool.slice(0, n).sort((a, b) => a - b);
      cols = L >= 9 ? shuffle(pool, rnd).slice(0, n).sort((a, b) => a - b) : [...rows];
    }
    const cells: Slot[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ k: "cell", r, c });
    const hs: Slot[] = [];
    for (let i = 0; i < n; i++) { hs.push({ k: "rowH", r: i }); hs.push({ k: "colH", c: i }); }
    const slots = [...shuffle(cells, rnd).slice(0, Math.min(bc, cells.length)), ...shuffle(hs, rnd).slice(0, bh)];
    const p: Puzzle = { n, rows, cols, slots, tiles: [] };
    p.tiles = shuffle(slots.map((s) => truth(p, s)), rnd);
    if (new Set(p.tiles).size < Math.min(3, p.tiles.length)) continue;
    if (countSolutions(p) === 1) return p;
  }
  const p: Puzzle = { n: 2, rows: [1, 2], cols: [1, 2], slots: [{ k: "cell", r: 1, c: 1 }, { k: "cell", r: 0, c: 1 }, { k: "cell", r: 1, c: 0 }], tiles: [] };
  p.tiles = p.slots.map((s) => truth(p, s));
  return p;
}

/** 이 슬롯에 이 수 조각을 놓아도 되는가(정답과 같은가) */
export const fits = (p: Puzzle, s: Slot, v: number) => truth(p, s) === v;

/** 맞은편 대칭 칸: 세로 머리가 이 칸의 가로 머리이고 가로 머리가 이 칸의 세로 머리인 칸(자기 자신이면 null) */
export function mirror(p: Puzzle, r: number, c: number): [number, number] | null {
  const r2 = p.rows.indexOf(p.cols[c]), c2 = p.cols.indexOf(p.rows[r]);
  if (r2 < 0 || c2 < 0 || (r2 === r && c2 === c)) return null;
  return [r2, c2];
}

export type Hint = { slot: Slot; text: string };
/** 아직 안 채운 슬롯 중 설명하기 쉬운 것 하나와 이유 */
export function hintFor(p: Puzzle, filled: Set<string>): Hint | null {
  const left = p.slots.filter((s) => !filled.has(slotKey(s)));
  if (!left.length) return null;
  const isBlank = (s: Slot) => !filled.has(slotKey(s)) && p.slots.some((q) => slotKey(q) === slotKey(s));
  const rowKnown = (r: number) => !isBlank({ k: "rowH", r });
  const colKnown = (c: number) => !isBlank({ k: "colH", c });
  for (const s of left) if (s.k === "cell" && rowKnown(s.r) && colKnown(s.c)) return { slot: s, text: `이 칸은 ${p.rows[s.r]} × ${p.cols[s.c]} = ${p.rows[s.r] * p.cols[s.c]} 이에요. 가로 수와 세로 수를 곱해요!` };
  for (const s of left) {
    if (s.k === "rowH") {
      for (let c = 0; c < p.n; c++) if (colKnown(c) && !isBlank({ k: "cell", r: s.r, c })) return { slot: s, text: `같은 줄의 ${p.rows[s.r] * p.cols[c]} 는 □ × ${p.cols[c]} 예요. 그래서 □ = ${p.rows[s.r] * p.cols[c]} ÷ ${p.cols[c]} = ${p.rows[s.r]} 이에요.` };
    }
    if (s.k === "colH") {
      for (let r = 0; r < p.n; r++) if (rowKnown(r) && !isBlank({ k: "cell", r, c: s.c })) return { slot: s, text: `같은 줄의 ${p.rows[r] * p.cols[s.c]} 는 ${p.rows[r]} × □ 예요. 그래서 □ = ${p.rows[r] * p.cols[s.c]} ÷ ${p.rows[r]} = ${p.cols[s.c]} 이에요.` };
    }
  }
  const s = left[0];
  return { slot: s, text: `이 칸에는 ${truth(p, s)} 가 들어가요. 다른 칸을 먼저 채우면 단서가 늘어요!` };
}
