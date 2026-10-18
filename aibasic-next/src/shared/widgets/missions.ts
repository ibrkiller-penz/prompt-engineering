// 체험 도구 미션 판정 모음(순수, DOM 없음). 인공지능 기초에는 체험 도구가 없어서 비어 있어요.
import type { WidgetId } from "../contracts.ts";
import { runJudge, type MissionSet } from "./mission.types.ts";

export type { Judge, MissionSet } from "./mission.types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MISSIONS: Partial<Record<WidgetId, MissionSet<any>>> = {};

/** 안내 데이터의 judge 이름이 실제로 있는지 */
export function hasJudge(id: WidgetId, name: string): boolean {
  const set = MISSIONS[id];
  return !!set && Object.prototype.hasOwnProperty.call(set.judges, name);
}

/** 도구 id·judge 이름·상태로 판정 */
export function judgeMission(id: WidgetId, name: string | undefined, state: unknown): boolean {
  const set = MISSIONS[id];
  return set ? runJudge(set, name, state) : false;
}
