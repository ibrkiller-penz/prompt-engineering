// 고무줄 판: 순수 계산 (못 좌표는 정수 격자)
export type Pt = [number, number];
export type Kind = "area" | "tri" | "rightTri" | "rect" | "sides";
/** area2 = 넓이의 2배(정수). 반 칸은 홀수로 나타내요. */
export type Spec = { kind: Kind; area2: number; minSides?: number };

export const eq = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
export const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const dot = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1]);

/** 신발끈 공식: 넓이의 2배 (항상 정수) */
export function area2(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s);
}

const onSeg = (a: Pt, b: Pt, p: Pt) => cross(a, b, p) === 0 && Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
/** 두 선분이 만나는지(끝점끼리 닿는 것도 포함) */
export function segsTouch(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return onSeg(a, b, c) || onSeg(a, b, d) || onSeg(c, d, a) || onSeg(c, d, b);
}

export type AddResult = { ok: true } | { ok: false; why: "same" | "dup" | "cross" };
/** 열린 고무줄 path 의 끝에서 p 로 이어도 되는지 */
export function canAdd(path: Pt[], p: Pt): AddResult {
  const n = path.length;
  if (n === 0) return { ok: true };
  const last = path[n - 1];
  if (eq(last, p)) return { ok: false, why: "same" };
  if (path.some((q) => eq(q, p))) return { ok: false, why: "dup" };
  if (n >= 2) {
    const prev = path[n - 2];
    if (cross(last, prev, p) === 0 && dot(last, prev, p) > 0) return { ok: false, why: "cross" }; // 되돌아 겹침
  }
  for (let i = 0; i + 2 < n; i++) if (segsTouch(path[i], path[i + 1], last, p)) return { ok: false, why: "cross" };
  return { ok: true };
}
/** 마지막 못에서 첫 못으로 닫아도 되는 도형인지 */
export function canClose(path: Pt[]): boolean {
  const n = path.length;
  if (n < 3) return false;
  const first = path[0], last = path[n - 1];
  if (cross(first, path[1], last) === 0 && dot(first, path[1], last) > 0) return false;
  if (cross(last, path[n - 2], first) === 0 && dot(last, path[n - 2], first) > 0) return false;
  for (let i = 1; i + 2 < n; i++) if (segsTouch(path[i], path[i + 1], last, first)) return false;
  return area2(path) > 0;
}
/** 닫힌 도형이 서로 겹치지 않는지(검증용) */
export function isSimple(path: Pt[]): boolean {
  const n = path.length;
  if (n < 3) return false;
  const seen = new Set(path.map((p) => p.join(",")));
  if (seen.size !== n) return false;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = path[i], b = path[(i + 1) % n], c = path[j], d = path[(j + 1) % n];
    const adj = j === i + 1 || (i === 0 && j === n - 1);
    if (adj) {
      // 이웃한 변은 한 점에서만 만나야 해요
      const s = j === i + 1 ? b : a;
      const o1 = j === i + 1 ? a : b, o2 = j === i + 1 ? d : c;
      if (cross(s, o1, o2) === 0 && dot(s, o1, o2) > 0) return false;
    } else if (segsTouch(a, b, c, d)) return false;
  }
  return area2(path) > 0;
}

/** 꺾이는 모서리 수 = 변의 수 (일직선 위의 못은 세지 않아요) */
export function sides(p: Pt[]): number {
  let k = 0;
  for (let i = 0; i < p.length; i++) if (cross(p[(i + p.length - 1) % p.length], p[i], p[(i + 1) % p.length]) !== 0) k++;
  return k;
}
function corners(p: Pt[]): Pt[] {
  return p.filter((_, i) => cross(p[(i + p.length - 1) % p.length], p[i], p[(i + 1) % p.length]) !== 0);
}
const rightAt = (c: Pt[], i: number) => dot(c[i], c[(i + c.length - 1) % c.length], c[(i + 1) % c.length]) === 0;

export function satisfies(spec: Spec, path: Pt[]): boolean {
  if (!isSimple(path) || area2(path) !== spec.area2) return false;
  const c = corners(path);
  if (spec.kind === "area") return true;
  if (spec.kind === "tri") return c.length === 3;
  if (spec.kind === "rightTri") return c.length === 3 && [0, 1, 2].filter((i) => rightAt(c, i)).length === 1;
  if (spec.kind === "rect") return c.length === 4 && [0, 1, 2, 3].every((i) => rightAt(c, i));
  return c.length >= (spec.minSides ?? 0);
}

export const fmtArea = (a2: number) => (a2 % 2 === 0 ? String(a2 / 2) : `${(a2 - 1) / 2}.5`);
export function describe(spec: Spec): string {
  const a = fmtArea(spec.area2);
  if (spec.kind === "area") return `넓이가 ${a}인 도형을 만들어요!`;
  if (spec.kind === "tri") return `넓이가 ${a}인 삼각형을 만들어요!`;
  if (spec.kind === "rightTri") return `넓이가 ${a}인 직각삼각형(ㄴ 모서리가 있는 삼각형)을 만들어요!`;
  if (spec.kind === "rect") return `넓이가 ${a}인 네모(직사각형)를 만들어요!`;
  return `넓이가 ${a}이고 변이 ${spec.minSides}개 이상인 도형을 만들어요!`;
}

// ───── 칸 세기 ─────
function crossesOpenCell(a: Pt, b: Pt, x0: number, y0: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const clip = (p: number, q: number) => {
    if (p === 0) return q > 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, a[0] - x0) && clip(dx, x0 + 1 - a[0]) && clip(-dy, a[1] - y0) && clip(dy, y0 + 1 - a[1]) && t1 - t0 > 1e-9;
}
function inside(p: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}
/** 도형 안에 통째로 들어간 네모 칸들의 왼쪽 위 좌표 */
export function fullCells(p: Pt[], N: number): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
    if (!inside(p, x + 0.5, y + 0.5)) continue;
    let cut = false;
    for (let i = 0; i < p.length && !cut; i++) if (crossesOpenCell(p[i], p[(i + 1) % p.length], x, y)) cut = true;
    if (!cut) out.push([x, y]);
  }
  return out;
}
/** 넓이 풀이: 꽉 찬 네모 F개 + 조각 합 R(반 칸 단위) */
export function explain(p: Pt[], N: number) {
  const F = fullCells(p, N).length;
  const rest2 = area2(p) - 2 * F;
  return { full: F, rest2, text: rest2 === 0 ? `네모 칸 ${F}개 = 넓이 ${F}` : `꽉 찬 네모 칸 ${F}개 + 잘린 조각을 합친 ${fmtArea(rest2)}칸 = 넓이 ${fmtArea(area2(p))}` };
}

// ───── 문제 만들기 ─────
export const gridOf = (level: number) => [4, 4, 5, 5, 6, 6, 6, 7, 7, 7][Math.max(1, Math.min(10, level)) - 1];

function pins(N: number): Pt[] {
  const o: Pt[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o.push([x, y]);
  return o;
}
const pick = <T,>(xs: T[], rnd: () => number) => xs[Math.floor(rnd() * xs.length)];

/** 조건에 맞는 도형 하나 찾기(없으면 null) */
export function findShape(N: number, spec: Spec, rnd: () => number): Pt[] | null {
  const P = pins(N);
  const found: Pt[][] = [];
  const addIf = (poly: Pt[]) => { if (found.length < 40 && satisfies(spec, poly)) found.push(poly); };
  if (spec.kind === "tri" || spec.kind === "rightTri" || spec.kind === "area") {
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) for (let k = j + 1; k < P.length; k++) {
      if (Math.abs(cross(P[i], P[j], P[k])) !== spec.area2) continue;
      addIf([P[i], P[j], P[k]]);
    }
  }
  if (spec.kind === "rect" || spec.kind === "area") {
    for (const o of P) for (let ux = -(N - 1); ux <= N - 1; ux++) for (let uy = -(N - 1); uy <= N - 1; uy++) {
      if (!ux && !uy) continue;
      const g = Math.abs(gcd(ux, uy));
      for (let s = 1; s <= N; s++) {
        const v: Pt = [(-uy / g) * s, (ux / g) * s];
        const q: Pt[] = [o, [o[0] + ux, o[1] + uy], [o[0] + ux + v[0], o[1] + uy + v[1]], [o[0] + v[0], o[1] + v[1]]];
        if (q.some((t) => t[0] < 0 || t[1] < 0 || t[0] >= N || t[1] >= N)) continue;
        if (spec.kind === "rect" ? area2(q) === spec.area2 : false) addIf(q);
        if (spec.kind === "area" && area2(q) === spec.area2) addIf(q);
      }
    }
  }
  if (found.length && spec.kind !== "sides") return pick(found, rnd);
  if (spec.kind === "area" || spec.kind === "sides") {
    const k = spec.kind === "sides" ? (spec.minSides as number) : 4;
    for (let tr = 0; tr < 40000 && found.length < 6; tr++) {
      const m = k + Math.floor(rnd() * 2);
      const pts: Pt[] = [];
      while (pts.length < m) { const q = P[Math.floor(rnd() * P.length)]; if (!pts.some((t) => eq(t, q))) pts.push(q); }
      const cx = pts.reduce((s, t) => s + t[0], 0) / m + 0.013, cy = pts.reduce((s, t) => s + t[1], 0) / m + 0.007;
      pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
      addIf(pts);
    }
  }
  return found.length ? pick(found, rnd) : null;
}
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); return b ? gcd(b, a % b) : a || 1; }

type Plan = { kind: Kind; lo: number; hi: number; half?: boolean; k?: number };
const I = (kind: Kind, lo: number, hi: number, k?: number): Plan => ({ kind, lo, hi, k });
const H = (kind: Kind, lo: number, hi: number, k?: number): Plan => ({ kind, lo, hi, half: true, k });
export const PLANS: Plan[][] = [
  [I("area", 1, 3), I("area", 1, 3), I("area", 2, 3)],
  [I("area", 3, 5), I("rect", 2, 4), I("area", 4, 6)],
  [H("area", 1.5, 4.5), I("rightTri", 2, 4), I("area", 5, 8)],
  [I("rect", 4, 8), H("rightTri", 2.5, 5.5), H("area", 3.5, 7.5)],
  [H("tri", 4.5, 8.5), I("sides", 6, 10, 4), H("rightTri", 4.5, 9.5)],
  [I("sides", 6, 9, 5), I("rect", 6, 12), H("tri", 5.5, 9.5)],
  [H("sides", 7.5, 11.5, 5), I("rightTri", 8, 12), I("rect", 8, 15)],
  [I("sides", 8, 12, 5), H("tri", 8.5, 13.5), H("area", 9.5, 14.5)],
  [I("sides", 10, 14, 6), I("rect", 12, 18), H("rightTri", 10.5, 15.5)],
  [H("sides", 12.5, 18.5, 6), H("sides", 12.5, 18.5, 5), I("rightTri", 12, 18)],
];

export type Quest = { spec: Spec; shape: Pt[] };
/** 레벨 level 의 idx(0~2)번째 라운드 문제. 풀 수 있다는 것이 확인된 문제만 돌려줘요. */
export function makeQuest(level: number, idx: number, rnd: () => number, avoid: number[] = []): Quest {
  const L = Math.max(1, Math.min(10, level));
  const N = gridOf(L);
  const pl = PLANS[L - 1][idx % 3];
  for (let tr = 0; tr < 80; tr++) {
    let a2 = Math.round(pl.lo * 2) + Math.floor(rnd() * (Math.round(pl.hi * 2) - Math.round(pl.lo * 2) + 1));
    if (pl.half ? a2 % 2 === 0 : a2 % 2 === 1) a2 += a2 < Math.round(pl.hi * 2) ? 1 : -1;
    if (avoid.includes(a2) && tr < 60) continue;
    const spec: Spec = { kind: pl.kind, area2: a2, minSides: pl.k };
    const shape = findShape(N, spec, rnd);
    if (shape) return { spec, shape };
  }
  const spec: Spec = { kind: "area", area2: 4 };
  return { spec, shape: [[0, 0], [2, 0], [2, 1], [0, 1]] };
}
