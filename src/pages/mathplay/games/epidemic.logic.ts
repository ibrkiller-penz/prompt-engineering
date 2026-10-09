// 감염병 막기의 계산 부분(순수 함수). 마을 한 변의 칸 수(size)를 바꿀 수 있어요.
export const S = 0; // 건강(감염될 수 있음)
export const I = 1; // 감염
export const R = 2; // 회복(면역)
export const V = 3; // 백신(면역)

export type Sim = { cells: Uint8Array; age: Uint8Array };

export const idx = (size: number, r: number, c: number) => r * size + c;

/** 한 단계: 건강한 칸은 이웃 8칸 중 감염자 k 명에게서 각각 확률 p 로 옮는다(걸릴 확률 1-(1-p)^k).
 *  감염 칸은 duration 단계가 지나면 회복. rnd 는 0 이상 1 미만 난수 함수 */
export function stepSim(sim: Sim, size: number, p: number, duration: number, rnd: () => number): Sim {
  const { cells, age } = sim;
  const nc = new Uint8Array(cells);
  const na = new Uint8Array(age);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(size, r, c);
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
            if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
            if (cells[idx(size, rr, cc)] === I) k++;
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

/** 시작 상태 만들기: starts(감염자 칸), order(무작위 백신 순서), ratio(무작위 백신 비율), manual(직접 놓은 백신 표시) */
export function build(size: number, starts: number[], order: number[], ratio: number, manual: Uint8Array): Sim {
  const cells = new Uint8Array(size * size);
  const k = Math.round(ratio * size * size);
  let given = 0;
  for (const i of order) {
    if (given >= k) break;
    if (starts.includes(i)) continue;
    cells[i] = V;
    given++;
  }
  for (let i = 0; i < cells.length; i++) if (manual[i] && cells[i] === S && !starts.includes(i)) cells[i] = V;
  for (const s of starts) cells[s] = I;
  return { cells, age: new Uint8Array(size * size) };
}

/** 끝까지 돌려서 {최종 감염 비율, 최대 동시 감염자} */
export function runToEnd(sim: Sim, size: number, p: number, duration: number, rnd: () => number) {
  let s = sim;
  let peak = count(s.cells, I);
  let guard = 0;
  while (count(s.cells, I) > 0 && guard++ < 500) {
    s = stepSim(s, size, p, duration, rnd);
    peak = Math.max(peak, count(s.cells, I));
  }
  const ever = count(s.cells, R) + count(s.cells, I);
  return { ratio: ever / (size * size), peak };
}

export function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 판 종류: 쉬움(작은 마을·아픈 친구 1명) / 어려운 도전(큰 마을·아픈 친구 3명) */
export const LEVELS = {
  easy: { size: 10, starts: 1, budget: 12 },
  hard: { size: 14, starts: 3, budget: 24 },
} as const;
export type Level = keyof typeof LEVELS;
export const DURATION = 4;
export const DEFAULT_P = 0.15;
/** 별: 아팠던 친구 비율이 5% 미만 3개, 10% 미만 2개, 20% 미만 1개 */
export const starsFor = (ratio: number) => (ratio < 0.05 ? 3 : ratio < 0.1 ? 2 : ratio < 0.2 ? 1 : 0);
