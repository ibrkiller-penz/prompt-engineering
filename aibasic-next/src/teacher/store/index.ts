// 교사 저장 값(aibn:t1:*)을 화면에서 쓰는 훅 모음. 저장은 모두 src/shared/storage 의 teacherStore 를 거쳐요(try/catch 포함).
// 교사 사이트는 학습 기록(aibn:s1:)을 읽거나 쓰지 않아요. 판서·모둠 점수는 저장하지 않아요.
import { useCallback } from "react";
import type { LessonLog, TeacherData } from "../../shared/contracts.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";
import { cleanDuration, flowKey, type Duration } from "../shell/plan.ts";
import { bump, isEmptyFlow, putLog, resultKey, type FlowState, type PickState } from "./logic.ts";

export * from "./logic.ts";

type FlowMap = TeacherData["flow"];
type PickMap = TeacherData["pick"];
type ResultMap = TeacherData["results"];

const EMPTY_FLOW: FlowMap = {};
const EMPTY_PICK: PickMap = {};
const EMPTY_RESULTS: ResultMap = {};
const EMPTY_LOGS: Record<string, LessonLog> = {};

const obj = <T extends object>(v: unknown, def: T): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : def);

/** 수업 시간(45·50·70) */
export function useDuration(): [Duration, (d: Duration) => void] {
  const [raw, set] = useStored(teacherStore, "duration", 45 as TeacherData["duration"]);
  return [cleanDuration(raw), set];
}

/** 차시별 흐름 전체(오늘 수업·칠판과 같은 값) */
export function useFlowMap(): FlowMap {
  const [v] = useStored(teacherStore, "flow", EMPTY_FLOW);
  return obj(v, EMPTY_FLOW);
}

/** 차시별 바구니 전체 */
export function usePickMap(): PickMap {
  const [v] = useStored(teacherStore, "pick", EMPTY_PICK);
  return obj(v, EMPTY_PICK);
}

/** 한 차시 흐름 고치기 */
export function useFlowState(lid: string, p: number): [FlowState | null, (fn: (cur: FlowState | null) => FlowState | null) => void] {
  const [map, set] = useStored(teacherStore, "flow", EMPTY_FLOW);
  const key = flowKey(lid, p);
  const m = obj(map, EMPTY_FLOW);
  const cur = m[key] || null;
  const update = useCallback(
    (fn: (cur: FlowState | null) => FlowState | null) => {
      set((all) => {
        const a = { ...obj(all, EMPTY_FLOW) };
        const next = fn(a[key] || null);
        if (!next || isEmptyFlow(next)) delete a[key];
        else a[key] = next;
        return a;
      });
    },
    [set, key],
  );
  return [cur, update];
}

/** 한 차시 바구니 고치기(null 이면 자동 제안으로 되돌려요) */
export function usePickState(lid: string, p: number): [PickState | null, (next: PickState | null) => void] {
  const [map, set] = useStored(teacherStore, "pick", EMPTY_PICK);
  const key = flowKey(lid, p);
  const m = obj(map, EMPTY_PICK);
  const cur = m[key] || null;
  const write = useCallback(
    (next: PickState | null) => {
      set((all) => {
        const a = { ...obj(all, EMPTY_PICK) };
        if (!next) delete a[key];
        else a[key] = { board: next.board.slice(), exit: next.exit.slice(), hw: next.hw.slice() };
        return a;
      });
    },
    [set, key],
  );
  return [cur, write];
}

/** 손들기 결과 전체 */
export function useResults(): [ResultMap, (fn: (cur: ResultMap) => ResultMap) => void] {
  const [v, set] = useStored(teacherStore, "results", EMPTY_RESULTS);
  const update = useCallback(
    (fn: (cur: ResultMap) => ResultMap) => {
      set((all) => fn({ ...obj(all, EMPTY_RESULTS) }));
    },
    [set],
  );
  return [obj(v, EMPTY_RESULTS), update];
}

/** 한 문제 손들기 수(보기 n칸): [수, 한 칸 바꾸기, 모두 0으로] */
export function useTally(lid: string, qid: string, n: number): [number[], (i: number, d: number) => void, () => void] {
  const [all, update] = useResults();
  const key = resultKey(lid, qid);
  const counts = bump(all[key] ? all[key].counts : null, -1, 0, n);
  const change = useCallback(
    (i: number, d: number) => {
      update((m) => {
        const prev = m[key] ? m[key].counts : null;
        m[key] = { counts: bump(prev, i, d, n), ts: Date.now() };
        return m;
      });
    },
    [update, key, n],
  );
  const reset = useCallback(() => {
    update((m) => {
      delete m[key];
      return m;
    });
  }, [update, key]);
  return [counts, change, reset];
}

/** 수업 기록 카드: [전체 맵, 저장(card), 지우기(key)]. 같은 반·레슨·차시는 덮어쓰고 최근 60개만 둬요 */
export function useLessonLogs(): [Record<string, LessonLog>, (card: LessonLog) => void, (key: string) => void] {
  const [v, set] = useStored(teacherStore, "log", EMPTY_LOGS);
  const save = useCallback(
    (card: LessonLog) => {
      set((all) => putLog(obj(all, EMPTY_LOGS), card));
    },
    [set],
  );
  const remove = useCallback(
    (key: string) => {
      set((all) => {
        const a = { ...obj(all, EMPTY_LOGS) };
        delete a[key];
        return a;
      });
    },
    [set],
  );
  return [obj(v, EMPTY_LOGS), save, remove];
}

/** 이어서 하기 위치(aibn:t1:last). 같은 값이면 쓰지 않아요 */
export function saveLast(lid: string, p: number, s: number): void {
  try {
    const cur = teacherStore.read("last", null);
    if (cur && cur.lid === lid && cur.p === p && cur.s === s) return;
    teacherStore.write("last", { lid, p, s, ts: Date.now() });
  } catch {
    /* 저장이 막혀도 수업은 그대로 */
  }
}
