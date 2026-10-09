// 조건부확률·베이즈 계산 (React 없음)
export interface Counts {
  ab: number; // A이고 B
  anb: number; // A이고 B 아님
  nab: number; // A 아니고 B
  nanb: number; // 둘 다 아님
}

/** 확률 p,t,f 는 0~1. 분모가 0이면 null */
export function posterior(prior: number, hit: number, falseAlarm: number): number | null {
  const num = prior * hit;
  const den = num + (1 - prior) * falseAlarm;
  if (den <= 0) return null;
  return num / den;
}

/** P(B) = P(A)P(B|A) + P(¬A)P(B|¬A) */
export function probB(prior: number, hit: number, falseAlarm: number): number {
  return prior * hit + (1 - prior) * falseAlarm;
}

/** 합이 항상 total 이 되도록 최대잉여법으로 인원을 나눈다 */
export function splitCounts(prior: number, hit: number, falseAlarm: number, total = 1000): Counts {
  const exact = [prior * hit, prior * (1 - hit), (1 - prior) * falseAlarm, (1 - prior) * (1 - falseAlarm)].map((x) => x * total);
  const base = exact.map(Math.floor);
  let rest = total - base.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((p, q) => q.r - p.r || p.i - q.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) base[order[k].i]++;
  return { ab: base[0], anb: base[1], nab: base[2], nanb: base[3] };
}

/** B가 연달아 n번 나왔을 때 사후확률 목록 [처음 prior, 1번 후, 2번 후, …] */
export function updateChain(prior: number, hit: number, falseAlarm: number, n: number): number[] {
  const out = [prior];
  let p = prior;
  for (let i = 0; i < n; i++) {
    const q = posterior(p, hit, falseAlarm);
    p = q === null ? p : q;
    out.push(p);
  }
  return out;
}

/** 1000명 아이콘의 색 목록: 0=A&B, 1=A&¬B, 2=¬A&B, 3=¬A&¬B */
export function iconGroups(c: Counts): number[] {
  const arr: number[] = [];
  for (let i = 0; i < c.ab; i++) arr.push(0);
  for (let i = 0; i < c.anb; i++) arr.push(1);
  for (let i = 0; i < c.nab; i++) arr.push(2);
  for (let i = 0; i < c.nanb; i++) arr.push(3);
  return arr;
}
