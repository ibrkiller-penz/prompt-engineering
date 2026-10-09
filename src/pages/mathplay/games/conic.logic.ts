// 이차곡선 계산 (순수 함수). 초점 F 는 원점, 준선은 x = D.
export const D = 2;
export type Kind = "타원" | "포물선" | "쌍곡선";
export const classify = (e: number): Kind => (Math.abs(e - 1) < 1e-9 ? "포물선" : e < 1 ? "타원" : "쌍곡선");
/** e=1 근처를 1로 붙이고 소수 둘째 자리로 맞추기 */
export const snapE = (e: number) => (Math.abs(e - 1) < 0.045 ? 1 : Math.round(e * 100) / 100);
/** 극좌표 r = ℓ/(1+e cosθ), ℓ = e·D */
export const radius = (e: number, th: number, d = D) => (e * d) / (1 + e * Math.cos(th));
export const pointAt = (e: number, th: number, d = D): [number, number] => {
  const r = radius(e, th, d);
  return [r * Math.cos(th), r * Math.sin(th)];
};
/** 점 P 에서 초점까지 거리, 준선까지 거리, 그 비 */
export function measure(p: [number, number], d = D) {
  const pf = Math.hypot(p[0], p[1]);
  const dist = Math.abs(d - p[0]);
  return { pf, dist, ratio: dist === 0 ? Infinity : pf / dist };
}
/** 곡선을 여러 토막의 꺾은선으로. |r| 이 rmax 를 넘는 곳(무한대)은 끊는다. */
export function curveSegments(e: number, d = D, rmax = 40, n = 1440): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const den = 1 + e * Math.cos(th);
    const r = (e * d) / den;
    if (Math.abs(den) < 1e-9 || Math.abs(r) > rmax) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
      continue;
    }
    const prev = cur.length ? Math.sign(1 + e * Math.cos(((i - 1) / n) * Math.PI * 2)) : 0;
    if (cur.length && prev !== Math.sign(den)) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  if (cur.length > 1) segs.push(cur);
  // 처음(θ=0)과 끝(θ=2π)에서 이어지는 토막은 하나로 합친다
  if (segs.length > 1 && n >= 1 && Math.abs(1 + e) > 1e-9 && Math.abs((e * d) / (1 + e) ) <= rmax) {
    const f = segs.shift()!;
    const l = segs.pop()!;
    segs.unshift(l.concat(f.slice(1)));
  }
  // 타원은 시작·끝이 이어지므로 닫아 준다
  if (e < 1 && segs.length === 1) segs[0].push(segs[0][0]);
  return segs;
}
