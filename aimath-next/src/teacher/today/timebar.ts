// 시간 배분 막대(5색): 단계 7개를 교실에서 부르는 이름 5개로 묶어요. 순수 함수(DOM 없음).
import type { Scene, SceneStage } from "../../shared/contracts.ts";

export type BarGroup = "intro" | "concept" | "tool" | "practice" | "wrap";

export const BAR_GROUPS: { key: BarGroup; label: string; stages: SceneStage[] }[] = [
  { key: "intro", label: "도입", stages: ["open", "prereq"] },
  { key: "concept", label: "개념", stages: ["concept"] },
  { key: "tool", label: "체험", stages: ["tool"] },
  { key: "practice", label: "문제", stages: ["practice"] },
  { key: "wrap", label: "정리", stages: ["wrap", "end"] },
];

export interface BarSeg {
  key: BarGroup;
  label: string;
  min: number;
  count: number;
  /** 막대에서 차지하는 비율(0~100) */
  pct: number;
}

const r05 = (x: number) => Math.round(x * 2) / 2;

/** 켜진 장면만 세요. 0분인 묶음은 빼요 */
export function barSegments(scenes: readonly Scene[]): BarSeg[] {
  const segs = BAR_GROUPS.map((g) => {
    let min = 0;
    let count = 0;
    for (const s of scenes)
      if (s.on && g.stages.indexOf(s.stage) >= 0) {
        min += s.estMin;
        count++;
      }
    return { key: g.key, label: g.label, min: r05(min), count, pct: 0 };
  }).filter((s) => s.count > 0 && s.min > 0);
  const total = segs.reduce((a, s) => a + s.min, 0) || 1;
  for (const s of segs) s.pct = Math.round((s.min / total) * 1000) / 10;
  return segs;
}

/** "3분" · "1.5분" */
export function minLabel(m: number): string {
  const v = r05(m);
  return (v % 1 === 0 ? String(v) : v.toFixed(1)) + "분";
}

/** 지난 때를 사람 말로("방금", "3시간 전", "어제", "4일 전") */
export function agoLabel(ts: number, now: number = Date.now()): string {
  const d = Math.max(0, now - ts);
  const min = Math.floor(d / 60000);
  if (min < 2) return "방금";
  if (min < 60) return min + "분 전";
  const h = Math.floor(min / 60);
  if (h < 24) return h + "시간 전";
  const day = Math.floor(h / 24);
  if (day === 1) return "어제";
  if (day < 30) return day + "일 전";
  return Math.floor(day / 30) + "달 전";
}
