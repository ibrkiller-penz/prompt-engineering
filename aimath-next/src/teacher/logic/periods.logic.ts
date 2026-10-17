// 레슨을 차시(period)로 나누는 순수 로직(DOM 없음).
// plan.json 에 차시가 있으면 그것을 쓰고, 없으면 레슨 분량(원본 minutes)과 수업 시간으로 자동으로 나눠요.
import type { Lesson, PlanLesson, PlanPeriod } from "../../shared/contracts.ts";
import { blockWeight } from "./measure.logic.ts";

export interface PeriodInfo {
  /** 차시 번호(1부터) */
  p: number;
  /** 전체 차시 수 */
  n: number;
  /** 이 차시에 다루는 소제목 번호(0부터, 오름차순) */
  sections: number[];
  /** 첫 차시인가(이야기·먼저 알고 가요는 첫 차시에만) */
  first: boolean;
  /** 마지막 차시인가(AI 이야기·레슨 전체 문제는 마지막 차시에) */
  last: boolean;
  /** plan.json 의 차시 정보(있으면) */
  plan?: PlanPeriod;
}

/** 소제목별 무게(개념 장면 예산과 같은 잣대) */
export function sectionWeights(lesson: Pick<Lesson, "sections">): number[] {
  return lesson.sections.map((s) => s.blocks.reduce((a, b) => a + blockWeight(b), 0));
}

/** 수업 시간(분)에 맞춰 몇 차시로 나눌지. 원본 분량이 수업 시간 + 10분 안이면 1차시 */
export function autoPeriodCount(lessonMinutes: number, minutes: number): number {
  const lm = lessonMinutes > 0 ? lessonMinutes : minutes;
  return Math.max(1, Math.ceil(lm / (minutes + 10)));
}

/** 소제목을 무게가 고르게 n 묶음(이어진 번호)으로 나눠요. 묶음은 비지 않아요 */
export function splitSections(weights: number[], n: number): number[][] {
  const S = weights.length;
  const k = Math.max(1, Math.min(n, S));
  if (S === 0) return [[]];
  const total = weights.reduce((a, w) => a + w, 0) || 1;
  const out: number[][] = [];
  let i = 0;
  let acc = 0;
  for (let g = 0; g < k; g++) {
    const grp: number[] = [];
    const target = (total * (g + 1)) / k;
    const mustLeave = k - g - 1; // 뒤 묶음에 남겨야 할 소제목 수
    while (i < S - mustLeave) {
      const w = weights[i];
      // 묶음이 비어 있으면 무조건 넣고, 아니면 목표에 더 가까워질 때만 넣어요
      if (grp.length && Math.abs(acc + w - target) > Math.abs(acc - target)) break;
      grp.push(i);
      acc += w;
      i++;
      if (g < k - 1 && acc >= target) break;
    }
    out.push(grp);
  }
  // 남은 소제목은 마지막 묶음에
  while (i < S) out[out.length - 1].push(i++);
  return out;
}

/**
 * 레슨의 차시 목록.
 *  - plan.periods 가 있고 소제목 번호가 올바르면 그대로 써요.
 *    다만 70분처럼 수업이 길어 레슨 전체가 한 번에 들어가면 하나로 합쳐요.
 *  - 없으면 autoPeriodCount 로 나눠요.
 */
export function lessonPeriods(lesson: Pick<Lesson, "sections" | "minutes">, plan: PlanLesson | null | undefined, minutes: number): PeriodInfo[] {
  const S = lesson.sections.length;
  const fitsOne = autoPeriodCount(lesson.minutes, minutes) === 1;
  let groups: { sections: number[]; plan?: PlanPeriod }[] | null = null;

  if (plan && plan.periods && plan.periods.length && !fitsOne) {
    const ok = plan.periods.every((pp) => pp.sections.length > 0 && pp.sections.every((s) => Number.isInteger(s) && s >= 0 && s < S));
    if (ok) groups = plan.periods.map((pp) => ({ sections: pp.sections.slice().sort((a, b) => a - b), plan: pp }));
  }
  if (!groups) {
    const n = fitsOne ? 1 : autoPeriodCount(lesson.minutes, minutes);
    groups = splitSections(sectionWeights(lesson), n).map((sections) => ({ sections }));
    if (plan && plan.periods && plan.periods.length === 1 && groups.length === 1) groups[0].plan = plan.periods[0];
  }
  const n = groups.length;
  return groups.map((g, i) => ({ p: i + 1, n, sections: g.sections, first: i === 0, last: i === n - 1, plan: g.plan }));
}

/** 차시 번호로 하나 고르기. 0 이면 레슨 전체를 한 차시로 봐요(검사·인쇄용). 범위를 넘으면 가까운 쪽으로 */
export function pickPeriod(periods: PeriodInfo[], period: number, sectionCount: number): PeriodInfo {
  if (period === 0 || !periods.length) {
    const all: number[] = [];
    for (let i = 0; i < sectionCount; i++) all.push(i);
    return { p: 0, n: periods.length || 1, sections: all, first: true, last: true };
  }
  const k = Math.max(1, Math.min(periods.length, Math.floor(period) || 1));
  return periods[k - 1];
}
