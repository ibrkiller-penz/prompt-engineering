// 카드 쓸기(좌우) 판정. 순수 함수(DOM 없음).
// 가로로 충분히(기본 56px) 움직이고, 세로보다 1.4배 이상 가로로 움직였으며, 너무 오래(700ms) 끌지 않았을 때만 넘겨요.

export type SwipeDir = "next" | "prev" | null;

export interface SwipeOpts {
  min?: number;
  ratio?: number;
  maxMs?: number;
}

export function swipeDir(dx: number, dy: number, ms: number, opts: SwipeOpts = {}): SwipeDir {
  const min = opts.min || 56;
  const ratio = opts.ratio || 1.4;
  const maxMs = opts.maxMs || 700;
  if (ms > maxMs) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < min || ax < ay * ratio) return null;
  return dx < 0 ? "next" : "prev";
}
