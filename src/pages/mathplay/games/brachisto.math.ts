// 가장 빠른 길 경주: 순수 계산.
// 구슬은 정지 상태에서 출발하고, 에너지 보존으로 v = √(2 g d) (d 는 출발 높이보다 내려온 깊이).
// 이동 시간 = ∫ ds / v. 길은 매개변수 u(0~1)로 나타내고 깊이 d 는 아래쪽이 +.
export const G = 9.8;

export type Sample = { x: number; d: number; dx: number; dd: number }; // 위치(x, 깊이 d)와 u 에 대한 미분
export type PathFn = (u: number) => Sample;

export type Table = { w: Float64Array; t: Float64Array; T: number; path: PathFn };

/**
 * 시간 표를 만든다. u = w² 로 바꿔 출발점의 1/√d 특이성을 없앤다.
 * 가운데점 합으로 적분: t(w) = ∫ |P'(u)| / √(2 g d(u)) · 2w dw
 */
export function buildTable(path: PathFn, K = 4000, g = G): Table {
  const w = new Float64Array(K + 1);
  const t = new Float64Array(K + 1);
  for (let k = 0; k <= K; k++) w[k] = k / K;
  for (let k = 0; k < K; k++) {
    const wm = (k + 0.5) / K;
    const u = wm * wm;
    const s = path(u);
    const speed = Math.sqrt(2 * g * Math.max(s.d, 1e-300));
    const f = (Math.hypot(s.dx, s.dd) / speed) * 2 * wm;
    t[k + 1] = t[k] + f / K;
  }
  return { w, t, T: t[K], path };
}

/** 시간 τ 에서의 매개변수 u (표를 거꾸로 읽는다) */
export function uAtTime(tab: Table, tau: number): number {
  if (tau <= 0) return 0;
  if (tau >= tab.T) return 1;
  let lo = 0, hi = tab.t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tab.t[mid] <= tau) lo = mid;
    else hi = mid;
  }
  const f = (tau - tab.t[lo]) / (tab.t[hi] - tab.t[lo] || 1);
  const w = tab.w[lo] + f * (tab.w[hi] - tab.w[lo]);
  return w * w;
}

/** 시간 τ 에서 구슬 위치 */
export const posAt = (tab: Table, tau: number) => tab.path(uAtTime(tab, tau));

// ───────── 경주: A=(0,0), B=(xb, yb), 아래쪽이 + ─────────
export type RaceId = "line" | "cyc" | "arc" | "dip";
export const RACE_NAMES: Record<RaceId, string> = { line: "곧은 길", cyc: "사이클로이드", arc: "둥근 원호", dip: "깊이 처졌다 올라오는 길" };

export type Race = { xb: number; yb: number; theta: number; paths: Record<RaceId, PathFn> };

/** 사이클로이드(반지름 1)의 θ 지점을 B 로 삼는 경주판 */
/** kf: ‘깊이 처진 길’이 얼마나 깊이 처지는지(도착점 높이의 몇 배) */
export function makeRace(theta: number, kf = 2.2, af = 1): Race {
  const xb = theta - Math.sin(theta);
  const yb = 1 - Math.cos(theta);
  const line: PathFn = (u) => ({ x: xb * u, d: yb * u, dx: xb, dd: yb });
  const cyc: PathFn = (u) => {
    const th = theta * u;
    return { x: th - Math.sin(th), d: 1 - Math.cos(th), dx: theta * (1 - Math.cos(th)), dd: theta * Math.sin(th) };
  };
  // 원호: A, B 를 지나는 원의 일부. af=1 이면 A 에서 수직으로 출발(가장 많이 휨), af 가 작을수록 곧은 길에 가까워짐.
  // 중심은 현(AB)의 수직이등분선 위 오른쪽 위에 있다: 중심 = 중점 + t·n, t = tV / af
  const R0 = (xb * xb + yb * yb) / (2 * xb); // af=1 원의 중심 (R0, 0)
  const mx = xb / 2, my = yb / 2;
  const L = Math.hypot(xb, yb);
  const nx = yb / L, ny = -xb / L; // 현에 수직(오른쪽 위)
  const tV = (R0 - mx) * nx + (0 - my) * ny;
  const t = tV / Math.max(0.05, af);
  const cx = mx + t * nx, cy = my + t * ny;
  const R = Math.hypot(cx, cy);
  const phA = Math.atan2(-cy, -cx);
  let dph = Math.atan2(yb - cy, xb - cx) - phA;
  while (dph > Math.PI) dph -= 2 * Math.PI;
  while (dph <= -Math.PI) dph += 2 * Math.PI;
  const arc: PathFn = (u) => {
    const p = phA + dph * u;
    return { x: cx + R * Math.cos(p), d: cy + R * Math.sin(p), dx: -R * Math.sin(p) * dph, dd: R * Math.cos(p) * dph };
  };
  const k = kf * yb;
  const dip: PathFn = (u) => ({ x: xb * u, d: yb * u + k * u * (1 - u), dx: xb, dd: yb + k * (1 - 2 * u) });
  return { xb, yb, theta, paths: { line, cyc, arc, dip } };
}

export function raceTimes(race: Race, K = 4000): Record<RaceId, number> {
  const out = {} as Record<RaceId, number>;
  (Object.keys(race.paths) as RaceId[]).forEach((id) => (out[id] = buildTable(race.paths[id], K).T));
  return out;
}

/** 직선(경사면) 정확한 시간: T = √(2 L² / (g · Δy)) */
export const lineExact = (xb: number, yb: number, g = G) => Math.sqrt((2 * (xb * xb + yb * yb)) / (g * yb));
/** 사이클로이드(반지름 R=1)를 θ 까지 내려오는 정확한 시간: θ √(R/g) */
export const cycExact = (theta: number, g = G) => theta * Math.sqrt(1 / g);

// ───────── 등시곡선: 그릇 바닥까지 내려오는 시간 ─────────
export type BowlId = "cyc" | "arc" | "line";
export const BOWL_NAMES: Record<BowlId, string> = { cyc: "사이클로이드 그릇", arc: "둥근(원호) 그릇", line: "곧은 경사 그릇" };
export const BOWL_R = 0.5; // 사이클로이드 생성 원 반지름 → 그릇 높이 2R = 1 m
export const BOWL_H = 2 * BOWL_R;
export const BOWL_L = 4 * BOWL_R; // 원호 그릇 반지름(바닥에서의 곡률이 사이클로이드와 같게)
export const BOWL_LINE_X = 1.6; // 곧은 그릇 반쪽 너비 (높이 1 m 일 때)

/** 왼쪽 위(높이 h0)에서 바닥까지 가는 길. 반환 깊이 d = h0 − 높이. 위치 x 는 바닥이 0, 왼쪽이 음수 */
export function bowlPath(kind: BowlId, h0: number): PathFn {
  if (kind === "cyc") {
    const ts = Math.acos(1 - h0 / BOWL_R); // h = R(1−cos θ)
    return (u) => {
      const th = -ts + ts * u;
      return { x: BOWL_R * (th + Math.sin(th)), d: h0 - BOWL_R * (1 - Math.cos(th)), dx: BOWL_R * (1 + Math.cos(th)) * ts, dd: -BOWL_R * Math.sin(th) * ts };
    };
  }
  if (kind === "arc") {
    const ps = Math.acos(1 - h0 / BOWL_L);
    return (u) => {
      const p = -ps + ps * u;
      return { x: BOWL_L * Math.sin(p), d: h0 - BOWL_L * (1 - Math.cos(p)), dx: BOWL_L * Math.cos(p) * ps, dd: -BOWL_L * Math.sin(p) * ps };
    };
  }
  const kx = BOWL_LINE_X / BOWL_H; // x 길이 / 높이
  return (u) => ({ x: -h0 * kx * (1 - u), d: h0 * u, dx: h0 * kx, dd: h0 });
}

export const bowlTime = (kind: BowlId, h0: number, K = 4000) => buildTable(bowlPath(kind, h0), K).T;

/** 그릇 모양의 높이 h(x) 곡선 점들 (왼쪽 위 → 오른쪽 위) */
export function bowlOutline(kind: BowlId, n = 120): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = -1 + (2 * i) / n;
    if (kind === "cyc") {
      const th = Math.PI * f;
      out.push([BOWL_R * (th + Math.sin(th)), BOWL_R * (1 - Math.cos(th))]);
    } else if (kind === "arc") {
      const p = (Math.PI / 3) * f;
      out.push([BOWL_L * Math.sin(p), BOWL_L * (1 - Math.cos(p))]);
    } else out.push([BOWL_LINE_X * f, BOWL_H * Math.abs(f)]);
  }
  return out;
}

export const SAME_TOL = 0.005; // 5 ms 보다 작은 차이는 ‘동시’
export const isSimultaneous = (kind: BowlId, h1: number, h2: number) => Math.abs(bowlTime(kind, h1) - bowlTime(kind, h2)) < SAME_TOL;

// ───────── 레벨(1~10) 문제 만들기 ─────────
export type Ask = "first" | "second" | "last";
export type RoundSpec = { kind: "race"; theta: number; kf: number; af: number; ask: Ask } | { kind: "bowl"; bowl: BowlId; hA: number; hB: number };

/** 레벨마다 라운드 3개의 질문 종류 */
export const LEVEL_PLAN: (Ask | "bowl")[][] = [
  ["first", "first", "first"],
  ["first", "first", "last"],
  ["first", "last", "last"],
  ["last", "first", "second"],
  ["second", "last", "first"],
  ["bowl", "second", "last"],
  ["second", "last", "bowl"],
  ["second", "bowl", "last"],
  ["bowl", "second", "last"],
  ["second", "bowl", "second"],
];
export const RACE_GAP = 0.02; // 등수끼리 시간이 이만큼(초) 이상 벌어진 판만 낸다

/** 도착 순서(빠른 것부터)와 시간 */
export function raceOrder(theta: number, kf: number, af = 1, K = 3000) {
  const T = raceTimes(makeRace(theta, kf, af), K);
  const order = (Object.keys(T) as RaceId[]).sort((a, b) => T[a] - T[b]);
  return { T, order };
}
export const answerOf = (order: RaceId[], ask: Ask): RaceId => (ask === "first" ? order[0] : ask === "second" ? order[1] : order[order.length - 1]);

export function makeRound(level: number, idx: number, rnd: () => number): RoundSpec {
  const L = Math.max(1, Math.min(10, level));
  const kind = LEVEL_PLAN[L - 1][idx % 3];
  if (kind === "bowl") {
    const kinds: BowlId[] = L < 8 ? ["cyc", "arc"] : ["cyc", "arc", "line"];
    const hA = Math.round((0.7 + 0.25 * rnd()) * 100) / 100;
    const hB = Math.round((0.15 + 0.3 * rnd()) * 100) / 100;
    return { kind: "bowl", bowl: kinds[Math.floor(rnd() * kinds.length)], hA, hB };
  }
  for (let tries = 0; tries < 300; tries++) {
    const theta = L === 1 ? [Math.PI, 3.3, 3.6][idx % 3] : Math.round((2.0 + 1.6 * rnd()) * 1000) / 1000;
    const kf = L <= 2 ? 2.2 : Math.round((0.5 + 5.5 * rnd()) * 10) / 10;
    const af = L <= 2 ? 1 : Math.round((0.1 + 0.9 * rnd()) * 100) / 100;
    const { T, order } = raceOrder(theta, kf, af, 1500);
    const gaps = order.slice(1).map((id, i) => T[id] - T[order[i]]);
    const need = kind === "first" ? [0] : kind === "second" ? [0, 1] : [2];
    if (need.every((i) => gaps[i] >= RACE_GAP)) return { kind: "race", theta, kf, af, ask: kind };
  }
  return { kind: "race", theta: Math.PI, kf: 2.2, af: 1, ask: kind };
}
