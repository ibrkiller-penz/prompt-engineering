// 교사 준비 자료(data/teacher/prep/uN.json) 읽기 + 준비 한 장·인쇄가 함께 쓰는 계산(차시·바구니).
// data/teacher/** 는 교사 빌드에서만 불러와요(이 파일은 src/teacher 안에만 있어요).
import { useEffect, useState } from "react";
import type { Lesson, PrepLesson, PrepUnit, TeacherData } from "../../shared/contracts.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";
import { TEACHER_MARK } from "../mark.ts";
import { cleanDuration, flowKey, useLessonPlan, type Duration, type LessonPlanView } from "../shell/plan.ts";

/** 교사 전용 표식(학생 빌드에 섞이면 누출 검사가 잡아요) */
export const PREP_MARK = TEACHER_MARK;

/** 준비 자료 한 레슨(계약의 PrepLesson + 자료에 실제로 있는 덧붙임) */
export interface PrepLessonX extends PrepLesson {
  goals?: string[];
  questions?: { q: string; a: string }[];
  /** 목표 i 가 다루는 소제목 번호(0부터). 차시별 목표를 가려 보여 줄 때 써요 */
  goalSecs?: number[][];
}

export interface GoalView {
  text: string;
  /** 지금 고른 차시의 목표인가 */
  now: boolean;
  /** 다른 차시 목표면 그 차시 번호들(예: [2]) */
  periods: number[];
}

/** 목표를 차시별로 나눠요: 고른 차시 소제목에 걸리면 now, 아니면 걸리는 차시 번호. goalSecs 가 없거나 한 차시면 모두 now */
export function goalsForPeriod(goals: string[], goalSecs: number[][] | undefined, periods: { p: number; sections: number[] }[], p: number): GoalView[] {
  const cur = periods.filter((x) => x.p === p)[0];
  return goals.map((text, i) => {
    const secs = goalSecs && goalSecs[i] && goalSecs[i].length ? goalSecs[i] : null;
    if (!secs || periods.length <= 1 || !cur) return { text, now: true, periods: [] };
    const now = secs.some((s) => cur.sections.indexOf(s) >= 0);
    const ps: number[] = [];
    for (const x of periods) if (x.p !== p && secs.some((s) => x.sections.indexOf(s) >= 0)) ps.push(x.p);
    return { text, now, periods: now ? [] : ps };
  });
}

const loaders = import.meta.glob<PrepUnit>("../../../data/teacher/prep/u*.json", { import: "default" });
const cache: Record<number, PrepUnit | null> = {};

function loaderFor(unit: number): (() => Promise<PrepUnit>) | undefined {
  const tail = "/u" + unit + ".json";
  for (const k of Object.keys(loaders)) if (k.slice(-tail.length) === tail) return loaders[k];
  return undefined;
}

export function loadPrep(unit: number): Promise<PrepUnit | null> {
  if (cache[unit] !== undefined) return Promise.resolve(cache[unit]);
  const ld = loaderFor(unit);
  if (!ld) {
    cache[unit] = null;
    return Promise.resolve(null);
  }
  return ld().then(
    (d) => (cache[unit] = d),
    () => (cache[unit] = null),
  );
}

/** 레슨 준비 자료 훅. undefined = 불러오는 중, null = 자료 없음 */
export function usePrep(unit: number | undefined, lid: string): PrepLessonX | null | undefined {
  const [st, setSt] = useState<PrepLessonX | null | undefined>(() => {
    if (!unit) return null;
    const c = cache[unit];
    return c === undefined ? undefined : c && c.lessons ? (c.lessons[lid] as PrepLessonX) || null : null;
  });
  useEffect(() => {
    if (!unit) {
      setSt(null);
      return;
    }
    let alive = true;
    loadPrep(unit).then((d) => {
      if (alive) setSt(d && d.lessons ? (d.lessons[lid] as PrepLessonX) || null : null);
    });
    return () => {
      alive = false;
    };
  }, [unit, lid]);
  return st;
}

export interface Baskets {
  board: string[];
  exit: string[];
  hw: string[];
}

export interface LessonPrepState {
  duration: Duration;
  setDuration: (d: Duration) => void;
  view: LessonPlanView | null;
  /** 교사가 고친 바구니가 있으면 그것, 없으면 자동(plan.json·자동 고르기) */
  baskets: Baskets;
  /** 교사가 바구니를 고쳤는지 */
  edited: boolean;
}

/** 준비 한 장·인쇄 공용: 수업 시간 + 차시 → 장면·바구니 */
export function useLessonPrep(lesson: Lesson | undefined, period: number): LessonPrepState {
  const [dRaw, setD] = useStored(teacherStore, "duration", 45 as TeacherData["duration"]);
  const [flow] = useStored(teacherStore, "flow", {} as TeacherData["flow"]);
  const [pick] = useStored(teacherStore, "pick", {} as TeacherData["pick"]);
  const duration = cleanDuration(dRaw);
  const view = useLessonPlan(lesson, duration, period, flow, pick);
  const auto = view ? view.flow.pick : { board: [], exit: [], hw: [] };
  const key = lesson && view ? flowKey(lesson.id, view.p) : "";
  const mine = key && pick ? pick[key] : undefined;
  const offHw = view ? view.scenes.filter((s) => s.kind === "problem" && !s.on).map((s) => s.qid || s.id.replace(/^q:/, "")) : [];
  const board = mine && mine.board && mine.board.length ? mine.board : auto.board;
  const exit = mine && mine.exit && mine.exit.length ? mine.exit : auto.exit;
  let hw = mine && mine.hw && mine.hw.length ? mine.hw : auto.hw;
  // 흐름에서 끈 칠판 문제는 숙제로 돌아가요
  const extra = offHw.filter((id) => hw.indexOf(id) < 0 && exit.indexOf(id) < 0);
  if (extra.length) hw = hw.concat(extra);
  return {
    duration,
    setDuration: (d: Duration) => setD(d),
    view,
    baskets: { board: board.filter((id) => offHw.indexOf(id) < 0), exit, hw },
    edited: !!mine,
  };
}
