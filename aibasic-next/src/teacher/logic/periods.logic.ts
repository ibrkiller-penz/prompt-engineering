// 레슨을 차시(period)로 나누는 순수 로직(DOM 없음).
// plan.json 에 차시가 있으면 그것을 쓰고, 없으면 레슨 분량(원본 minutes)과 수업 시간으로 자동으로 나눠요.
import type { Lesson, PlanLesson, PlanPeriod } from "../../shared/contracts.ts";
import { blockWeight, isAside } from "./measure.logic.ts";

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
  // 읽을거리 상자(스토리 보기)는 칠판에서 기본으로 꺼 두니 차시 분량에는 조금만 셈해요
  return lesson.sections.map((s) => s.blocks.reduce((a, b) => a + (isAside(b) ? 4 : blockWeight(b)), 0));
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
  // plan 이 있으면 plan 의 차시 분 합이 기준이에요(원본 minutes 는 추정값이라 쓰지 않아요)
  const planMin = plan && plan.periods && plan.periods.length ? plan.periods.reduce((a, pp) => a + (pp.minutes > 0 ? pp.minutes : 0), 0) : 0;
  const fitsOne = autoPeriodCount(planMin > 0 ? planMin : lesson.minutes, minutes) === 1;
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

/* ─────────── 차시별 핵심 질문 · 정리 ─────────── */

/** plan.json 레슨 항목 가운데 차시 나누기에 쓰는 덧붙은 필드(contracts 의 PlanLesson 밖) */
export interface PlanPeriodExtra {
  /** 정리 줄 i → 소제목 번호(-1 이면 레슨 전체 → 마지막 차시) */
  summaryOf?: number[];
}
type PeriodLike = Pick<PeriodInfo, "p" | "n" | "sections" | "last"> & { plan?: PlanPeriod };
type PlanArg = PlanLesson | null | undefined;
type LessonArg = Pick<Lesson, "sections" | "minutes" | "summary" | "question">;

/** 차시 번호(1부터, 0 = 레슨 전체) 또는 차시 정보 → 차시 정보. 번호면 plan 의 차시(없으면 45분 기준 자동)를 써요 */
export function resolvePeriod(lesson: LessonArg, plan: PlanArg, period: number | PeriodLike): PeriodLike {
  if (typeof period !== "number") return period;
  let periods: PeriodInfo[] | null = null;
  const S = lesson.sections.length;
  if (plan && plan.periods && plan.periods.length > 1 && plan.periods.every((pp) => pp.sections.length > 0 && pp.sections.every((s) => s >= 0 && s < S))) {
    const n = plan.periods.length;
    periods = plan.periods.map((pp, i) => ({ p: i + 1, n, sections: pp.sections.slice().sort((a, b) => a - b), first: i === 0, last: i === n - 1, plan: pp }));
  }
  if (!periods) periods = lessonPeriods(lesson, plan, 45);
  return pickPeriod(periods, period, S);
}

/** 정리 줄 i 가 속한 소제목(plan.summaryOf, 없으면 줄 차례대로 소제목에 고르게 나눠요). -1 이면 레슨 전체 */
export function summarySections(lesson: Pick<Lesson, "sections" | "summary">, plan: PlanArg): number[] {
  const S = lesson.sections.length;
  const L = lesson.summary.length;
  const so = plan ? (plan as unknown as PlanPeriodExtra).summaryOf : undefined;
  const out: number[] = [];
  for (let i = 0; i < L; i++) {
    const v = so ? so[i] : undefined;
    if (typeof v === "number" && Number.isInteger(v) && v >= -1 && v < S) out.push(v);
    else out.push(Math.min(S - 1, Math.floor((i * S) / Math.max(1, L))));
  }
  return out;
}

export interface PeriodSummary {
  /** 장면·화면 제목: "오늘 정리" · "이 레슨 전체 정리" */
  title: string;
  /** 정리 줄(원본 lesson.summary 의 줄 그대로, 차례 유지) */
  lines: string[];
  /** 레슨 전체 정리인가 */
  whole: boolean;
}

/**
 * 한 차시의 '오늘 정리' 줄.
 *  - 레슨이 한 차시이거나 레슨 전체(0)면 모든 줄
 *  - 나눈 차시면 summaryOf 가 이 차시 소제목인 줄만(레슨 전체 줄 -1 은 마지막 차시에)
 *  - 마지막 차시에서 opts.whole 이면 "이 레슨 전체 정리"로 모든 줄
 *  - 줄이 하나도 안 걸리면 줄 차례대로 고르게 나눈 몫을 보여 줘요(빈 정리는 없어요)
 * @param period 차시 번호(1부터, 0 = 레슨 전체) 또는 lessonPeriods 의 차시 정보
 */
export function summaryForPeriod(lesson: LessonArg, plan: PlanArg, period: number | PeriodLike, opts: { whole?: boolean } = {}): PeriodSummary {
  const per = resolvePeriod(lesson, plan, period);
  const all = lesson.summary.slice();
  if (per.p === 0 || per.n <= 1) return { title: per.p === 0 && per.n > 1 ? "이 레슨 전체 정리" : "오늘 정리", lines: all, whole: true };
  if (per.last && opts.whole) return { title: "이 레슨 전체 정리", lines: all, whole: true };
  const secs = summarySections(lesson, plan);
  let lines = all.filter((_, i) => (secs[i] === -1 ? per.last : per.sections.indexOf(secs[i]) >= 0));
  if (!lines.length && all.length) {
    const a = Math.floor(((per.p - 1) * all.length) / per.n);
    const b = Math.max(a + 1, Math.floor((per.p * all.length) / per.n));
    lines = all.slice(a, b);
  }
  return { title: "오늘 정리", lines, whole: false };
}

/** 지난 시간 되짚기 줄(이전 차시 정리에서 2~3줄: 3줄이 넘으면 처음·가운데·끝) */
export function recapLines(lesson: LessonArg, plan: PlanArg, prev: number | PeriodLike): string[] {
  const lines = summaryForPeriod(lesson, plan, prev).lines;
  if (lines.length <= 3) return lines;
  return [lines[0], lines[Math.floor((lines.length - 1) / 2)], lines[lines.length - 1]];
}

/** 질문을 물음표마다 끊어요("…할까? 그리고 …할까?" → 두 줄). 물음표가 없으면 통째로 한 줄 */
export function splitQuestionLines(q: string): string[] {
  const out: string[] = [];
  const re = /[^?？]*[?？]/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(q))) {
    const t = m[0].trim();
    if (t) out.push(t);
    last = re.lastIndex;
  }
  const tail = q.slice(last).trim();
  if (tail) out.push(tail);
  return out.length ? out : [q];
}

/**
 * 차시의 핵심 질문(1~2줄).
 *  - plan.periods[p-1].question 이 있으면 그것
 *  - 나눈 차시인데 없으면 첫 물음표에서 나눠 1차시는 앞, 그 뒤 차시는 나머지(나눌 수 없으면 전체)
 *  - 한 차시·레슨 전체면 전체 질문을 물음표마다 줄로(3줄 이상이면 둘째 줄부터 한 줄로 이어요)
 */
export function periodQuestion(lesson: LessonArg, plan: PlanArg, period: number | PeriodLike): string[] {
  const per = resolvePeriod(lesson, plan, period);
  const parts = splitQuestionLines(lesson.question || "");
  const two = (xs: string[]) => (xs.length <= 2 ? xs : [xs[0], xs.slice(1).join(" ")]);
  if (per.p === 0 || per.n <= 1) return two(parts);
  const own = per.plan ? (per.plan as PlanPeriod & { question?: string }).question : undefined;
  const fromPlan = own || (plan && plan.periods && plan.periods[per.p - 1] ? (plan.periods[per.p - 1] as PlanPeriod & { question?: string }).question : undefined);
  if (fromPlan && fromPlan.trim()) return two(splitQuestionLines(fromPlan.trim()));
  if (parts.length < 2) return parts;
  if (per.p === 1) return [parts[0]];
  return two([parts.slice(1).join(" ").replace(/^(그리고|또|또한)\s+/, "")]);
}
