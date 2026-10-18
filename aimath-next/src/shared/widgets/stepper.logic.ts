// ± 스테퍼의 순수 계산(DOM 없음).

/** 소수 자릿수(0.05 → 2) */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = String(step);
  const e = s.indexOf("e-");
  if (e >= 0) return parseInt(s.slice(e + 2), 10);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : s.length - dot - 1;
}

/** 한 칸 움직이기. 범위 밖으로 나가지 않고, step 자릿수로 맞춰요 */
export function stepValue(v: number, dir: 1 | -1, step: number, min: number, max: number): number {
  const d = decimalsOf(step);
  const p = Math.pow(10, d);
  const base = Number.isFinite(v) ? v : min;
  // 칸 눈금에 맞추기(0.3 에서 +0.25 가 0.55 가 되지 않고 min 기준 눈금으로)
  const k = Math.round((base - min) / step);
  let next = min + (k + dir) * step;
  next = Math.round(next * p) / p;
  return Math.max(min, Math.min(max, next));
}

/** 입력값을 범위·눈금에 맞추기 */
export function snapValue(v: number, step: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  const d = decimalsOf(step);
  const p = Math.pow(10, d);
  const k = Math.round((v - min) / step);
  const s = Math.round((min + k * step) * p) / p;
  return Math.max(min, Math.min(max, s));
}

/** 길게 누를 때 반복 간격(ms): 처음엔 느리게, 오래 누르면 빠르게 */
export function repeatDelay(count: number): number {
  if (count < 1) return 400;
  if (count < 6) return 120;
  if (count < 20) return 70;
  return 40;
}
