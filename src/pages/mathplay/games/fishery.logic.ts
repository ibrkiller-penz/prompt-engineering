// 어획량 정하기의 계산 부분(순수 함수)
export const R = 0.5;
export const K = 1000;
export const START = 600;
export const YEARS = 20;
export const COLLAPSE = 100; // 이 아래로 떨어지면 붕괴
export const MSY = (R * K) / 4; // 125

/** 한 해: 자란 뒤 잡는다. catch 는 실제로 잡은 양 */
export function stepYear(n: number, h: number): { next: number; catchAmt: number; collapsed: boolean } {
  const grown = n + R * n * (1 - n / K);
  const catchAmt = Math.max(0, Math.min(h, grown));
  const next = Math.max(0, grown - catchAmt);
  return { next, catchAmt, collapsed: next < COLLAPSE };
}

/** 해마다 어획량 배열을 주면 끝까지(붕괴하면 거기까지) 돌려 본다 */
export function simulate(hs: number[]) {
  let n = START;
  const stock = [n];
  const catches: number[] = [];
  let total = 0;
  let collapsedAt = 0;
  for (let y = 0; y < hs.length; y++) {
    const r = stepYear(n, hs[y]);
    catches.push(r.catchAmt);
    total += r.catchAmt;
    n = r.next;
    stock.push(n);
    if (r.collapsed) {
      collapsedAt = y + 1;
      break;
    }
  }
  return { stock, catches, total, collapsedAt };
}

/** 20년 안에 붕괴하지 않으면서 총 어획량을 가장 크게 하는 점수(동적계획법, 5 단위) */
export function bestScore(): number {
  const G = 1000; // 물고기 수 칸(0..1000, 1 단위)
  const H = Array.from({ length: 61 }, (_, i) => i * 5);
  let V = new Float64Array(G + 1); // 남은 해가 0 일 때 가치 0
  const interp = (arr: Float64Array, x: number) => {
    const c = Math.max(0, Math.min(G, x));
    const lo = Math.floor(c),
      hi = Math.min(G, lo + 1);
    return arr[lo] + (arr[hi] - arr[lo]) * (c - lo);
  };
  for (let y = 0; y < YEARS; y++) {
    const nv = new Float64Array(G + 1);
    for (let n = 0; n <= G; n++) {
      let best = -1e9;
      for (const h of H) {
        const r = stepYear(n, h);
        if (r.collapsed) continue;
        const v = r.catchAmt + interp(V, r.next);
        if (v > best) best = v;
      }
      nv[n] = best;
    }
    V = nv;
  }
  return interp(V, START);
}
