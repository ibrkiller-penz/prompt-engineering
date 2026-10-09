// 어획량 정하기의 계산 부분(순수 함수)
export const R = 0.5;
export const K = 1000;
export const START = 600;
export const YEARS = 20;
export const COLLAPSE = 100; // 이 아래로 떨어지면 붕괴
export const MSY = (R * K) / 4; // 125

/** 한 해: 자란 뒤 잡는다. catch 는 실제로 잡은 양 */
export function stepYear(n: number, h: number, r = R): { next: number; catchAmt: number; collapsed: boolean } {
  const grown = n + r * n * (1 - n / K);
  const catchAmt = Math.max(0, Math.min(h, grown));
  const next = Math.max(0, grown - catchAmt);
  return { next, catchAmt, collapsed: next < COLLAPSE };
}

/** 해마다 어획량 배열을 주면 끝까지(붕괴하면 거기까지) 돌려 본다 */
export function simulate(hs: number[], r = R, start = START) {
  let n = start;
  const stock = [n];
  const catches: number[] = [];
  let total = 0;
  let collapsedAt = 0;
  for (let y = 0; y < hs.length; y++) {
    const s = stepYear(n, hs[y], r);
    catches.push(s.catchAmt);
    total += s.catchAmt;
    n = s.next;
    stock.push(n);
    if (s.collapsed) {
      collapsedAt = y + 1;
      break;
    }
  }
  return { stock, catches, total, collapsedAt };
}

/** 20년 안에 붕괴하지 않으면서 총 어획량을 가장 크게 하는 점수(동적계획법, 5 단위) */
export function bestScore(years = YEARS, r = R, start = START, step = 5): number {
  const G = 1000; // 물고기 수 칸(0..1000, 1 단위)
  const H = Array.from({ length: Math.floor(300 / step) + 1 }, (_, i) => i * step);
  let V = new Float64Array(G + 1); // 남은 해가 0 일 때 가치 0
  const interp = (arr: Float64Array, x: number) => {
    const c = Math.max(0, Math.min(G, x));
    const lo = Math.floor(c),
      hi = Math.min(G, lo + 1);
    return arr[lo] + (arr[hi] - arr[lo]) * (c - lo);
  };
  for (let y = 0; y < years; y++) {
    const nv = new Float64Array(G + 1);
    for (let n = 0; n <= G; n++) {
      let best = -1e9;
      for (const h of H) {
        const s = stepYear(n, h, r);
        if (s.collapsed) continue;
        const v = s.catchAmt + interp(V, s.next);
        if (v > best) best = v;
      }
      nv[n] = best;
    }
    V = nv;
  }
  return interp(V, start);
}

/** 레벨 1~10: 기간(년)·번식 빠르기·처음 물고기 수·목표 비율(가장 잘했을 때의 몇 %를 잡아야 하는지) */
export const FISH_LEVELS = [
  { years: 5, r: 0.5, start: 600, f: 0.6 },
  { years: 5, r: 0.5, start: 600, f: 0.65 },
  { years: 6, r: 0.45, start: 550, f: 0.68 },
  { years: 6, r: 0.45, start: 500, f: 0.7 },
  { years: 7, r: 0.4, start: 500, f: 0.72 },
  { years: 7, r: 0.4, start: 450, f: 0.74 },
  { years: 8, r: 0.35, start: 450, f: 0.76 },
  { years: 8, r: 0.35, start: 400, f: 0.78 },
  { years: 9, r: 0.3, start: 400, f: 0.72 },
  { years: 10, r: 0.3, start: 400, f: 0.76 },
] as const;
export const fishLevel = (lv: number) => FISH_LEVELS[Math.max(1, Math.min(10, lv)) - 1];
/** 한 라운드 문제: 시작 수를 조금씩 흔들고, 목표 = (25 단위로 고를 때 가장 많이 잡는 양) × f 를 10 단위로 내림 */
export function fishRound(lv: number, round: number) {
  const L = fishLevel(lv);
  const start = L.start + [0, -30, 30][(round - 1) % 3];
  const best = bestScore(L.years, L.r, start, 25);
  const goal = Math.floor((best * L.f) / 10) * 10;
  return { years: L.years, r: L.r, start, best, goal, msy: (L.r * K) / 4 };
}
