// 로그 자 계산 (순수 함수)
/** 1~10 눈금의 위치(0~1). 길이는 log10(v)에 비례해요. */
export const logPos = (v: number) => Math.log10(v);
/** 위치(0~1)에서 눈금 값 */
export const valueAt = (p: number) => Math.pow(10, p);
/** 아래 자의 1을 위 자의 a 에 맞출 때 아래 자의 밀림(길이 단위) */
export const offsetFor = (a: number) => Math.log10(a);
/** 아래 자가 d 만큼 밀렸을 때, 아래 자의 b 와 마주 보는 위 눈금 값. 위 자 범위(1~10)를 넘으면 null */
export function readingAt(d: number, b: number): number | null {
  const p = d + Math.log10(b);
  if (p < -1e-12 || p > 1 + 1e-12) return null;
  return valueAt(p);
}
/** 허용 오차 비율 안에 있는지 */
export const within = (ans: number, truth: number, tol = 0.03) => Number.isFinite(ans) && truth !== 0 && Math.abs(ans - truth) / Math.abs(truth) <= tol;
/** 자리 이동을 뺀 가수(1 이상 10 미만)로 바꾸기 */
export function mantissa(x: number): number {
  let m = x;
  while (m >= 10) m /= 10;
  while (m < 1) m *= 10;
  return m;
}
