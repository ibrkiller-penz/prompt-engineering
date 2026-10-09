export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 메시지 한 개: x = 느낌표 수(0~10), y = 광고 단어 수(0~10), label 1 = 스팸, 0 = 정상 */
export type Pt = { x: number; y: number; label: 0 | 1 };

function gauss(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

/** 스팸/정상을 반반 섞어 n개 생성. 경계는 대각선(x+y=10)이라 '한 줄 규칙'으로는 딱 안 나뉜다. */
export function makeData(n: number, seed: number): Pt[] {
  const rnd = mulberry32(seed);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const label: 0 | 1 = i % 2 === 0 ? 1 : 0;
    const s = label === 1 ? 1 : -1;
    const d = 1.7 + 0.8 * gauss(rnd);
    const v = (rnd() - 0.5) * 5;
    out.push({ x: clamp(5 + s * d + v), y: clamp(5 + s * d - v), label });
  }
  // 순서를 섞는다
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type Rule = { t1: number; t2: number; op: "AND" | "OR" };

/** IF (x ≥ t1) op (y ≥ t2) THEN 스팸 */
export function rulePredict(r: Rule, p: { x: number; y: number }): 0 | 1 {
  const a = p.x >= r.t1;
  const b = p.y >= r.t2;
  return (r.op === "AND" ? a && b : a || b) ? 1 : 0;
}

export function accuracy(pred: (p: Pt) => number, data: Pt[]): number {
  if (data.length === 0) return 0;
  let ok = 0;
  for (const p of data) if (pred(p) === p.label) ok++;
  return ok / data.length;
}

export type Model = { w1: number; w2: number; b: number };
export const INIT_MODEL: Model = { w1: 0, w2: 0, b: 0 };

export function modelPredict(m: Model, p: { x: number; y: number }): 0 | 1 {
  return m.w1 * (p.x / 10) + m.w2 * (p.y / 10) + m.b > 0 ? 1 : 0;
}

/** 퍼셉트론 갱신 규칙: 틀렸을 때만 w ← w + lr·(정답−예측)·x */
export function perceptronUpdate(m: Model, p: Pt, lr: number): Model {
  const err = p.label - modelPredict(m, p);
  if (err === 0) return m;
  return { w1: m.w1 + lr * err * (p.x / 10), w2: m.w2 + lr * err * (p.y / 10), b: m.b + lr * err };
}

/** 1 epoch = 데이터 전체를 한 바퀴. 학습률은 epoch가 늘수록 조금씩 줄인다. */
export function trainEpoch(m: Model, data: Pt[], epoch: number): Model {
  const lr = 0.5 / (1 + 0.15 * epoch);
  let cur = m;
  for (const p of data) cur = perceptronUpdate(cur, p, lr);
  return cur;
}

/** 결정 경계(w1·x/10 + w2·y/10 + b = 0)를 0~10 상자로 잘라 두 끝점을 돌려준다. 없으면 null. */
export function boundarySegment(m: Model): [{ x: number; y: number }, { x: number; y: number }] | null {
  const pts: { x: number; y: number }[] = [];
  const f = (x: number, y: number) => m.w1 * (x / 10) + m.w2 * (y / 10) + m.b;
  const eps = 1e-9;
  if (Math.abs(m.w2) > eps) {
    for (const x of [0, 10]) {
      const y = (-m.b - m.w1 * (x / 10)) * (10 / m.w2);
      if (y >= -eps && y <= 10 + eps) pts.push({ x, y: Math.min(10, Math.max(0, y)) });
    }
  }
  if (Math.abs(m.w1) > eps) {
    for (const y of [0, 10]) {
      const x = (-m.b - m.w2 * (y / 10)) * (10 / m.w1);
      if (x >= -eps && x <= 10 + eps) pts.push({ x: Math.min(10, Math.max(0, x)), y });
    }
  }
  void f;
  if (pts.length < 2) return null;
  let best: [number, number] = [0, 1];
  let bd = -1;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d > bd) { bd = d; best = [i, j]; }
    }
  if (bd < 1e-6) return null;
  return [pts[best[0]], pts[best[1]]];
}
