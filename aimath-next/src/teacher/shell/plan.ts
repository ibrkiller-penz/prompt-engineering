// 오늘 수업·차시 찾기가 함께 쓰는 계획 계산: plan.json + 교사가 고친 흐름·바구니를 덮어써서 장면 목록을 만들어요.
import { useMemo } from "react";
import PLAN_JSON from "../../../data/plan.json";
import type { Lesson, Plan, PlanLesson, TeacherData } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { TEACHER_ROUTES } from "../../shared/contracts.ts";
import { applyFlow, buildLessonFlow, lessonPeriods, onScenes, type BuiltScene, type LessonFlow, type PeriodInfo } from "../logic/index.ts";

const PLAN = PLAN_JSON as unknown as Plan;

export function planOf(lid: string): PlanLesson | null {
  return (PLAN && PLAN.lessons && PLAN.lessons[lid]) || null;
}

export type Duration = TeacherData["duration"];

export function cleanDuration(d: unknown): Duration {
  return d === 50 || d === 70 ? d : 45;
}

/** "lid:p" — 흐름·바구니 저장 키 */
export const flowKey = (lid: string, p: number) => lid + ":" + p;

export interface LessonPlanView {
  periods: PeriodInfo[];
  p: number;
  flow: LessonFlow;
  scenes: BuiltScene[];
  total: number;
  /** 켜진 장면: 화면 번호(1부터) + 전체 목록 안의 위치(s) */
  on: { n: number; s: number; scene: BuiltScene }[];
}

/** 레슨 + 시간 + 차시 → 장면 목록(교사가 고친 흐름과 칠판 바구니 반영) */
export function computePlan(
  lesson: Lesson,
  minutes: Duration,
  period: number,
  flowState: TeacherData["flow"] | null | undefined,
  pickState: TeacherData["pick"] | null | undefined,
): LessonPlanView {
  const plan = planOf(lesson.id);
  const periods = lessonPeriods(lesson, plan, minutes);
  const p = Math.max(1, Math.min(periods.length || 1, Math.floor(period) || 1));
  const key = flowKey(lesson.id, p);
  const basket = pickState && pickState[key] && pickState[key].board && pickState[key].board.length ? pickState[key].board : undefined;
  const flow = buildLessonFlow(lesson, plan, minutes, p, basket ? { board: basket } : {});
  const st = flowState ? flowState[key] : undefined;
  const res = st ? applyFlow(flow.scenes, st, minutes) : { scenes: flow.scenes, total: flow.total };
  const idx = new Map<BuiltScene, number>();
  res.scenes.forEach((s, i) => idx.set(s, i));
  const on = onScenes(res.scenes).map((x) => ({ n: x.n, s: idx.get(x.scene) as number, scene: x.scene }));
  return { periods, p, flow, scenes: res.scenes, total: res.total, on };
}

export function useLessonPlan(
  lesson: Lesson | undefined,
  minutes: Duration,
  period: number,
  flowState: TeacherData["flow"] | null | undefined,
  pickState: TeacherData["pick"] | null | undefined,
): LessonPlanView | null {
  return useMemo(() => {
    if (!lesson) return null;
    try {
      return computePlan(lesson, minutes, period, flowState, pickState);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [lesson, minutes, period, flowState, pickState]);
}

/** 오늘 수업 화면에 이 레슨·차시를 올려요 */
export const todayHref = (lid: string, p?: number) => href(TEACHER_ROUTES.today, {}, { lid, p: p && p > 0 ? p : undefined });
/** 칠판 수업 주소. s 는 장면 목록 안의 위치(0부터) */
export const boardHref = (lid: string, p: number, s: number) => href(TEACHER_ROUTES.board, { lid }, { p, s });
