// 순서도 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface FlowState {
  preset: string;
  done: boolean; // 끝까지 따라갔나
  blankOk: boolean | null; // 빈칸 조건이 맞았나(아직이면 null)
}

export const mission: MissionSet<FlowState> = {
  def: "finish",
  judges: {
    /** 순서도를 끝까지 따라가기 */
    finish: (s) => s.done,
    /** 빈칸에 알맞은 조건 넣기 */
    blank: (s) => s.blankOk === true,
  },
};
