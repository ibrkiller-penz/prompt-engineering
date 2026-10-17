// 17종 미션 판정 모음(순수, DOM 없음). node --test 로 바로 시험해요.
import type { WidgetId } from "../contracts.ts";
import { runJudge, type MissionSet } from "./mission.types.ts";
import { mission as turing } from "./turing/mission.ts";
import { mission as rulevslearn } from "./rulevslearn/mission.ts";
import { mission as bigdata } from "./bigdata/mission.ts";
import { mission as bow } from "./bow/mission.ts";
import { mission as tfidf } from "./tfidf/mission.ts";
import { mission as cosine } from "./cosine/mission.ts";
import { mission as sentiment } from "./sentiment/mission.ts";
import { mission as pixels } from "./pixels/mission.ts";
import { mission as imgtransform } from "./imgtransform/mission.ts";
import { mission as knn } from "./knn/mission.ts";
import { mission as bayes } from "./bayes/mission.ts";
import { mission as regression } from "./regression/mission.ts";
import { mission as gradient } from "./gradient/mission.ts";
import { mission as truth } from "./truth/mission.ts";
import { mission as flow } from "./flow/mission.ts";
import { mission as vecops } from "./vecops/mission.ts";
import { mission as tangent } from "./tangent/mission.ts";

export type { Judge, MissionSet } from "./mission.types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MISSIONS: Record<WidgetId, MissionSet<any>> = {
  turing,
  rulevslearn,
  bigdata,
  bow,
  tfidf,
  cosine,
  sentiment,
  pixels,
  imgtransform,
  knn,
  bayes,
  regression,
  gradient,
  truth,
  flow,
  vecops,
  tangent,
};

/** 안내 데이터의 judge 이름이 실제로 있는지(check-content·시험에서 써요) */
export function hasJudge(id: WidgetId, name: string): boolean {
  const set = MISSIONS[id];
  return !!set && Object.prototype.hasOwnProperty.call(set.judges, name);
}

/** 도구 id·judge 이름·상태로 판정 */
export function judgeMission(id: WidgetId, name: string | undefined, state: unknown): boolean {
  const set = MISSIONS[id];
  return set ? runJudge(set, name, state) : false;
}
