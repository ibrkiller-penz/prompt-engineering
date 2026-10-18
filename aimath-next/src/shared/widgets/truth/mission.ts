// 진리표 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface TruthState {
  graded: (boolean | null)[]; // 연습 칸마다 맞음/틀림/아직
  checked: boolean; // 채점했나
}

export const mission: MissionSet<TruthState> = {
  def: "allCorrect",
  judges: {
    /** 연습 진리표 네 칸을 모두 맞히기 */
    allCorrect: (s) => s.checked && s.graded.length > 0 && s.graded.every((g) => g === true),
  },
};
