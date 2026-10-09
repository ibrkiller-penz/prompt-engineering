// 수 쪼개기 계산 (순수 함수)
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
/** n = d × (n/d), 2 ≤ d ≤ n/d 인 약수 쌍 */
export function divisorPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = 2; d * d <= n; d++) if (n % d === 0) out.push([d, n / d]);
  return out;
}
/** 소인수를 작은 것부터 늘어놓기 */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) while (m % p === 0) { out.push(p); m /= p; }
  if (m > 1) out.push(m);
  return out;
}
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (n: number) => String(n).split("").map((c) => SUP[+c]).join("");
/** [2,2,3,3] -> "2²×3²" */
export function powerForm(fs: number[]): string {
  const m = new Map<number, number>();
  for (const f of fs) m.set(f, (m.get(f) ?? 0) + 1);
  return [...m].map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : `${p}`)).join("×");
}
export const isComposite = (n: number) => n >= 4 && !isPrime(n);

export type TNode = { id: number; v: number; kids: [number, number] | null };
/** 나무 안의 잎(오른쪽 끝) 값들을 왼쪽부터 */
export function leaves(nodes: TNode[], id = 0): number[] {
  const n = nodes[id];
  return n.kids ? [...leaves(nodes, n.kids[0]), ...leaves(nodes, n.kids[1])] : [n.v];
}
/** 노드 n 을 [a,b]로 쪼갠 새 나무 (a×b === n.v 일 때만) */
export function split(nodes: TNode[], id: number, a: number, b: number): TNode[] | null {
  const n = nodes[id];
  if (!n || n.kids || a * b !== n.v || a < 2 || b < 2) return null;
  const A = nodes.length;
  const next = nodes.map((x) => (x.id === id ? { ...x, kids: [A, A + 1] as [number, number] } : x));
  next.push({ id: A, v: a, kids: null }, { id: A + 1, v: b, kids: null });
  return next;
}
export const allPrime = (nodes: TNode[]) => leaves(nodes).every(isPrime);
