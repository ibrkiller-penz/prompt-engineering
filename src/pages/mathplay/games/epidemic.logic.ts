// 감염병 막기의 계산 부분(순수 함수)
export const SIZE = 20;
export const S = 0; // 건강(감염될 수 있음)
export const I = 1; // 감염
export const R = 2; // 회복(면역)
export const V = 3; // 접종(면역)

export type Sim = { cells: Uint8Array; age: Uint8Array };

export const idx = (r: number, c: number) => r * SIZE + c;

/** 한 단계: 건강한 칸은 이웃 8칸 중 감염자 k 명에게서 각각 확률 p 로 옮는다(걸릴 확률 1-(1-p)^k).
 *  감염 칸은 duration 단계가 지나면 회복. rnd 는 0 이상 1 미만 난수 함수 */
export function stepSim(sim: Sim, p: number, duration: number, rnd: () => number): Sim {
  const { cells, age } = sim;
  const nc = new Uint8Array(cells);
  const na = new Uint8Array(age);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = idx(r, c);
      if (cells[i] === I) {
        na[i] = age[i] + 1;
        if (na[i] >= duration) {
          nc[i] = R;
          na[i] = 0;
        }
      } else if (cells[i] === S) {
        let k = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr,
              cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) continue;
            if (cells[idx(rr, cc)] === I) k++;
          }
        if (k > 0 && rnd() < 1 - Math.pow(1 - p, k)) {
          nc[i] = I;
          na[i] = 0;
        }
      }
    }
  }
  return { cells: nc, age: na };
}

export const count = (cells: Uint8Array, s: number) => {
  let n = 0;
  for (const x of cells) if (x === s) n++;
  return n;
};

/** 시작 상태 만들기: starts(감염자 칸), order(무작위 접종 순서), ratio(무작위 접종 비율), manual(직접 접종 표시) */
export function build(starts: number[], order: number[], ratio: number, manual: Uint8Array): Sim {
  const cells = new Uint8Array(SIZE * SIZE);
  const k = Math.round(ratio * SIZE * SIZE);
  let given = 0;
  for (const i of order) {
    if (given >= k) break;
    if (starts.includes(i)) continue;
    cells[i] = V;
    given++;
  }
  for (let i = 0; i < cells.length; i++) if (manual[i] && cells[i] === S && !starts.includes(i)) cells[i] = V;
  for (const s of starts) cells[s] = I;
  return { cells, age: new Uint8Array(SIZE * SIZE) };
}

/** 끝까지 돌려서 {최종 감염 비율, 최대 동시 감염자} */
export function runToEnd(sim: Sim, p: number, duration: number, rnd: () => number) {
  let s = sim;
  let peak = count(s.cells, I);
  let guard = 0;
  while (count(s.cells, I) > 0 && guard++ < 500) {
    s = stepSim(s, p, duration, rnd);
    peak = Math.max(peak, count(s.cells, I));
  }
  const ever = count(s.cells, R) + count(s.cells, I);
  return { ratio: ever / (SIZE * SIZE), peak };
}

export function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DURATION = 4;
export const BUDGET = 60;
export const DEFAULT_P = 0.12;
