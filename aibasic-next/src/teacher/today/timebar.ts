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

/** "1레슨 끝, 1레슨 진행 중" (하나도 없으면 "아직 기록이 없어요") */
export function marksLabel(done: number, part: number): string {
  const out: string[] = [];
  if (done) out.push(done + "레슨 끝");
  if (part) out.push(part + "레슨 진행 중");
  return out.length ? out.join(", ") : "아직 기록이 없어요";
}

export type TimeState = "over" | "under" | "fit";

/** 이 분 이하로 넘치는 것은 '넘침 없음'(맞아요)으로 봐요. 줄이기 상자(cuts.ts)와 timeVerdict 가 같이 써요 */
export const OVER_TOLERANCE_MIN = 0.5;

/**
 * 수업 시간을 넘는 분(0.5분 단위로 반올림). 0.5분 이하는 0 이에요.
 * 줄이기 상자는 이 값이 0 보다 클 때만 '넘쳐요'를 보여 주세요(cuts.ts 의 cutInfo 가 `over < 0.5` 대신 이 함수를 쓰면 같아져요).
 */
export function overMin(total: number, minutes: number): number {
  const o = r05(Math.max(0, total - minutes));
  return o <= OVER_TOLERANCE_MIN ? 0 : o;
}

/**
 * 시간 한 줄 판단. 지금 켜 둔 장면 기준이에요(이야기 장면을 꺼 둔 상태면 그렇다고 밝혀요).
 * 꺼 둔 이야기를 켜면 어떻게 되는지는 storyAddText 가 따로 말하므로 여기서는 '맞아요/넘어요'를 한 줄에 같이 내지 않아요.
 * 기준: 예상 분이 수업 시간보다 0.5분(반올림 값 기준) 넘게 길면 over, 3분 넘게 모자라면 under, 나머지는 fit.
 */
export function timeVerdict(total: number, minutes: number, sAdd?: { count: number; over: number } | null): { state: TimeState; text: string } {
  const off = sAdd && sAdd.count > 0 ? "이야기 장면 " + sAdd.count + "장을 꺼 둔 지금 기준으로 " : "";
  const over = overMin(total, minutes);
  if (over > 0) return { state: "over", text: off + "시간이 " + minLabel(over) + " 넘쳐요." };
  if (total < minutes - 3) return { state: "under", text: off + minLabel(minutes - total) + " 남아요." };
  return { state: "fit", text: off ? off + "수업 " + minutes + "분 안에 들어와요." : "수업 시간에 잘 맞아요." };
}
