// 칠판 화면이 함께 쓰는 자료: 레슨 + 수업 시간 + 교사가 고친 흐름·바구니 → 장면 목록(오늘 수업과 같은 계산).
import { useMemo } from "react";
import type { Lesson } from "../../shared/contracts.ts";
import { useLesson } from "../../content/index.ts";
import { flowKey, useLessonPlan, type LessonPlanView } from "../shell/plan.ts";
import { homeworkFromOff } from "../logic/index.ts";
import { homeworkWith, useDuration, useFlowMap, usePickMap } from "../store/index.ts";

export interface BoardData {
  lesson: Lesson | undefined;
  loading: boolean;
  error: Error | null;
  view: LessonPlanView | null;
  minutes: number;
  /** 끝 확인·숙제(교사 바구니가 있으면 그것, 꺼진 칠판 문제는 숙제로) */
  exit: string[];
  hw: string[];
}

export function useBoardData(lid: string, p: number): BoardData {
  const { data: lesson, loading, error } = useLesson(lid);
  const [minutes] = useDuration();
  const flowMap = useFlowMap();
  const pickMap = usePickMap();
  const view = useLessonPlan(lesson, minutes, p, flowMap, pickMap);
  const baskets = useMemo(() => {
    if (!view) return { exit: [] as string[], hw: [] as string[] };
    const saved = pickMap[flowKey(lid, view.p)];
    const exit = saved ? saved.exit.slice() : view.flow.pick.exit.slice();
    const hw0 = saved ? saved.hw.slice() : view.flow.pick.hw.slice();
    const hw = homeworkWith(hw0, homeworkFromOff(view.scenes), exit);
    return { exit, hw };
  }, [view, pickMap, lid]);
  return { lesson, loading, error, view, minutes, exit: baskets.exit, hw: baskets.hw };
}
