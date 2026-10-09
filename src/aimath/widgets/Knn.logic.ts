export type Metric = "euclid" | "manhattan";
export interface Pt { x: number; y: number }
export interface Labeled extends Pt { cls: number }
export interface Neighbor extends Labeled { dist: number; idx: number }
export interface KnnResult {
  neighbors: Neighbor[];
  votes: number[];
  winner: number;
  /** 동점이어서 가장 가까운 이웃의 반에 따랐는지 */
  tieBroken: boolean;
}

export function distance(a: Pt, b: Pt, metric: Metric): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return metric === "euclid" ? Math.sqrt(dx * dx + dy * dy) : Math.abs(dx) + Math.abs(dy);
}

/** 거리 오름차순(같으면 입력 순서). 앞의 k개 */
export function nearest(points: Labeled[], q: Pt, k: number, metric: Metric): Neighbor[] {
  return points
    .map((p, idx) => ({ ...p, idx, dist: distance(p, q, metric) }))
    .sort((a, b) => a.dist - b.dist || a.idx - b.idx)
    .slice(0, Math.max(0, Math.min(k, points.length)));
}

/** 다수결. 동점이면 동점인 반 가운데 '가장 가까운 이웃'이 속한 반이 이긴다. */
export function classify(points: Labeled[], q: Pt, k: number, metric: Metric, classCount: number): KnnResult {
  const ns = nearest(points, q, k, metric);
  const votes = Array.from({ length: classCount }, () => 0);
  for (const n of ns) votes[n.cls]++;
  const max = Math.max(...votes);
  const tied = votes.map((v, c) => (v === max ? c : -1)).filter((c) => c >= 0);
  let winner = tied[0];
  if (tied.length > 1 && ns.length > 0) {
    winner = ns.find((n) => tied.includes(n.cls))!.cls;
  }
  return { neighbors: ns, votes, winner, tieBroken: tied.length > 1 };
}

/** 결정 영역: 0~10 범위를 cells x cells 칸으로 나눠 각 칸 중심의 예측 반 */
export function decisionGrid(points: Labeled[], k: number, metric: Metric, classCount: number, cells = 20): number[][] {
  const step = 10 / cells;
  return Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) =>
      classify(points, { x: (c + 0.5) * step, y: 10 - (r + 0.5) * step }, k, metric, classCount).winner,
    ),
  );
}

export const CLASS_NAMES = ["고양이", "강아지", "토끼"];
export const CLASS_COLORS = ["#e8590c", "#1c7ed6", "#2f9e44"];

export const PRESET_POINTS: Labeled[] = [
  { x: 1.5, y: 7.5, cls: 0 }, { x: 2.2, y: 8.5, cls: 0 }, { x: 3.0, y: 7.0, cls: 0 }, { x: 2.5, y: 6.0, cls: 0 }, { x: 1.2, y: 6.2, cls: 0 },
  { x: 7.5, y: 7.5, cls: 1 }, { x: 8.5, y: 8.5, cls: 1 }, { x: 6.8, y: 8.8, cls: 1 }, { x: 8.8, y: 6.5, cls: 1 }, { x: 7.2, y: 6.3, cls: 1 },
  { x: 4.5, y: 1.8, cls: 2 }, { x: 5.5, y: 2.8, cls: 2 }, { x: 3.8, y: 3.0, cls: 2 }, { x: 6.2, y: 1.5, cls: 2 }, { x: 5.0, y: 1.0, cls: 2 },
];
